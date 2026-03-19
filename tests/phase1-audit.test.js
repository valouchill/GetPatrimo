const test = require('node:test');
const assert = require('node:assert/strict');

const { runPhase1Audit } = require('../src/services/phase1AuditService');

function buildPayslipText({
  monthLabel,
  gross,
  cotisations,
  net,
  netImposable,
  cumulativeNetImposable,
  employer = 'ACME SAS',
  ownerName = 'Alice Martin',
  address = '10 rue de Paris 75010 Paris',
  emissionDate = '2025-03-28',
  startDate = '2024-01-01',
  anciennete = '14 mois',
}) {
  const [firstName, lastName] = ownerName.split(' ');

  return `
Bulletin de salaire ${monthLabel}
Nom: ${lastName}
Prenom: ${firstName}
Adresse: ${address}
Employeur: ${employer}
Date d'embauche: ${startDate}
Anciennete: ${anciennete}
Date: ${emissionDate}
Salaire brut: ${gross.toFixed(2)} EUR
Cotisations salariales: ${cotisations.toFixed(2)} EUR
Net a payer: ${net.toFixed(2)} EUR
Net imposable: ${netImposable.toFixed(2)} EUR
Cumul annuel net imposable: ${cumulativeNetImposable.toFixed(2)} EUR
`;
}

function buildBasePayload(documents) {
  return {
    candidature: {
      _id: 'cand_1',
      firstName: 'Alice',
      lastName: 'Martin',
      monthlyNetIncome: 2500,
      contractType: 'CDI',
      createdAt: '2026-03-10T10:00:00.000Z',
    },
    property: {
      city: 'Paris',
      zipCode: '75010',
      rentAmount: 900,
      chargesAmount: 100,
    },
    documents,
  };
}

test('Phase 1 marks a coherent dossier as TRUST', async () => {
  const payload = buildBasePayload([
    {
      id: 'id',
      originalName: 'CNI_Alice_Martin.pdf',
      mimeType: 'application/pdf',
      ocrText: 'Carte nationale d identite Nom: Martin Prenom: Alice Adresse: 10 rue de Paris 75010 Paris',
      technicalMetadata: { creator: 'ANTS', modificationDate: '2025-01-10T10:00:00.000Z' },
    },
    {
      id: 'pay_1',
      originalName: 'Bulletin_Janvier_2025.pdf',
      mimeType: 'application/pdf',
      ocrText: buildPayslipText({
        monthLabel: 'Janvier 2025',
        gross: 3200,
        cotisations: 700,
        net: 2500,
        netImposable: 2600,
        cumulativeNetImposable: 2600,
        emissionDate: '2025-01-28',
        anciennete: '13 mois',
      }),
      technicalMetadata: { creator: 'Payfit', modificationDate: '2025-01-28T09:00:00.000Z' },
    },
    {
      id: 'pay_2',
      originalName: 'Bulletin_Fevrier_2025.pdf',
      mimeType: 'application/pdf',
      ocrText: buildPayslipText({
        monthLabel: 'Fevrier 2025',
        gross: 3200,
        cotisations: 700,
        net: 2500,
        netImposable: 2600,
        cumulativeNetImposable: 5200,
        emissionDate: '2025-02-27',
        anciennete: '14 mois',
      }),
      technicalMetadata: { creator: 'Payfit', modificationDate: '2025-02-27T09:00:00.000Z' },
    },
    {
      id: 'pay_3',
      originalName: 'Bulletin_Mars_2025.pdf',
      mimeType: 'application/pdf',
      ocrText: buildPayslipText({
        monthLabel: 'Mars 2025',
        gross: 3200,
        cotisations: 700,
        net: 2500,
        netImposable: 2600,
        cumulativeNetImposable: 7800,
        emissionDate: '2025-03-28',
        anciennete: '15 mois',
      }),
      technicalMetadata: { creator: 'Payfit', modificationDate: '2025-03-28T09:00:00.000Z' },
    },
    {
      id: 'tax',
      originalName: 'Avis_Imposition_2025.pdf',
      mimeType: 'application/pdf',
      ocrText: 'Avis d imposition Nom: Martin Prenom: Alice Adresse: 10 rue de Paris 75010 Paris Revenu fiscal de reference: 31000 EUR Date: 2025-08-20',
      technicalMetadata: { creator: 'DGFIP', modificationDate: '2025-08-20T09:00:00.000Z' },
    },
    {
      id: 'contract',
      originalName: 'Contrat_CDI_Acme.pdf',
      mimeType: 'application/pdf',
      ocrText: 'Contrat de travail Nom: Martin Prenom: Alice Employeur: ACME SAS Date d embauche: 2024-01-01 CDI Adresse: 10 rue de Paris 75010 Paris',
      technicalMetadata: { creator: 'Lucca', modificationDate: '2024-01-01T09:00:00.000Z' },
    },
  ]);

  const analysis = await runPhase1Audit(payload);

  assert.equal(analysis.phase1.fraudStatus, 'TRUST');
  assert.equal(analysis.phase1.workflowDecision, 'AUTOMATIC_PASS');
  assert.equal(analysis.status, 'VALIDATED');
  assert.ok(analysis.phase1.fraudScore <= 20);
  assert.ok(analysis.score >= 80);
});

