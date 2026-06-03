/**
 * Module B — Azure AI Document Intelligence (OCR déterministe) + routage HYBRIDE.
 *
 * Stratégie : Azure (prebuilt-layout) pour les docs structurés (paie, avis, CNI),
 * GPT-4o Vision en REPLI (type non couvert, échec Azure, confiance basse, ou clés
 * absentes). Sortie au MÊME contrat JSON normalisé que la Vision (passage par
 * normalizeAndValidateAnalysis) → aval inchangé.
 *
 * Pourquoi prebuilt-layout pour TOUT (y compris CNI) : la zone MRZ (TD1) d'une CNI
 * est présente dans le texte OCR avec ses clés de contrôle → identité déterministe
 * et auto-vérifiable (validateMRZ), sans 2ᵉ modèle. prebuilt-idDocument reste géré
 * en secours via mapAzureIdDocumentToRaw si une ressource le configure.
 *
 * RGPD : refuse toute ressource hors région UE.
 * Requires relatifs (convention des services JS du repo).
 */

const {
  normalizeAmount,
  normalizeAndValidateAnalysis,
  analyzeWithVision,
} = require('./visionAnalysisService');

const EU_REGIONS = [
  'francecentral', 'westeurope', 'northeurope', 'swedencentral',
  'switzerlandnorth', 'germanywestcentral', 'norwayeast', 'polandcentral',
];

const AZURE_TIMEOUT_MS = Number(process.env.AZURE_DOC_INTELLIGENCE_TIMEOUT_MS || 30_000);

/* ─────────────────────────────  Helpers  ───────────────────────────── */

