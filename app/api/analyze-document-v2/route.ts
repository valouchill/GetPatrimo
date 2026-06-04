import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateMRZ } from '@/app/actions/validate-mrz';
import { logger } from '@/lib/server-logger';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildCategoryMismatchMessage } = require('@/src/utils/documentCertificationRules');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getPdfConversionUserMessage, isDetachedArrayBufferError, toStableBuffer } = require('@/src/utils/pdfBufferUtils');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildE2EDocumentAnalysis } = require('@/src/utils/e2eDocumentAnalysis');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { extractPDFMetadata, convertPDFToImages } = require('@/src/services/pdfDocumentService');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getExtractionPrompt } = require('@/src/services/documentPromptService');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { analyzeWithVision, buildLegacyCompatibilityPayload, normalizeAndValidateAnalysis } = require('@/src/services/visionAnalysisService');
// Module B — extraction hybride Azure OCR / Vision (repli automatique si Azure non configuré).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { routeExtraction } = require('@/src/services/azureDocIntelligenceService');
// Module D — superviseur IA documentaire (gpt-4o-mini, JSON-only). Gated DOC_SUPERVISOR_ENABLED.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { applySupervision, isSupervisorEnabled } = require('@/src/services/documentSupervisorService');
// Module C — sceau 2D-Doc fiscal (décodage libdmtx + vérif signature ANTS offline). Gated FISCAL_SEAL_VERIFICATION_ENABLED.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { analyzeFiscalSeal, isFiscalSealEnabled } = require('@/src/services/fiscalSealService');

// Polyfills pour pdfjs-dist dans Node.js 20
if (typeof globalThis.DOMMatrix === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    if (ctx && typeof ctx.getTransform === 'function') {
      globalThis.DOMMatrix = ctx.getTransform().constructor as typeof DOMMatrix;
    }
  } catch {
    // canvas non disponible
  }
}