test('Phase 1 routes moderate anomalies to human review', async () => {
  const payload = buildBasePayload([
    {
      id: 'id',
      originalName: 'CNI_Alice_Martin.pdf',
      mimeType: 'application/pdf',
      ocrText: 'Carte nationale d identite Nom: Martin Prenom: Alice Adresse: 10 rue de Paris 75010 Paris',
      technicalMetadata: { creator: 'ANTS', modificationDate: '2025-01-10T10:00:00.000Z' },
    },
    {
      id: 'pay_1',
      originalName: 'Bulletin_Janvier_2025.pdf',
      mimeType: 'application/pdf',
      ocrText: buildPayslipText({
        monthLabel: 'Janvier 2025',
        gross: 3500,
        cotisations: 1000,
        net: 2500,
        netImposable: 2550,
        cumulativeNetImposable: 2550,
        address: '10 rue de Paris 75010 Paris',
        emissionDate: '2025-01-28',
      }),
      technicalMetadata: { creator: 'Payfit', modificationDate: '2025-01-28T09:00:00.000Z' },
    },
    {
      id: 'pay_2',
      originalName: 'Bulletin_Fevrier_2025.pdf',
      mimeType: 'application/pdf',
      ocrText: buildPayslipText({
        monthLabel: 'Fevrier 2025',
        gross: 3500,
        cotisations: 1000,
        net: 2500,
        netImposable: 2550,
        cumulativeNetImposable: 5100,
        address: '10 rue de Paris 75010 Paris',
        emissionDate: '2025-02-27',
      }),
      technicalMetadata: { creator: 'Payfit', modificationDate: '2025-02-27T09:00:00.000Z' },
    },
    {
      id: 'pay_3',
      originalName: 'Bulletin_Mars_2025.pdf',
      mimeType: 'application/pdf',
      ocrText: buildPayslipText({
        monthLabel: 'Mars 2025',
        gross: 3500,
        cotisations: 1000,
        net: 2500,
        netImposable: 2550,
        cumulativeNetImposable: 7650,
        address: '25 avenue de Lyon 69000 Lyon',
        emissionDate: '2025-03-28',
      }),
      technicalMetadata: { creator: 'Payfit', modificationDate: '2025-03-28T09:00:00.000Z' },
    },
    {
      id: 'tax',
      originalName: 'Avis_Imposition_2025.pdf',
      mimeType: 'application/pdf',
      ocrText: 'Avis d imposition Nom: Martin Prenom: Alice Adresse: 10 rue de Paris 75010 Paris Revenu fiscal de reference: 22000 EUR Date: 2025-08-20',
      technicalMetadata: { creator: 'DGFIP', modificationDate: '2025-08-20T09:00:00.000Z' },
    },
  ]);

  const analysis = await runPhase1Audit(payload);

  assert.equal(analysis.phase1.fraudStatus, 'DOUBT');
  assert.equal(analysis.phase1.workflowDecision, 'ROUTE_TO_HUMAN');
  assert.equal(analysis.status, 'WARNING');
  assert.ok(analysis.phase1.fraudScore > 20);
  assert.ok(analysis.phase1.pointsIncoherence.some((message) => /ronds|adresse|revenu fiscal/i.test(message)));
});

