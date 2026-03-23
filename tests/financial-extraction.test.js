const test = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveApplicationFinancialProfile,
  pickBestDocumentNetIncome,
} = require('../src/utils/financialExtraction');

test('pickBestDocumentNetIncome prefers the actual payslip net over gross or annual totals', () => {
  const resolved = pickBestDocumentNetIncome({
    documentType: 'BULLETIN_SALAIRE',
    financialData: {
      monthly_net_income: 3200,
      extra_details: {
        salaire_brut_mensuel: 3200,
        cotisations_mensuelles: 650,
      },
    },
    extractedData: {
      montants: [3200, 2550, 8120],
      salaireNet: 0,
      salaireBrut: 3200,
      cotisations: 650,
    },
  });

  assert.equal(resolved.amount, 2550);
  assert.equal(resolved.source, 'gross_minus_deductions');
});

test('deriveApplicationFinancialProfile averages certified payslips and adds recurring benefits', () => {
  const summary = deriveApplicationFinancialProfile({
    application: {
      documents: [
        {
          type: 'BULLETIN_SALAIRE',
          status: 'CERTIFIED',
          dateEmission: '2026-03-01',
          aiAnalysis: {
            financial_data: {
              monthly_net_income: 2510,
              extra_details: { salaire_brut_mensuel: 3200, cotisations_mensuelles: 690 },
            },
          },
        },
        {
          type: 'BULLETIN_SALAIRE',
          status: 'CERTIFIED',
          dateEmission: '2026-02-01',
          aiAnalysis: {
            financial_data: {
              monthly_net_income: 2490,
              extra_details: { salaire_brut_mensuel: 3180, cotisations_mensuelles: 690 },
            },
          },
        },
        {
          type: 'BULLETIN_SALAIRE',
          status: 'CERTIFIED',
          dateEmission: '2026-01-01',
          aiAnalysis: {
            financial_data: {
              monthly_net_income: 2500,
              extra_details: { salaire_brut_mensuel: 3190, cotisations_mensuelles: 690 },
            },
          },
        },
        {
          type: 'AIDE_LOGEMENT',
          status: 'CERTIFIED',
          dateEmission: '2026-03-02',
          aiAnalysis: {
            financial_data: {
              monthly_net_income: 210,
              extra_details: { montant_apl: 210 },
            },
          },
        },
      ],
    },
  });

  assert.equal(summary.primaryIncome, 2500);
  assert.equal(summary.components.benefits, 210);
  assert.equal(summary.totalMonthlyIncome, 2710);
  assert.equal(summary.incomeSource, 'SALARY');
  assert.equal(summary.certifiedIncome, true);
  assert.match(summary.basisLabel, /3 bulletin/);
});
