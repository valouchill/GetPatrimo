const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isSupervisorEnabled,
  collectFacts,
  buildSupervisorPrompt,
  SUPERVISOR_JSON_SCHEMA,
  coerceSupervision,
  mergeSupervision,
  superviseDocument,
} = require('../src/services/documentSupervisorService');

// Résultat normalisé type (forme du contrat A+B) pour une fiche de paie.
function payslipResult() {
  return {
    document_metadata: { type: 'BULLETIN_SALAIRE', owner_name: 'Valentin VETTESE', date_emission: '30.04.2026' },
    financial_data: {
      monthly_net_income: 3012.71,
      currency: 'EUR',
      is_recurring: true,
      extra_details: {
        salaire_brut_mensuel: 4131.45,
        cotisations_mensuelles: 927.93,
        net_fiscal: 3359.07,
        net_social: 3203.52,
        net_a_payer: 3012.71,
      },
    },
    trust_and_security: { fraud_score: 0, forensic_alerts: [], math_validation: true },
    ai_analysis: { detected_profile: 'SALARIED', impact_on_patrimometer: 0, expert_advice: '' },
  };
}

test('isSupervisorEnabled reflects DOC_SUPERVISOR_ENABLED', () => {
  const save = process.env.DOC_SUPERVISOR_ENABLED;
  try {
    delete process.env.DOC_SUPERVISOR_ENABLED;
    assert.equal(isSupervisorEnabled(), false);
    process.env.DOC_SUPERVISOR_ENABLED = 'true';
    assert.equal(isSupervisorEnabled(), true);
    process.env.DOC_SUPERVISOR_ENABLED = '1';
    assert.equal(isSupervisorEnabled(), false, 'seul "true" active');
  } finally {
    if (save === undefined) delete process.env.DOC_SUPERVISOR_ENABLED;
    else process.env.DOC_SUPERVISOR_ENABLED = save;
  }
});

test('collectFacts pulls deterministic facts from the normalized JSON (+ Module A forensic)', () => {
  const f = collectFacts(payslipResult(), {
    isAltered: true,
    reasons: ['Logiciel de retouche détecté : Photoshop'],
    creator: 'Adobe Photoshop',
    producer: 'Adobe Photoshop 25.0',
  });
  assert.equal(f.type, 'BULLETIN_SALAIRE');
  assert.equal(f.brut, 4131.45);
  assert.equal(f.cotisations, 927.93);
  assert.equal(f.netSocial, 3203.52);
  assert.equal(f.monthlyNet, 3012.71);
  assert.equal(f.mathValidation, true);
  assert.equal(f.isAltered, true);
  assert.deepEqual(f.forensicReasons, ['Logiciel de retouche détecté : Photoshop']);
  // Supporte aussi la forme legacy {suspicious, details}
  const legacy = collectFacts(payslipResult(), { suspicious: true, details: ['x'] });
  assert.equal(legacy.isAltered, true);
  assert.deepEqual(legacy.forensicReasons, ['x']);
});