/** "4.131,45" → 4131.45 ; "927,93" → 927.93 ; "20.351,99" → 20351.99 ; "35 334" → 35334. */
function parseFrenchNumber(raw) {
  if (raw == null) return null;
  // Normalise tout espace (y compris insécable/fin) en espace simple avant extraction.
  const s = String(raw).replace(/[\s  ]/g, ' ');
  const m = s.match(/-?\d[\d .]*(?:,\d{1,2})?/);
  if (!m) return null;
  const cleaned = m[0].replace(/[ .]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Première capture numérique FR d'une regex sur le texte. */
function matchFr(text, regex) {
  const m = String(text || '').match(regex);
  return m ? parseFrenchNumber(m[1]) : null;
}

/** Montant après un libellé, tolérant aux espaces insécables (séparateurs de milliers). */
function grabAmount(content, labelSource) {
  const re = new RegExp(`${labelSource}[^0-9]*([\\d][\\d .\\u00a0\\u202f]*(?:,\\d{1,2})?)`, 'i');
  const m = String(content || '').match(re);
  return m ? parseFrenchNumber(m[1]) : null;
}

/** Suite de chiffres après un libellé (n° fiscal, référence d'avis) → digits seuls. */
function grabDigits(content, labelSource, minLen = 9) {
  const re = new RegExp(`${labelSource}[^0-9]*([\\d][\\d .\\u00a0\\u202f]{${minLen},})`, 'i');
  const m = String(content || '').match(re);
  return m ? m[1].replace(/\D/g, '') : undefined;
}

/** "MAELYS GAELLE" → "Maelys Gaelle". */
const titleCase = (s) =>
  String(s || '').toLowerCase().replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (_, b, c) => b + c.toUpperCase());

const norm = (s) => String(s || '').toLowerCase().trim();

/* ─────────────────────────────  Config & routage  ───────────────────────────── */

function isAzureConfigured() {
  const endpoint = process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT;
  const key = process.env.AZURE_DOC_INTELLIGENCE_KEY;
  if (!endpoint || !key) return false;
  if (process.env.AZURE_OCR_DISABLED === 'true') return false;
  // RGPD : exiger une région UE (par variable explicite OU par hôte de l'endpoint).
  const region = norm(process.env.AZURE_DOC_INTELLIGENCE_REGION);
  const host = norm(endpoint);
  const isEu = EU_REGIONS.includes(region) || EU_REGIONS.some((r) => host.includes(r));
  return isEu;
}

/**
 * Modèle Azure par type de doc ; null ⇒ non couvert → repli Vision.
 * prebuilt-layout couvre paie, avis ET CNI (MRZ lue dans le texte).
 */
function pickAzureModel(documentCategory, hintedType) {
  const cat = norm(documentCategory);
  const type = String(hintedType || '').toUpperCase();
  if (
    cat === 'identity' || type === 'CARTE_IDENTITE' || type === 'PASSEPORT' ||
    type === 'BULLETIN_SALAIRE' || type === 'AVIS_IMPOSITION' ||
    cat === 'resources' || cat === 'income'
  ) {
    return 'prebuilt-layout';
  }
  return null;
}

/* ─────────────────────────────  Appel Azure (SDK)  ───────────────────────────── */

/**
 * Lance l'analyse Azure et renvoie analyzeResult. Loggue le coût (par page).
 * Lève en cas d'erreur → le routeur bascule sur Vision.
 */
async function analyzeWithAzure(buffer, model) {
  const endpoint = process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT;
  const key = process.env.AZURE_DOC_INTELLIGENCE_KEY;

  const mod = await import('@azure-rest/ai-document-intelligence');
  const DocumentIntelligence = mod.default;
  const { getLongRunningPoller, isUnexpected } = mod;

  const client = DocumentIntelligence(endpoint, { key });
  const initial = await client
    .path('/documentModels/{modelId}:analyze', model)
    .post({
      contentType: 'application/octet-stream',
      body: buffer,
      queryParameters: { locale: 'fr-FR' },
    });
  if (isUnexpected(initial)) {
    throw new Error(`Azure DI ${initial.status}: ${initial.body?.error?.message || 'erreur'}`);
  }
  const poller = getLongRunningPoller(client, initial, { abortSignal: AbortSignal.timeout(AZURE_TIMEOUT_MS) });
  const result = (await poller.pollUntilDone()).body;
  const analyzeResult = result.analyzeResult;

  // Coût réel (forfait par page) — fire-and-forget.
  try {
    const pages = analyzeResult?.pages?.length || 1;
    const perPage = Number(process.env.AZURE_DOC_INTELLIGENCE_PRICE_EUR_PER_PAGE || 0.01);
    // eslint-disable-next-line global-require
    require('./api-cost-logger').recordFlatCost({
      provider: 'Azure',
      category: 'OCR',
      costEur: perPage * pages,
      units: pages,
      model,
      meta: { model },
    });
  } catch { /* fire-and-forget */ }

  return analyzeResult;
}

/* ─────────────────────────────  Adaptateurs → contrat JSON  ───────────────────────────── */

/** prebuilt-layout d'une fiche de paie → rawResult (forme de sortie LLM). */
function mapAzurePayslipToRaw(analyzeResult, ctx = {}) {
  const content = analyzeResult.content || '';
  const tables = analyzeResult.tables || [];

  // 1) Tableau récapitulatif (headers « Brut » + « Net Fiscal ») = source fiable.
  let brut;
  let netFiscal;
  let chargesSal;
  const recap = tables.find((t) => {
    const hs = (t.cells || []).filter((c) => c.kind === 'columnHeader').map((c) => norm(c.content));
    return hs.includes('brut') && hs.includes('net fiscal');
  });
  if (recap) {
    const hCol = {};
    recap.cells.filter((c) => c.kind === 'columnHeader').forEach((c) => { hCol[c.columnIndex] = norm(c.content); });
    const mensuel = recap.cells.find((c) => norm(c.content) === 'mensuel');
    if (mensuel) {
      recap.cells
        .filter((c) => c.rowIndex === mensuel.rowIndex)
        .forEach((c) => {
          const h = hCol[c.columnIndex];
          if (h === 'brut') brut = parseFrenchNumber(c.content);
          else if (h === 'net fiscal') netFiscal = parseFrenchNumber(c.content);
          else if (h === 'charges salariales') chargesSal = parseFrenchNumber(c.content);
        });
    }
  }

  // 2) Compléments / fallback depuis le texte OCR (déterministe).
  const netAPayer = matchFr(content, /net\s*à\s*payer\s+([\d .]+,\d{2})\s*euros/i);
  const netSocial = matchFr(content, /net\s*social\s*\n?\s*([\d .]+,\d{2})/i);
  const netAvantImpot = matchFr(content, /net\s*à\s*payer\s*avant\s*imp[oô]t[^\n]*\n\s*([\d .]+,\d{2})/i);
  if (brut == null) brut = matchFr(content, /total\s*brut[^\n]*\n[^\n]*?([\d .]+,\d{2})/i);
  if (chargesSal == null) chargesSal = matchFr(content, /total\s*charges\s*\n?\s*([\d .]+,\d{2})/i);

  // Net retenu : après impôt > avant impôt > net fiscal > net social (cf. priorité existante).
  const monthlyNet = netAPayer ?? netAvantImpot ?? netFiscal ?? netSocial ?? 0;

  // Identité « M./Mme NOM Prénom ».
  let ownerName = '';
  const nm = content.match(/M(?:me|r|\.)?\.?\s+([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’\- ]{1,40}?)\s+([A-ZÀ-ÖØ-Þ][a-zà-ÿ'’\-]+)/);
  if (nm) ownerName = `${nm[2]} ${nm[1].trim().replace(/\s+/g, ' ')}`.trim();

  // Période → date d'émission = fin de période.
  const per = content.match(/p[ée]riode de paie du\s+([\d.]{8,10})\s+au\s+([\d.]{8,10})/i);
  const dateEmission = per ? per[2] : '';

  // Contrôle mathématique déterministe : Brut − Charges = Net social ?
  const mathOk =
    brut != null && chargesSal != null && netSocial != null
      ? Math.abs(brut - chargesSal - netSocial) <= 0.5
      : undefined;

  return {
    document_metadata: {
      type: 'BULLETIN_SALAIRE',
      owner_name: ownerName,
      date_emission: dateEmission,
      suggested_file_name: ctx.fileName,
    },
    financial_data: {
      monthly_net_income: normalizeAmount(monthlyNet),
      currency: 'EUR',
      is_recurring: true,
      extra_details: {
        salaire_brut_mensuel: brut != null ? normalizeAmount(brut) : undefined,
        cotisations_mensuelles: chargesSal != null ? normalizeAmount(chargesSal) : undefined,
        net_fiscal: netFiscal != null ? normalizeAmount(netFiscal) : undefined,
        net_social: netSocial != null ? normalizeAmount(netSocial) : undefined,
        net_a_payer: netAPayer != null ? normalizeAmount(netAPayer) : undefined,
      },
    },
    trust_and_security: { fraud_score: 0, forensic_alerts: [], math_validation: mathOk },
    ai_analysis: { detected_profile: ctx.candidateStatus || 'SALARIED', impact_on_patrimometer: 0, expert_advice: '' },
    analysisMethod: 'azure_doc_intelligence',
  };
}

/** prebuilt-layout d'un avis d'imposition → rawResult (RFR scellé côté OCR). */
function mapAzureAvisToRaw(analyzeResult, ctx = {}) {
  const content = analyzeResult.content || '';
  const rfr = grabAmount(content, 'revenu\\s*fiscal\\s*de\\s*r[ée]f[ée]rence');
  const numeroFiscal = grabDigits(content, 'num[ée]ro\\s*fiscal', 9);
  const referenceAvis = grabDigits(content, "r[ée]f[ée]rence\\s*(?:de\\s*l['’ ]?)?avis", 9);
  const partsM = content.match(/nombre\s*de\s*parts[^0-9]*([\d]+(?:[.,]\d{1,2})?)/i);
  const yearM = content.match(/imp[oô]t\s*sur\s*les\s*revenus\s*de\s*(\d{4})/i);

  // Identité : « Nom de naissance : X » + prénom de la ligne d'adressage « X PRENOM ».
  let ownerName = '';
  const surnameM = content.match(/Nom de naissance\s*:?\s*([A-ZÀ-Þ][A-ZÀ-Þ'’\-]+)/);
  if (surnameM) {
    const surname = surnameM[1].trim();
    const firstM = content.match(new RegExp(`${surname}\\s+([A-ZÀ-Þ][A-ZÀ-Þ'’\\-]{1,})`));
    ownerName = firstM ? `${titleCase(firstM[1])} ${surname.toUpperCase()}` : surname.toUpperCase();
  }

  return {
    document_metadata: {
      type: 'AVIS_IMPOSITION',
      owner_name: ownerName,
      date_emission: yearM ? yearM[1] : '',
      suggested_file_name: ctx.fileName,
    },
    financial_data: {
      monthly_net_income: rfr ? normalizeAmount(rfr / 12) : 0,
      currency: 'EUR',
      is_recurring: false,
      extra_details: {
        revenu_fiscal_reference: rfr != null ? normalizeAmount(rfr) : undefined,
        numero_fiscal: numeroFiscal,
        reference_avis: referenceAvis,
        nombre_parts: partsM ? parseFrenchNumber(partsM[1]) : undefined,
        annee_revenus: yearM ? Number(yearM[1]) : undefined,
      },
    },
    trust_and_security: { fraud_score: 0, forensic_alerts: [], math_validation: undefined },
    ai_analysis: { detected_profile: 'TAX_NOTICE', impact_on_patrimometer: 0, expert_advice: '' },
    analysisMethod: 'azure_doc_intelligence',
  };
}

/* ───────────────────────────  CNI / passeport (MRZ TD1 via layout)  ─────────────────────────── */

/** Récupère les 3 lignes MRZ TD1 (30 car.) depuis les lignes OCR, espaces retirés. */
function extractMrzTd1Lines(analyzeResult) {
  const texts = [];
  (analyzeResult.pages || []).forEach((p) => (p.lines || []).forEach((l) => texts.push(l.content)));
  if (!texts.length && analyzeResult.content) texts.push(...String(analyzeResult.content).split(/\r?\n/));
  const cands = texts
    .map((s) => String(s).replace(/\s+/g, '').toUpperCase())
    .filter((s) => s.length >= 28 && s.length <= 40 && /^[A-Z0-9<]+$/.test(s) && (s.match(/</g) || []).length >= 3);
  if (cands.length < 3) return null;
  return cands.slice(0, 3).map((s) => s.padEnd(30, '<').slice(0, 30));
}

/** "900713" → "13.07.1990" (DOB : siècle déduit) ; expiry → toujours 20YY. */
function mrzDate(yymmdd, isExpiry) {
  if (!/^\d{6}$/.test(yymmdd)) return '';
  const yy = Number(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const year = isExpiry ? 2000 + yy : (yy > 30 ? 1900 + yy : 2000 + yy);
  return `${dd}.${mm}.${year}`;
}

/** "2030-02-11" (valueDate ISO d'Azure) → "11.02.2030" (format des autres adaptateurs). */
function isoToFr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/** MRZ TD1 (CNI) → champs identité déterministes (auto-vérifiables par clés de contrôle). */
function parseMrzTd1(analyzeResult) {
  const lines = extractMrzTd1Lines(analyzeResult);
  if (!lines) return null;
  const [l1, l2, l3] = lines;
  const [surnameRaw = '', givenRaw = ''] = l3.split('<<');
  return {
    line1: l1,
    line2: l2,
    line3: l3,
    docNumber: l1.slice(5, 14).replace(/</g, ''),
    sex: l2.slice(7, 8).replace(/</g, ''),
    nationality: l2.slice(15, 18).replace(/</g, ''),
    birthDate: mrzDate(l2.slice(0, 6), false),
    expiryDate: mrzDate(l2.slice(8, 14), true),
    surname: surnameRaw.replace(/</g, ' ').trim(),
    givenNames: givenRaw.replace(/</g, ' ').trim().replace(/\s+/g, ' '),
  };
}

/** prebuilt-layout d'une CNI/passeport → rawResult (identité + MRZ pour validateMRZ). */
function mapAzureLayoutIdToRaw(analyzeResult, ctx = {}) {
  const content = analyzeResult.content || '';
  const mrz = parseMrzTd1(analyzeResult);
  const isPassport = /passeport|passport/i.test(content) || (mrz && /^P/.test(mrz.line1));

  let ownerName = '';
  if (mrz && (mrz.surname || mrz.givenNames)) {
    ownerName = `${titleCase(mrz.givenNames)} ${mrz.surname.toUpperCase()}`.trim();
  }

  // Date de délivrance (hors MRZ) depuis le visuel.
  const issueM = content.match(/d[ée]livrance[^0-9]*?(\d{2})\s+(\d{2})\s+(\d{4})/i);
  const dateEmission = issueM ? `${issueM[1]}.${issueM[2]}.${issueM[3]}` : '';

  return {
    document_metadata: {
      type: isPassport ? 'PASSEPORT' : 'CARTE_IDENTITE',
      owner_name: ownerName,
      date_emission: dateEmission,
      date_validite: mrz ? mrz.expiryDate : '',
      suggested_file_name: ctx.fileName,
    },
    financial_data: {
      monthly_net_income: 0,
      currency: 'EUR',
      is_recurring: false,
      extra_details: {
        document_number: mrz ? mrz.docNumber : undefined,
        date_naissance: mrz ? mrz.birthDate : undefined,
        nationalite: mrz ? mrz.nationality : undefined,
      },
    },
    trust_and_security: {
      fraud_score: 0,
      forensic_alerts: [],
      math_validation: undefined,
      mrz_line1: mrz ? mrz.line1 : undefined,
      mrz_line2: mrz ? mrz.line2 : undefined,
      mrz_line3: mrz ? mrz.line3 : undefined,
    },
    ai_analysis: { detected_profile: 'IDENTITY', impact_on_patrimometer: 0, expert_advice: '' },
    analysisMethod: 'azure_doc_intelligence',
  };
}

/**
 * prebuilt-idDocument (CNI/passeport) → rawResult, en remplissant le MRZ pour que
 * la vérification MRZ existante (validateMRZ) continue de tourner côté route.
 * Secours : utilisé uniquement si une ressource configure ce modèle (documents[].fields).
 */
function mapAzureIdDocumentToRaw(analyzeResult, ctx = {}) {
  const doc = (analyzeResult.documents || [])[0] || {};
  const f = doc.fields || {};
  // Champ typé : on privilégie valueString puis valueDate (ISO) puis content brut.
  const fv = (k) => (f[k] && (f[k].valueString || f[k].valueDate || f[k].content)) || '';
  const firstName = fv('FirstName');
  const lastName = fv('LastName');
  const type = String(doc.docType || '').toLowerCase().includes('passport') ? 'PASSEPORT' : 'CARTE_IDENTITE';

  // MRZ : prebuilt-idDocument n'expose PAS toujours un champ MachineReadableZone
  // (cas CNI FR) → on la reconstruit depuis les lignes OCR, présentes aussi dans
  // cette sortie. Préserve la vérification par clés de contrôle (validateMRZ).
  let mrz = parseMrzTd1(analyzeResult);
  if (!mrz && f.MachineReadableZone) {
    const lines = String(f.MachineReadableZone.valueString || f.MachineReadableZone.content || '')
      .split(/\r?\n/)
      .map((s) => s.replace(/\s+/g, '').toUpperCase())
      .filter(Boolean);
    if (lines.length >= 2) mrz = { line1: lines[0], line2: lines[1], line3: lines[2] };
  }

  const ownerName = `${firstName} ${lastName}`.trim()
    || (mrz ? `${titleCase(mrz.givenNames || '')} ${String(mrz.surname || '').toUpperCase()}`.trim() : '');

  return {
    document_metadata: {
      type,
      owner_name: ownerName,
      date_emission: isoToFr(fv('DateOfIssue')),
      date_validite: isoToFr(fv('DateOfExpiration')) || (mrz ? mrz.expiryDate : '') || '',
      suggested_file_name: ctx.fileName,
    },
    financial_data: {
      monthly_net_income: 0,
      currency: 'EUR',
      is_recurring: false,
      extra_details: {
        document_number: fv('DocumentNumber') || (mrz ? mrz.docNumber : '') || undefined,
        date_naissance: isoToFr(fv('DateOfBirth')) || (mrz ? mrz.birthDate : '') || undefined,
        nationalite: (mrz ? mrz.nationality : '') || undefined,
      },
    },
    trust_and_security: {
      fraud_score: 0,
      forensic_alerts: [],
      math_validation: undefined,
      mrz_line1: mrz ? mrz.line1 : undefined,
      mrz_line2: mrz ? mrz.line2 : undefined,
      mrz_line3: mrz ? mrz.line3 : undefined,
    },
    ai_analysis: { detected_profile: 'IDENTITY', impact_on_patrimometer: 0, expert_advice: '' },
    analysisMethod: 'azure_doc_intelligence',
  };
}

/** Dispatch adaptateur selon le modèle + le type détecté (sniff de contenu). */
function mapAzureToRaw(analyzeResult, model, ctx = {}) {
  // prebuilt-idDocument (si une ressource le configure) → champs typés.
  if (model === 'prebuilt-idDocument' && (analyzeResult.documents || []).length) {
    return mapAzureIdDocumentToRaw(analyzeResult, ctx);
  }
  const type = String(ctx.hintedType || '').toUpperCase();
  const content = norm(analyzeResult.content);
  const looksLikeId =
    type === 'CARTE_IDENTITE' || type === 'PASSEPORT' ||
    content.includes("carte nationale d'identit") ||
    content.includes('identity card') ||
    /\bid[a-z]{3}[a-z0-9<]{6,}/.test(content); // MRZ TD1 « IDFRA… »
  if (looksLikeId) return mapAzureLayoutIdToRaw(analyzeResult, ctx);
  if (type === 'AVIS_IMPOSITION' || content.includes('revenu fiscal de référence')) {
    return mapAzureAvisToRaw(analyzeResult, ctx);
  }
  return mapAzurePayslipToRaw(analyzeResult, ctx);
}

/* ─────────────────────────────  Routeur d'extraction  ───────────────────────────── */

/**
 * Extraction HYBRIDE : Azure si configuré + modèle dispo + extraction exploitable,
 * sinon GPT-4o Vision (comportement actuel = non-régression).
 *
 * @returns {Promise<{result:object, engine:'azure'|'vision'}>}
 */
async function routeExtraction({
  buffer,
  images,
  prompt,
  openaiApiKey,
  pdfMetadata,
  diditIdentity,
  fileName,
  documentCategory,
  hintedType,
}) {
  const model = pickAzureModel(documentCategory, hintedType);
  if (isAzureConfigured() && model && buffer) {
    try {
      const analyzeResult = await analyzeWithAzure(buffer, model);
      const raw = mapAzureToRaw(analyzeResult, model, { fileName, hintedType, candidateStatus: undefined });
      // Champs requis présents ? (sinon repli Vision). Pièce d'identité → nom/MRZ ;
      // document de revenus → revenu mensuel > 0.
      const t = raw.document_metadata && raw.document_metadata.type;
      const isId = t === 'CARTE_IDENTITE' || t === 'PASSEPORT';
      const hasUsefulData = isId
        ? Boolean(raw.document_metadata.owner_name || (raw.trust_and_security && raw.trust_and_security.mrz_line1))
        : Number(raw.financial_data.monthly_net_income) > 0;
      if (hasUsefulData) {
        const result = normalizeAndValidateAnalysis(raw, diditIdentity, fileName);
        if (result.trust_and_security) result.trust_and_security.analysisMethod = 'azure_doc_intelligence';
        return { result, engine: 'azure' };
      }
    } catch {
      /* erreur Azure → repli Vision (non bloquant) */
    }
  }
  const result = await analyzeWithVision(images, prompt, openaiApiKey, pdfMetadata, diditIdentity, fileName);
  return { result, engine: 'vision' };
}

module.exports = {
  isAzureConfigured,
  pickAzureModel,
  analyzeWithAzure,
  mapAzurePayslipToRaw,
  mapAzureAvisToRaw,
  mapAzureLayoutIdToRaw,
  mapAzureIdDocumentToRaw,
  parseMrzTd1,
  mapAzureToRaw,
  routeExtraction,
  parseFrenchNumber,
};