if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 5 });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de requêtes, réessayez dans 1 minute.' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const candidateStatus = formData.get('candidateStatus') as string | null;
    const candidateName = formData.get('candidateName') as string | null;
    const originalFileName = formData.get('originalFileName') as string | null;
    const diditFirstName = formData.get('diditFirstName') as string | null;
    const diditLastName = formData.get('diditLastName') as string | null;
    const diditBirthDate = formData.get('diditBirthDate') as string | null;
    const rentAmountStr = formData.get('rentAmount') as string | null;
    const rentAmount = rentAmountStr ? parseFloat(rentAmountStr) : undefined;
    const documentCategory = formData.get('category') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    const fileName = originalFileName || file.name;

    if (process.env.E2E_TEST_MODE === 'true') {
      const e2eResult = buildE2EDocumentAnalysis({
        fileName, candidateStatus, candidateName,
        diditIdentity: { firstName: diditFirstName, lastName: diditLastName, birthDate: diditBirthDate },
        rentAmount,
      });
      return NextResponse.json({
        ...e2eResult,
        ...buildLegacyCompatibilityPayload(e2eResult, documentCategory),
        originalFileName: fileName,
      });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Configuration serveur incomplète: clé API OpenAI manquante' }, { status: 500 });
    }

    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const buffer = toStableBuffer(await file.arrayBuffer());
    const fileSizeMB = file.size / (1024 * 1024);

    if (fileSizeMB > 10) {
      logger.warn('Fichier volumineux', { sizeMB: fileSizeMB.toFixed(2) });
    }

    // Vérifier le header PDF
    if (isPDF) {
      const uint8Array = new Uint8Array(buffer);
      const pdfHeader = Array.from(uint8Array.slice(0, 4)).map(b => String.fromCharCode(b)).join('');
      if (pdfHeader !== '%PDF') {
        const msg = `Le fichier "${fileName}" ne semble pas être un PDF valide.`;
        return NextResponse.json({
          document_metadata: { type: 'AUTRE', owner_name: '', is_owner_match: false, date_emission: '', suggested_file_name: fileName },
          financial_data: { monthly_net_income: 0, currency: 'EUR', is_recurring: false, extra_details: {} },
          trust_and_security: { fraud_score: 0, forensic_alerts: ['Header PDF invalide'], math_validation: false },
          ai_analysis: { detected_profile: 'UNKNOWN', impact_on_patrimometer: 0, expert_advice: msg },
          documentType: 'AUTRE', ownerName: '', date: '', suggestedFileName: fileName,
          confidenceScore: 0, recommendations: [msg],
          fraudIndicators: { suspicious: false, reasons: ['Header PDF invalide'] },
          fraudScore: 0, categoryMatch: false,
          categoryMismatchReason: buildCategoryMismatchMessage(documentCategory, 'AUTRE'),
          originalFileName: fileName, isIllegible: true, errorMessage: msg,
        });
      }
    }

    let images: string[] = [];
    let pdfMetadata: { creator?: string; producer?: string; suspicious: boolean; details: string[] } | undefined;

    if (isPDF) {
      try {
        pdfMetadata = await extractPDFMetadata(buffer);
      } catch {
        // métadonnées non critiques
      }

      let conversionError: Error | null = null;
      try {
        images = await convertPDFToImages(buffer, 3, 200);
      } catch (error) {
        conversionError = error instanceof Error ? error : new Error(String(error));

        // Fallback 1: extraction de texte
        try {
          const pdfParse = (await import('pdf-parse')).default;
          const data = await pdfParse(Buffer.from(buffer));
          if (data.text && data.text.trim().length > 50) {
            const prompt = getExtractionPrompt(
              candidateStatus || undefined, candidateName || undefined,
              { firstName: diditFirstName, lastName: diditLastName, birthDate: diditBirthDate },
              documentCategory || undefined
            );
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: `${prompt}\n\n--- CONTENU DU DOCUMENT ---\n${data.text.substring(0, 15000)}` }],
                max_tokens: 4000, temperature: 0.1, response_format: { type: 'json_object' },
              }),
            });
            if (response.ok) {
              const aiData = await response.json();
              const resultText = aiData.choices?.[0]?.message?.content || '{}';
              let rawResult: any;
              try { rawResult = JSON.parse(resultText); } catch {
                const m = resultText.match(/\{[\s\S]*\}/);
                rawResult = m ? JSON.parse(m[0]) : null;
              }
              if (rawResult) {
                const result = normalizeAndValidateAnalysis(rawResult, { firstName: diditFirstName, lastName: diditLastName, birthDate: diditBirthDate }, fileName);
                return NextResponse.json({ ...result, originalFileName: fileName, analysisMethod: 'text_extraction' });
              }
            }
          }
        } catch { /* fallback échoué */ }

        // Fallback 2: très basse résolution
        try {
          images = await convertPDFToImages(buffer, 1, 72);
        } catch { /* ignore */ }
      }

      if (images.length === 0) {
        const userMessage = getPdfConversionUserMessage(conversionError);
        return NextResponse.json({
          document_metadata: { type: 'AUTRE', owner_name: '', is_owner_match: false, date_emission: '', suggested_file_name: fileName },
          financial_data: { monthly_net_income: 0, currency: 'EUR', is_recurring: false, extra_details: {} },
          trust_and_security: { fraud_score: 0, forensic_alerts: [`Impossible d'analyser le PDF: ${userMessage.details}`], math_validation: false },
          ai_analysis: { detected_profile: 'UNKNOWN', impact_on_patrimometer: 0, expert_advice: userMessage.advice },
          originalFileName: fileName, isIllegible: true,
          errorMessage: isDetachedArrayBufferError(conversionError)
            ? `Erreur interne de conversion PDF. Réessayez ou convertissez en image JPG/PNG.`
            : `PDF non analysable. Raison: ${userMessage.details}. Essayez une image JPG/PNG.`,
        });
      }
    } else {
      const base64 = buffer.toString('base64');
      let mimeType = 'image/jpeg';
      if (file.type.includes('png')) mimeType = 'image/png';
      if (file.type.includes('webp')) mimeType = 'image/webp';
      images = [`data:${mimeType};base64,${base64}`];
    }

    if (images.length === 0) {
      return NextResponse.json({ documentType: 'Inconnu', ownerName: '', date: '', suggestedFileName: fileName, confidenceScore: 0, isIllegible: true, errorMessage: 'Format non supporté.', originalFileName: fileName });
    }

    const diditIdentity = { firstName: diditFirstName, lastName: diditLastName, birthDate: diditBirthDate };
    const prompt = getExtractionPrompt(candidateStatus || undefined, candidateName || undefined, diditIdentity, documentCategory || undefined);

    const extraction = await routeExtraction({
      buffer,
      images,
      prompt,
      openaiApiKey: OPENAI_API_KEY,
      pdfMetadata,
      diditIdentity,
      fileName,
      documentCategory,
      hintedType: undefined,
    });
    let result = extraction.result;

    if (!result.trust_and_security.forensic_alerts) result.trust_and_security.forensic_alerts = [];

    // Ajustement : métadonnées PDF suspectes
    if (pdfMetadata?.suspicious) {
      result.trust_and_security.fraud_score = Math.min(100, (result.trust_and_security.fraud_score || 0) + 50);
      result.trust_and_security.forensic_alerts.push('PDF créé ou modifié avec un logiciel de design – analyse sous doute renforcé.');
    }

    // Audit mathématique strict côté backend
    const extra = result.financial_data.extra_details;
    if (extra && typeof extra.salaire_brut_mensuel === 'number' && typeof extra.cotisations_mensuelles === 'number' && typeof result.financial_data.monthly_net_income === 'number') {
      const diff = Math.abs((extra.salaire_brut_mensuel - extra.cotisations_mensuelles) - result.financial_data.monthly_net_income);
      if (Number.isFinite(diff)) {
        if (diff > 0.5) {
          result.trust_and_security.math_validation = false;
          result.trust_and_security.fraud_score = Math.min(100, (result.trust_and_security.fraud_score || 0) + 30);
          result.trust_and_security.forensic_alerts.push(`Écart de ${diff.toFixed(2).replace('.', ',')}€ entre Brut - Cotisations et Net (>0,50€ de tolérance).`);
        } else if (result.trust_and_security.math_validation === undefined) {
          result.trust_and_security.math_validation = true;
        }
      }
    }

    // Audit MRZ garant
    if (documentCategory === 'guarantor' && result.document_metadata.type === 'CARTE_IDENTITE') {
      const ts = result.trust_and_security;
      const line1 = ts.mrz_line1?.trim();
      const line2 = ts.mrz_line2?.trim();
      if (line1 && line2) {
        try {
          const mrzResult = await validateMRZ(line1, line2, ts.mrz_line3?.trim() || undefined);
          ts.mrz_validated = mrzResult.isValid;
          if (!mrzResult.isValid) {
            result.trust_and_security.fraud_score = Math.min(100, (result.trust_and_security.fraud_score || 0) + 40);
            result.trust_and_security.forensic_alerts.push('Garant : MRZ invalide (checksums échoués).');
          } else {
            result.trust_and_security.forensic_alerts.push('✅ Garant : MRZ validée (checksums OK).');
          }
        } catch {
          ts.mrz_validated = false;
          result.trust_and_security.fraud_score = Math.min(100, (result.trust_and_security.fraud_score || 0) + 40);
          result.trust_and_security.forensic_alerts.push('Garant : erreur validation MRZ.');
        }
      } else {
        ts.mrz_validated = false;
        result.trust_and_security.fraud_score = Math.min(100, (result.trust_and_security.fraud_score || 0) + 30);
        result.trust_and_security.forensic_alerts.push('Garant : MRZ non extraite – document suspect.');
      }
    }

    // ─── Module C — Sceau 2D-Doc fiscal (avis d'imposition) ───
    // Décode le DataMatrix (libdmtx) + vérifie la signature ECDSA contre la TSL ANTS
    // embarquée (lib MIT betagouv/2ddoc-parser, HORS-LIGNE, sans API ANTS), puis
    // RECOUPE les valeurs scellées (RFR, n° fiscal, référence) avec l'OCR (Module B).
    // Gated FISCAL_SEAL_VERIFICATION_ENABLED ⇒ OFF (défaut) = réponse byte-identique.
    if (isFiscalSealEnabled() && result.document_metadata.type === 'AVIS_IMPOSITION') {
      const ed = result.financial_data.extra_details || {};
      const fiscal = await analyzeFiscalSeal({
        images,
        ocr: { rfr: ed.revenu_fiscal_reference, numeroFiscal: ed.numero_fiscal, referenceAvis: ed.reference_avis },
      });
      if (fiscal && fiscal.seal) {
        result.trust_and_security.fiscal_seal_status = fiscal.seal.signatureValid
          ? 'SIGNATURE_VALIDE'
          : 'SIGNATURE_NON_VERIFIEE';
        if (fiscal.cross.anyMismatch) {
          // Valeur(s) scellée(s) ≠ document : édition probable → signal de fraude FORT.
          result.trust_and_security.forensic_alerts.push(
            `❌ Sceau fiscal 2D-Doc : divergence ${fiscal.cross.mismatches.join(', ')} (valeur scellée ≠ document).`,
          );
          result.trust_and_security.fraud_score = Math.min(100, (result.trust_and_security.fraud_score || 0) + 40);
        } else if (fiscal.seal.signatureValid && fiscal.cross.anyConfirmation) {
          result.trust_and_security.digital_seal_authenticated = true;
          result.trust_and_security.forensic_alerts.push('✅ Sceau fiscal 2D-Doc authentifié (signature ANTS valide, RFR concordant).');
          result.trust_and_security.fraud_score = Math.max(0, (result.trust_and_security.fraud_score || 0) - 10);
        } else if (fiscal.cross.anyConfirmation) {
          result.trust_and_security.forensic_alerts.push('ℹ️ Sceau fiscal 2D-Doc décodé, valeurs concordantes (signature non vérifiée).');
        }
      }
    }

    if (result.trust_and_security.fraud_score > 30) {
      return NextResponse.json({
        ...result,
        ...buildLegacyCompatibilityPayload(result, documentCategory),
        originalFileName: fileName,
        analysisMethod: isPDF ? 'pdf_to_image_vision' : 'direct_vision',
        requiresManualReview: true,
        reviewReason: `Score de fraude élevé (${result.trust_and_security.fraud_score}/100).`,
      });
    }

    // Vérification Visale + sceau 2D-Doc
    if (result.document_metadata.type === 'CERTIFICAT_VISALE' && result.financial_data.extra_details?.visale) {
      const visaleData = result.financial_data.extra_details.visale;
      if (images.length > 0) {
        try {
          const { verify2DDocSeal } = await import('@/app/utils/2d-doc-decoder');
          let sealVerified = false;
          for (const image of images) {
            const verificationResult = await verify2DDocSeal(image, diditIdentity);
            if (verificationResult.decoded && verificationResult.signatureValid) {
              sealVerified = true;
              const decodedData = verificationResult.data;
              if (decodedData) {
                visaleData.code_2d_doc = 'SCEAU_2D_DOC_DECODE';
                visaleData.code_2d_doc_valide = true;
                if (decodedData.numeroVisa && !visaleData.numero_visa) visaleData.numero_visa = decodedData.numeroVisa;
                if (decodedData.dateEmission && !visaleData.date_validite) visaleData.date_validite = decodedData.dateEmission;
                if (decodedData.loyerMaximumGaranti && !visaleData.loyer_maximum_garanti) visaleData.loyer_maximum_garanti = decodedData.loyerMaximumGaranti;
                if (verificationResult.signatureValid && verificationResult.matchesDiditIdentity) {
                  result.trust_and_security.digital_seal_authenticated = true;
                  result.trust_and_security.digital_seal_status = 'AUTHENTIFIÉ_PAR_SCELLEMENT_NUMÉRIQUE';
                  result.trust_and_security.forensic_alerts.push('✅ AUTHENTIFIÉ PAR SCELLEMENT NUMÉRIQUE 2D-Doc');
                  result.trust_and_security.fraud_score = Math.max(0, result.trust_and_security.fraud_score - 20);
                  result.ai_analysis.expert_advice = `✅ Certificat Visale authentifié par sceau numérique. ${result.ai_analysis.expert_advice}`;
                } else if (verificationResult.signatureValid && !verificationResult.matchesDiditIdentity) {
                  result.trust_and_security.digital_seal_authenticated = false;
                  result.trust_and_security.digital_seal_status = 'NOM_NON_CORRESPONDANT';
                  result.trust_and_security.forensic_alerts.push('⚠️ Sceau 2D-Doc valide mais nom ne correspond pas à l\'identité Didit');
                } else {
                  result.trust_and_security.digital_seal_authenticated = false;
                  result.trust_and_security.digital_seal_status = 'SIGNATURE_INVALIDE';
                  result.trust_and_security.forensic_alerts.push('❌ Signature 2D-Doc invalide – Document suspect');
                  result.trust_and_security.fraud_score = Math.min(100, (result.trust_and_security.fraud_score || 0) + 40);
                }
              }
              break;
            }
          }
          if (!sealVerified) {
            // NEUTRE tant que la vérification cryptographique n'est pas opérationnelle :
            // le décodeur actuel (jsQR) ne lit pas le DataMatrix des 2D-Doc, donc
            // « non décodé » ≠ « falsifié ». On ne pénalise PLUS un Visale légitime.
            // Le vrai signal (sceau décodé MAIS signature/recoupement invalide) sera
            // ré-introduit avec Module C (lecteur DataMatrix + certificats publics).
            result.trust_and_security.digital_seal_authenticated = false;
            result.trust_and_security.digital_seal_status = 'NON_VERIFIE';
            result.trust_and_security.forensic_alerts.push('ℹ️ Sceau 2D-Doc non vérifié (vérification cryptographique indisponible) — non bloquant.');
          }
        } catch (error) {
          logger.error('Erreur décodage sceau 2D-Doc', { error: error instanceof Error ? error.message : error });
          result.trust_and_security.forensic_alerts.push('⚠️ Erreur lors du décodage du sceau 2D-Doc');
        }
      }

      if (rentAmount && visaleData.loyer_maximum_garanti > 0) {
        const { generateVisaleAlert } = await import('@/app/utils/visale-verification');
        const alert = generateVisaleAlert(visaleData, rentAmount);
        if (alert) {
          result.ai_analysis.visale_alert = alert;
          result.ai_analysis.expert_advice = `${result.ai_analysis.expert_advice} ${alert}`;
        }
      }
    }

    // ─── Module D — Superviseur IA documentaire (gpt-4o-mini, JSON-only) ───
    // Orchestration A→B→C→D : reçoit UNIQUEMENT le JSON déterministe déjà assemblé
    // (forensic Module A via pdfMetadata, OCR Module B, sceau Module C) — jamais
    // d'image. N'attribue AUCUNE note : ajoute seulement expert_advice + alertes +
    // needs_human_review. Le grade et le fraud_score restent 100 % déterministes.
    // Flag OFF (défaut) ⇒ bloc ignoré ⇒ réponse byte-identique (non-régression).
    if (isSupervisorEnabled()) {
      await applySupervision(result, pdfMetadata, { openaiApiKey: OPENAI_API_KEY, fileName });
    }

    const needsHumanReview = result.trust_and_security.needs_human_review ||
      result.trust_and_security.partial_extraction ||
      (result.trust_and_security.fraud_score > 20 && result.trust_and_security.fraud_score <= 50);

    const extractedFields = result.trust_and_security.extracted_fields ||
      Object.entries(result.document_metadata).filter(([, v]) => v && v !== '').map(([k]) => k);

    const anomalies: string[] = [...(result.trust_and_security.forensic_alerts || [])];

    return NextResponse.json({
      ...result,
      ...buildLegacyCompatibilityPayload(result, documentCategory),
      originalFileName: fileName,
      analysisMethod: isPDF ? 'pdf_to_image_vision' : 'direct_vision',
      needsHumanReview,
      humanReviewReason: result.trust_and_security.human_review_reason,
      partialExtraction: result.trust_and_security.partial_extraction,
      extractedFields,
      improvementTip: result.ai_analysis.improvement_tip,
      expertAdvice: result.ai_analysis.expert_advice,
      anomalies,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    const isTimeout = errorMessage === 'AI_TIMEOUT';
    const isOpenAIError = errorMessage.startsWith('Erreur OpenAI');

    if (isTimeout || isOpenAIError) {
      return NextResponse.json(
        {
          status: 'delayed',
          message: "Analyse mise en file d'attente. Votre document a bien été reçu et sera analysé sous peu.",
          document_metadata: { type: 'PENDING', status: 'pending_manual_review' },
          ai_analysis: { fraud_score: 0, expert_advice: 'Le document a été reçu et sera analysé manuellement.' },
          financial_data: {},
          trust_and_security: { fraud_score: 0, forensic_alerts: [] },
        },
        { status: 202 }
      );
    }

    logger.error('Erreur analyse V2', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { error: 'Une erreur technique est survenue.', isIllegible: true, errorMessage: 'Une erreur technique est survenue. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}