test('buildSupervisorPrompt is image-free, forbids re-scoring, and carries the numbers', () => {
  const { system, user } = buildSupervisorPrompt(payslipResult(), { isAltered: false });
  // Garde-fous "JSON-only" / "pas de note"
  assert.match(system, /aucune image/i);
  assert.match(system, /N'ATTRIBUES JAMAIS de note/i);
  // Les chiffres déterministes sont bien transmis
  assert.match(user, /aucune image fournie/i);
  assert.match(user, /4131\.45/);
  assert.match(user, /927\.93/);
  assert.match(user, /3203\.52/);
  assert.match(user, /Contrôle math Brut − Cotisations = Net social : OK/);
});

test('coerceSupervision normalizes/clamps a raw LLM object', () => {
  const v = coerceSupervision({
    documentType: 'BULLETIN_SALAIRE',
    checks: [
      { name: 'Math URSSAF', status: 'VERIFIED', detail: 'Brut − Cotisations = Net social (exact).' },
      { name: 'Ordre des nets', status: 'BOGUS', detail: 'ok' }, // statut invalide → WARNING
      { name: '', status: 'ALERT', detail: 'sans nom' }, // filtré (pas de nom)
    ],
    consistency: { mathConsistent: true, valuesCoherent: true },
    needsHumanReview: false,
    expertAdvice: 'Dossier cohérent, aucune anomalie détectée.',
  });
  assert.equal(v.documentType, 'BULLETIN_SALAIRE');
  assert.equal(v.checks.length, 2);
  assert.equal(v.checks[1].status, 'WARNING'); // statut inconnu corrigé
  assert.equal(v.consistency.mathConsistent, true);
  assert.equal(v.needsHumanReview, false);
  assert.match(v.expertAdvice, /cohérent/);
  // entrée non-objet → null
  assert.equal(coerceSupervision(null), null);
  assert.equal(coerceSupervision('x'), null);
});

test('mergeSupervision is NON-destructive: deterministic fields untouched, only additions', () => {
  const result = payslipResult();
  result.trust_and_security.forensic_alerts.push('Alerte déterministe existante');
  const verdict = coerceSupervision({
    documentType: 'BULLETIN_SALAIRE',
    checks: [
      { name: 'Math URSSAF', status: 'VERIFIED', detail: 'Exact.' },
      { name: 'Métadonnées', status: 'WARNING', detail: 'Producteur inhabituel.' },
    ],
    consistency: { mathConsistent: true, valuesCoherent: true },
    needsHumanReview: true,
    expertAdvice: 'Vérifiez le producteur du PDF avant validation.',
  });

  const merged = mergeSupervision(result, verdict);

  // Déterministe INTACT
  assert.equal(merged.trust_and_security.fraud_score, 0);
  assert.equal(merged.trust_and_security.math_validation, true);
  assert.equal(merged.financial_data.monthly_net_income, 3012.71);
  // Conseil UX posé
  assert.equal(merged.ai_analysis.expert_advice, 'Vérifiez le producteur du PDF avant validation.');
  // Alerte déterministe conservée + seule la non-VERIFIED ajoutée
  assert.ok(merged.trust_and_security.forensic_alerts.includes('Alerte déterministe existante'));
  assert.equal(merged.trust_and_security.forensic_alerts.some((a) => /Métadonnées \(WARNING\)/.test(a)), true);
  assert.equal(merged.trust_and_security.forensic_alerts.some((a) => /Math URSSAF/.test(a)), false, 'VERIFIED non ajouté');
  // Revue humaine levée
  assert.equal(merged.trust_and_security.needs_human_review, true);

  // Idempotence : pas de doublon au second merge
  mergeSupervision(merged, verdict);
  const count = merged.trust_and_security.forensic_alerts.filter((a) => /Métadonnées \(WARNING\)/.test(a)).length;
  assert.equal(count, 1);
});

test('mergeSupervision never lowers an existing needs_human_review', () => {
  const result = payslipResult();
  result.trust_and_security.needs_human_review = true;
  const verdict = coerceSupervision({
    documentType: 'BULLETIN_SALAIRE',
    checks: [{ name: 'OK', status: 'VERIFIED', detail: 'ok' }],
    consistency: { mathConsistent: true, valuesCoherent: true },
    needsHumanReview: false,
    expertAdvice: 'RAS.',
  });
  mergeSupervision(result, verdict);
  assert.equal(result.trust_and_security.needs_human_review, true);
});

test('superviseDocument is a no-op (null, no network) when disabled', async () => {
  const save = process.env.DOC_SUPERVISOR_ENABLED;
  try {
    delete process.env.DOC_SUPERVISOR_ENABLED;
    const v = await superviseDocument(payslipResult(), {}, { openaiApiKey: 'sk-should-not-be-used' });
    assert.equal(v, null);
  } finally {
    if (save === undefined) delete process.env.DOC_SUPERVISOR_ENABLED;
    else process.env.DOC_SUPERVISOR_ENABLED = save;
  }
});

test('SUPERVISOR_JSON_SCHEMA is strict and has no grade/score field', () => {
  assert.equal(SUPERVISOR_JSON_SCHEMA.additionalProperties, false);
  const props = Object.keys(SUPERVISOR_JSON_SCHEMA.properties);
  assert.deepEqual(props.sort(), ['checks', 'consistency', 'documentType', 'expertAdvice', 'needsHumanReview']);
  // Aucun champ de notation : le grade reste déterministe hors-LLM.
  assert.equal(/score|grade|note/i.test(JSON.stringify(SUPERVISOR_JSON_SCHEMA.properties)), false);
});
