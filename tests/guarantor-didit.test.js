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

  assert.deepEqual(filters, [
    { diditSessionId: 'sess_42' },
    { applyToken: 'apply_123', email: 'garant@exemple.com', slot: 1 },
    { applyToken: 'apply_123', email: 'garant@exemple.com' },
    { applyToken: 'apply_123', slot: 1 },
    { applyToken: 'apply_123' },
  ]);
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
      origin: 'https://doc2loc.com/',
    }),
    'https://doc2loc.com/api/webhooks/didit/guarantor'
  );

  assert.equal(
    resolveGuarantorWebhookUrl({
      configuredGuarantorWebhookUrl: 'https://hooks.example.com/didit/guarantor',
      origin: 'https://doc2loc.com/',
    }),
    'https://hooks.example.com/didit/guarantor'
  );
});
