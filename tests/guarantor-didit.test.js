const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildGuarantorLookupFilters,
  normalizeDiditSessionPayload,
  resolveGuarantorWebhookUrl,
} = require('../src/utils/guarantorDidit');

test('buildGuarantorLookupFilters prioritizes the precise guarantor context', () => {
  const filters = buildGuarantorLookupFilters({
    applyToken: 'apply_123',
    sessionId: 'sess_42',
    email: 'Garant@Exemple.com',
    slot: '1',
  });

  // Sécurité (pentest access-1/2, public-5) : un applyToken (partagé entre tous les
  // candidats d'un bien) ne doit JAMAIS résoudre un garant tiers → seuls les filtres
  // incluant un identifiant propre à la personne (email/diditSessionId) sont autorisés.
  assert.deepEqual(filters, [
    { diditSessionId: 'sess_42' },
    { applyToken: 'apply_123', email: 'garant@exemple.com', slot: 1 },
    { applyToken: 'apply_123', email: 'garant@exemple.com' },
  ]);
});

test('SÉCURITÉ — buildGuarantorLookupFilters refuse de résoudre par applyToken seul', () => {
  // Sans email ni sessionId, un applyToken seul ne doit produire AUCUN filtre catch-all
  // (sinon fuite de PII d'un garant tiers du même bien).
  const onlyToken = buildGuarantorLookupFilters({ applyToken: 'apply_123' });
  assert.deepEqual(onlyToken, [], 'applyToken seul ne doit produire aucun filtre');

  // applyToken + slot seul (numéro 1/2) ne doit pas matcher un tiers non plus.
  const tokenSlot = buildGuarantorLookupFilters({ applyToken: 'apply_123', slot: '2' });
  assert.deepEqual(tokenSlot, [], 'applyToken+slot seul ne doit produire aucun filtre');

  // Aucun filtre produit ne doit jamais contenir applyToken sans email/diditSessionId.
  const all = buildGuarantorLookupFilters({ applyToken: 'apply_123', email: 'g@x.io', slot: '1' });
  for (const f of all) {
    if ('applyToken' in f) {
      assert.ok('email' in f, `filtre avec applyToken DOIT inclure email: ${JSON.stringify(f)}`);
    }
  }
});

test('normalizeDiditSessionPayload accepts approved v3 decisions', () => {
  const result = normalizeDiditSessionPayload({
    status: 'approved',
    decision: {
      id_verifications: [
        {
          first_name: 'Claire',
          last_name: 'Martin',
          date_of_birth: '1985-07-11',
        },
      ],
    },
  });

  assert.equal(result.verified, true);
  assert.equal(result.firstName, 'Claire');
  assert.equal(result.lastName, 'Martin');
  assert.equal(result.birthDate, '1985-07-11');
});

test('resolveGuarantorWebhookUrl defaults to the dedicated guarantor webhook', () => {
  assert.equal(
    resolveGuarantorWebhookUrl({
      configuredGuarantorWebhookUrl: '',
      origin: 'https://maisonpatrimo.com/',
    }),
    'https://maisonpatrimo.com/api/webhooks/didit/guarantor'
  );

  assert.equal(
    resolveGuarantorWebhookUrl({
      configuredGuarantorWebhookUrl: 'https://hooks.example.com/didit/guarantor',
      origin: 'https://maisonpatrimo.com/',
    }),
    'https://hooks.example.com/didit/guarantor'
  );
});
