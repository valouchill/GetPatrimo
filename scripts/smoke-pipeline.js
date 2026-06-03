#!/usr/bin/env node
/**
 * Smoke-test du Pipeline Hybride (Modules A → B → D) sur un VRAI document.
 *
 * Valide, avec TES propres clés (lues dans l'environnement, jamais en dur), que :
 *   - Azure Document Intelligence est bien configuré en région UE (RGPD) ;
 *   - l'OCR déterministe (Module B) extrait les bons chiffres ;
 *   - le superviseur (Module D) recoupe le JSON et conseille (si activé).
 *
 * Lecture seule : aucune écriture, aucune base de données mutée. Deux appels API
 * payants au plus (Azure ~0,01 €/page, gpt-4o-mini ~0,001 €). Ne déploie rien.
 *
 * Usage :
 *   AZURE_DOC_INTELLIGENCE_ENDPOINT="https://<ressource>.cognitiveservices.azure.com/" \
 *   AZURE_DOC_INTELLIGENCE_KEY="<clé>" \
 *   AZURE_DOC_INTELLIGENCE_REGION="westeurope" \   # OBLIGATOIRE si l'hôte ne contient pas la région
 *   DOC_SUPERVISOR_ENABLED=true OPENAI_API_KEY="<clé>" \   # facultatif (Module D)
 *   node scripts/smoke-pipeline.js <chemin/vers/document.pdf> [--type BULLETIN_SALAIRE|AVIS_IMPOSITION|CARTE_IDENTITE]
 */

const fs = require('fs');
const path = require('path');

const azure = require('../src/services/azureDocIntelligenceService');
const supervisor = require('../src/services/documentSupervisorService');

function getFlag(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith('--')) {
    console.error('Usage : node scripts/smoke-pipeline.js <document> [--type BULLETIN_SALAIRE|AVIS_IMPOSITION|CARTE_IDENTITE]');
    process.exit(2);
  }
  const hintedType = getFlag('--type');

  // ── 1) Diagnostic Azure (région UE / RGPD) ───────────────────────────────
  console.log('\n=== 1) Configuration Azure (RGPD / région UE) ===');
  console.log('  ENDPOINT :', process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT ? 'présent' : 'ABSENT');
  console.log('  KEY      :', process.env.AZURE_DOC_INTELLIGENCE_KEY ? 'présent' : 'ABSENT');
  console.log('  REGION   :', process.env.AZURE_DOC_INTELLIGENCE_REGION || '(non défini)');
  console.log('  KILL-SW  :', process.env.AZURE_OCR_DISABLED || '(non défini)');
  const configured = azure.isAzureConfigured();
  console.log('  → isAzureConfigured() =', configured);
  if (!configured) {
    console.log('\n⚠  Azure NON activé → le pipeline retomberait sur GPT-4o Vision.');
    console.log('   Si ton endpoint est du type *.cognitiveservices.azure.com (sans région dans');
    console.log('   l\'hôte), tu DOIS définir AZURE_DOC_INTELLIGENCE_REGION = ta région UE');
    console.log('   (ex : westeurope, francecentral, northeurope…). Sinon le garde-fou RGPD bloque.');
    process.exit(1);
  }

  const buffer = fs.readFileSync(path.resolve(file));
  const isPDF = buffer.subarray(0, 5).toString('latin1') === '%PDF-';

  // ── 2) Module A — Forensic métadonnées (si PDF) ──────────────────────────
  let forensic = {};
  if (isPDF) {
    try {
      const { extractPDFMetadata } = require('../src/services/pdfDocumentService');
      forensic = (await extractPDFMetadata(buffer)) || {};
    } catch (e) {
      console.log('  (Module A indisponible :', e.message, ')');
    }
  }
  console.log('\n=== 2) Module A — Forensic métadonnées ===');
  console.log('  altéré/suspect :', Boolean(forensic.isAltered ?? forensic.suspicious));
  console.log('  créateur/prod. :', (forensic.creator || '-'), '/', (forensic.producer || '-'));
  const reasons = forensic.reasons || forensic.details || [];
  if (reasons.length) console.log('  indices        :', reasons.join(' ; '));

  // ── 3) Module B — OCR Azure déterministe ─────────────────────────────────
  const model = azure.pickAzureModel(undefined, hintedType) || 'prebuilt-layout';
  console.log(`\n=== 3) Module B — OCR Azure (${model}) ===`);
  const analyzeResult = await azure.analyzeWithAzure(buffer, model);
  const raw = azure.mapAzureToRaw(analyzeResult, model, { fileName: path.basename(file), hintedType });
  const dm = raw.document_metadata;
  const fd = raw.financial_data;
  const ed = fd.extra_details || {};
  const ts = raw.trust_and_security;
  console.log('  type                 :', dm.type);
  console.log('  titulaire            :', dm.owner_name || '-');
  console.log('  émission / validité  :', (dm.date_emission || '-'), '/', (dm.date_validite || '-'));
  console.log('  revenu net mensuel   :', fd.monthly_net_income);
  console.log('  extra_details        :', JSON.stringify(ed));
  console.log('  math_validation      :', ts.math_validation);
  if (ts.mrz_line1) console.log('  MRZ line1            :', ts.mrz_line1);
  console.log('  engine               : azure');

  // ── 4) Module D — Superviseur (gpt-4o-mini, JSON-only) ───────────────────
  console.log('\n=== 4) Module D — Superviseur (gpt-4o-mini, JSON-only) ===');
  if (!supervisor.isSupervisorEnabled()) {
    console.log('  DOC_SUPERVISOR_ENABLED != "true" → superviseur ignoré (no-op).');
  } else if (!process.env.OPENAI_API_KEY) {
    console.log('  OPENAI_API_KEY absent → superviseur ignoré.');
  } else {
    const { verdict } = await supervisor.applySupervision(raw, forensic, { fileName: path.basename(file) });
    if (!verdict) {
      console.log('  Verdict null (erreur/timeout/non-200) — le pipeline ne casse pas (fire-and-forget).');
    } else {
      console.log('  documentType         :', verdict.documentType);
      console.log('  consistency          :', JSON.stringify(verdict.consistency));
      console.log('  needsHumanReview     :', verdict.needsHumanReview);
      console.log('  checks               :');
      verdict.checks.forEach((c) => console.log(`    - [${c.status}] ${c.name} : ${c.detail}`));
      console.log('  → expert_advice fusionné :', raw.ai_analysis.expert_advice);
      console.log('  → forensic_alerts        :', JSON.stringify(ts.forensic_alerts));
    }
  }

  // ── 5) Coûts (cockpit) ───────────────────────────────────────────────────
  const perPage = Number(process.env.AZURE_DOC_INTELLIGENCE_PRICE_EUR_PER_PAGE || 0.01);
  const pages = (analyzeResult.pages && analyzeResult.pages.length) || 1;
  console.log('\n=== 5) Coûts ===');
  console.log(`  Azure OCR : ~${(perPage * pages).toFixed(4)} € (${pages} page(s)) → cockpit catégorie "OCR"`);
  console.log('  Superviseur : ligne "LLM_SUPERVISOR" / gpt-4o-mini dans ApiCostLog (si DB connectée).');
  console.log('  NB : hors application, le log de coût (Mongo) est best-effort — l\'extraction, elle, est validée ci-dessus.');
  console.log('\n✅ Smoke terminé.');
}

main().catch((e) => {
  console.error('\n❌ Smoke échec :', e && e.message ? e.message : e);
  process.exit(1);
});