test('Phase 1 raises ALERT on critical documentary fraud signals', async () => {
  const payload = buildBasePayload([
    {
      id: 'id',
      originalName: 'CNI_Alice_Martin.pdf',
      mimeType: 'application/pdf',
      ocrText: 'Carte nationale d identite Nom: Dupont Prenom: Jules Adresse: 10 rue de Paris 75010 Paris',
      technicalMetadata: { creator: 'ANTS', modificationDate: '2025-01-10T10:00:00.000Z' },
    },
    {
      id: 'pay_1',
      originalName: 'Bulletin_Janvier_2025.pdf',
      mimeType: 'application/pdf',
      ocrText: buildPayslipText({
        monthLabel: 'Janvier 2025',
        gross: 3200,
        cotisations: 600,
        net: 2500,
        netImposable: 2600,
        cumulativeNetImposable: 2600,
        emissionDate: '2025-01-28',
      }),
      technicalMetadata: { creator: 'Canva', modificationDate: '2026-03-12T09:00:00.000Z' },
    },
    {
      id: 'tax',
      originalName: 'Avis_Imposition_2025.pdf',
      mimeType: 'application/pdf',
      ocrText: 'Avis d imposition Nom: Martin Prenom: Alice Adresse: 10 rue de Paris 75010 Paris Revenu fiscal de reference: 18000 EUR Date: 2025-08-20',
      technicalMetadata: { creator: 'DGFIP', modificationDate: '2025-08-20T09:00:00.000Z' },
    },
  ]);

  const analysis = await runPhase1Audit(payload);

  assert.equal(analysis.phase1.fraudStatus, 'ALERT');
  assert.equal(analysis.phase1.workflowDecision, 'AUTOMATIC_REJECT');
  assert.equal(analysis.status, 'REJECTED');
  assert.ok(analysis.phase1.fraudScore >= 81);
  assert.ok(
    analysis.phase1.pointsIncoherence.some((message) => /Logiciel de creation suspect|Canva|piece d'identite|pièce d'identité/i.test(message))
  );
});

test('Phase 1 downgrades missing OCR or partial dossier to DOUBT instead of ALERT', async () => {
  const payload = buildBasePayload([
    {
      id: 'pay_1',
      originalName: 'Bulletin_Janvier_2025.pdf',
      mimeType: 'application/pdf',
    },
    {
      id: 'tax',
      originalName: 'Avis_Imposition_2025.pdf',
      mimeType: 'application/pdf',
    },
  ]);

  const analysis = await runPhase1Audit(payload);

  assert.equal(analysis.phase1.fraudStatus, 'DOUBT');
  assert.equal(analysis.phase1.workflowDecision, 'ROUTE_TO_HUMAN');
  assert.equal(analysis.status, 'WARNING');
  assert.ok(analysis.phase1.pointsIncoherence.some((message) => /OCR|Document manquant|partiel/i.test(message)));
});

test('Phase 1 supports mocked OCR, metadata and Gemini adapters end-to-end', async () => {
  let ocrCalls = 0;
  let metadataCalls = 0;
  let geminiCalls = 0;

  const payload = buildBasePayload([
    {
      id: 'id',
      originalName: 'CNI_Alice_Martin.pdf',
      mimeType: 'application/pdf',
    },
    {
      id: 'tax',
      originalName: 'Avis_Imposition_2025.pdf',
      mimeType: 'application/pdf',
    },
  ]);

  const analysis = await runPhase1Audit(payload, {
    adapters: {
      ocr: async (document) => {
        ocrCalls += 1;
        if (document.originalName.includes('CNI')) {
          return 'Carte nationale d identite Nom: Martin Prenom: Alice Adresse: 10 rue de Paris 75010 Paris';
        }
        return 'Avis d imposition Nom: Martin Prenom: Alice Adresse: 10 rue de Paris 75010 Paris Revenu fiscal de reference: 30000 EUR';
      },
      metadata: async () => {
        metadataCalls += 1;
        return { creator: 'Sage', modificationDate: '2025-08-20T09:00:00.000Z' };
      },
      gemini: async () => {
        geminiCalls += 1;
        return {
          score_fraude: 32,
          statut: 'DOUBT',
          points_incoherence: ['Documents incomplets pour une validation automatique.'],
          decision_workflow: 'ROUTE_TO_HUMAN',
          explication_auditeur: 'Le dossier reste incomplet et doit etre revu par un humain.',
        };
      },
    },
  });

  assert.equal(ocrCalls, 2);
  assert.equal(metadataCalls, 2);
  assert.equal(geminiCalls, 1);
  assert.equal(analysis.phase1.fraudStatus, 'DOUBT');
  assert.equal(analysis.phase1.workflowDecision, 'ROUTE_TO_HUMAN');
  assert.equal(analysis.summary.includes('DOUBT'), true);
});
