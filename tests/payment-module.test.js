/**
 * Tests unitaires pour le module de paiement locatif.
 *
 * Couvre :
 * - Calcul prorata (entrée le 15, sortie le 20, mois complet)
 * - Révision IRL (formule nouveau = ancien × nouvel_IRL / ancien_IRL)
 * - Régularisation des charges (provisions vs charges réelles)
 * - Validation dépôt de garantie (couvert dans deposit-validation.test.js, ici edge cases supplémentaires)
 * - Génération quittance (vérification structure et mentions obligatoires)
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Helpers reproduits depuis paymentService.ts ────────────────

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

/**
 * Calcul prorata — logique pure extraite de paymentService.calculateProrata
 */
function calculateProrata(lease, month, year) {
  const totalDays = daysInMonth(month, year);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, totalDays);

  const leaseStart = new Date(lease.startDate);
  const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;

  let occupiedStart = monthStart;
  let occupiedEnd = monthEnd;
  let isProrata = false;

  if (leaseStart > monthStart && leaseStart <= monthEnd) {
    occupiedStart = leaseStart;
    isProrata = true;
  }

  if (leaseEnd && leaseEnd >= monthStart && leaseEnd < monthEnd) {
    occupiedEnd = leaseEnd;
    isProrata = true;
  }

  const daysOccupied = isProrata
    ? Math.max(0, Math.ceil((occupiedEnd.getTime() - occupiedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : totalDays;
  const ratio = Math.round((daysOccupied / totalDays) * 10000) / 10000;

  return {
    isProrata,
    startDate: isProrata ? occupiedStart : undefined,
    endDate: isProrata ? occupiedEnd : undefined,
    daysInMonth: totalDays,
    daysOccupied,
    ratio,
  };
}

/**
 * Révision IRL — logique pure
 */
function applyIRLRevisionCalc(previousRent, newIRLIndex, oldIRLIndex) {
  return Math.round((previousRent * (newIRLIndex / oldIRLIndex)) * 100) / 100;
}

/**
 * Régularisation charges — logique pure
 */
function calculateRegularizationCalc(provisionCharges, realCharges) {
  return Math.round((provisionCharges - realCharges) * 100) / 100;
}

/**
 * Calcul montants avec prorata
 */
function calculateAmounts(rentAmount, chargesAmount, prorata) {
  const rentHC = prorata.isProrata
    ? Math.round(rentAmount * prorata.ratio * 100) / 100
    : rentAmount;
  const charges = prorata.isProrata
    ? Math.round((chargesAmount || 0) * prorata.ratio * 100) / 100
    : (chargesAmount || 0);
  const totalTTC = Math.round((rentHC + charges) * 100) / 100;
  return { rentHC, charges, totalTTC };
}

// ─── 1. Tests Calcul Prorata ────────────────────────────────────

describe('Calcul prorata', () => {
  describe('Mois complet (pas de prorata)', () => {
    it('bail couvrant tout le mois → ratio 1, tous les jours', () => {
      const lease = { startDate: '2026-01-01', endDate: null };
      const result = calculateProrata(lease, 3, 2026); // mars 2026

      assert.equal(result.isProrata, false);
      assert.equal(result.daysInMonth, 31);
      assert.equal(result.daysOccupied, 31);
      assert.equal(result.ratio, 1);
    });

    it('bail démarré avant le mois, sans fin → mois complet', () => {
      const lease = { startDate: '2025-06-01', endDate: null };
      const result = calculateProrata(lease, 2, 2026); // février 2026

      assert.equal(result.isProrata, false);
      assert.equal(result.daysInMonth, 28);
      assert.equal(result.daysOccupied, 28);
      assert.equal(result.ratio, 1);
    });

    it('bail démarré le 1er du mois → pas de prorata', () => {
      const lease = { startDate: '2026-03-01', endDate: null };
      const result = calculateProrata(lease, 3, 2026);

      assert.equal(result.isProrata, false);
      assert.equal(result.daysOccupied, 31);
    });
  });

  describe('Entrée en cours de mois (le 15)', () => {
    it('entrée le 15 mars → 17 jours sur 31', () => {
      const lease = { startDate: '2026-03-15', endDate: null };
      const result = calculateProrata(lease, 3, 2026);

      assert.equal(result.isProrata, true);
      assert.equal(result.daysInMonth, 31);
      assert.equal(result.daysOccupied, 17); // du 15 au 31 = 17 jours
      assert.ok(result.ratio > 0.54 && result.ratio < 0.55);
    });

    it('entrée le 15 février 2026 → 14 jours sur 28', () => {
      const lease = { startDate: '2026-02-15', endDate: null };
      const result = calculateProrata(lease, 2, 2026);

      assert.equal(result.isProrata, true);
      assert.equal(result.daysInMonth, 28);
      assert.equal(result.daysOccupied, 14); // du 15 au 28
      assert.equal(result.ratio, 0.5);
    });

    it('montants avec prorata entrée le 15 : loyer 800€, charges 50€', () => {
      const lease = { startDate: '2026-03-15', endDate: null };
      const prorata = calculateProrata(lease, 3, 2026);
      const amounts = calculateAmounts(800, 50, prorata);

      // 17/31 ≈ 0.5484
      assert.ok(amounts.rentHC < 800);
      assert.ok(amounts.charges < 50);
      assert.equal(amounts.totalTTC, Math.round((amounts.rentHC + amounts.charges) * 100) / 100);
    });
  });

  describe('Sortie en cours de mois (le 20)', () => {
    it('sortie le 20 mars → 20 jours sur 31', () => {
      const lease = { startDate: '2025-01-01', endDate: '2026-03-20' };
      const result = calculateProrata(lease, 3, 2026);

      assert.equal(result.isProrata, true);
      assert.equal(result.daysInMonth, 31);
      assert.equal(result.daysOccupied, 20); // du 1er au 20 = 20 jours
      assert.ok(result.ratio > 0.64 && result.ratio < 0.65);
    });

    it('sortie le dernier jour du mois → pas de prorata', () => {
      const lease = { startDate: '2025-01-01', endDate: '2026-03-31' };
      const result = calculateProrata(lease, 3, 2026);

      // endDate (31) n'est PAS < monthEnd (31), donc pas de prorata
      assert.equal(result.isProrata, false);
      assert.equal(result.daysOccupied, 31);
    });
  });

  describe('Entrée ET sortie dans le même mois', () => {
    it('entrée le 10, sortie le 20 mars → 11 jours sur 31', () => {
      const lease = { startDate: '2026-03-10', endDate: '2026-03-20' };
      const result = calculateProrata(lease, 3, 2026);

      assert.equal(result.isProrata, true);
      assert.equal(result.daysOccupied, 11); // du 10 au 20 = 11 jours
      assert.equal(result.daysInMonth, 31);
    });

    it('montants avec double prorata : loyer 1000€, charges 100€, 11/31 jours', () => {
      const lease = { startDate: '2026-03-10', endDate: '2026-03-20' };
      const prorata = calculateProrata(lease, 3, 2026);
      const amounts = calculateAmounts(1000, 100, prorata);

      // ratio ≈ 11/31 ≈ 0.3548
      assert.ok(amounts.rentHC > 354 && amounts.rentHC < 356);
      assert.ok(amounts.charges > 35 && amounts.charges < 36);
    });
  });

  describe('Mois de février (année bissextile)', () => {
    it('février 2028 (bissextile) → 29 jours', () => {
      const lease = { startDate: '2028-01-01', endDate: null };
      const result = calculateProrata(lease, 2, 2028);

      assert.equal(result.daysInMonth, 29);
      assert.equal(result.daysOccupied, 29);
    });

    it('entrée le 15 février 2028 → 15 jours sur 29', () => {
      const lease = { startDate: '2028-02-15', endDate: null };
      const result = calculateProrata(lease, 2, 2028);

      assert.equal(result.isProrata, true);
      assert.equal(result.daysOccupied, 15);
      assert.equal(result.daysInMonth, 29);
    });
  });

  describe('Cas limites', () => {
    it('bail démarrant le dernier jour du mois → 1 jour', () => {
      const lease = { startDate: '2026-03-31', endDate: null };
      const result = calculateProrata(lease, 3, 2026);

      assert.equal(result.isProrata, true);
      assert.equal(result.daysOccupied, 1);
    });

    it('bail terminant le 1er du mois → 1 jour', () => {
      const lease = { startDate: '2025-01-01', endDate: '2026-03-01' };
      const result = calculateProrata(lease, 3, 2026);

      assert.equal(result.isProrata, true);
      assert.equal(result.daysOccupied, 1);
    });
  });
});

// ─── 2. Tests Révision IRL ──────────────────────────────────────

describe('Révision IRL', () => {
  it('formule : nouveau = ancien × (nouvel_IRL / ancien_IRL)', () => {
    // Loyer 800€, IRL passe de 140.59 à 143.46
    const newRent = applyIRLRevisionCalc(800, 143.46, 140.59);
    // 800 × (143.46 / 140.59) = 800 × 1.02042... ≈ 816.34
    assert.equal(newRent, Math.round((800 * (143.46 / 140.59)) * 100) / 100);
  });

  it('IRL identique → loyer inchangé', () => {
    const newRent = applyIRLRevisionCalc(800, 140.59, 140.59);
    assert.equal(newRent, 800);
  });

  it('IRL en baisse → loyer diminue', () => {
    const newRent = applyIRLRevisionCalc(1000, 138.00, 140.59);
    assert.ok(newRent < 1000);
  });

  it('IRL en hausse → loyer augmente', () => {
    const newRent = applyIRLRevisionCalc(1000, 145.00, 140.59);
    assert.ok(newRent > 1000);
  });

  it('petits loyers : pas d\'arrondi inattendu', () => {
    const newRent = applyIRLRevisionCalc(350, 143.46, 140.59);
    assert.ok(Number.isFinite(newRent));
    assert.equal(newRent, Math.round((350 * (143.46 / 140.59)) * 100) / 100);
  });

  it('gros loyers : arrondi au centime', () => {
    const newRent = applyIRLRevisionCalc(5000, 143.46, 140.59);
    const expected = Math.round((5000 * (143.46 / 140.59)) * 100) / 100;
    assert.equal(newRent, expected);
    // Vérifier que c'est bien arrondi à 2 décimales
    assert.equal(String(newRent).split('.')[1]?.length <= 2, true);
  });

  it('variation réaliste T1 2026 : IRL 142.06 → 143.46', () => {
    // Hausse de ~1%
    const newRent = applyIRLRevisionCalc(900, 143.46, 142.06);
    assert.ok(newRent > 900 && newRent < 920);
  });
});

// ─── 3. Tests Régularisation des charges ────────────────────────

describe('Régularisation des charges', () => {
  it('provisions > charges réelles → remboursement locataire (adjustment positif)', () => {
    const provisionTotal = 600; // 50€ × 12 mois
    const realCharges = 480;
    const adjustment = calculateRegularizationCalc(provisionTotal, realCharges);

    assert.equal(adjustment, 120); // 600 - 480 = 120€ à rembourser
    assert.ok(adjustment > 0);
  });

  it('provisions < charges réelles → complément locataire (adjustment négatif)', () => {
    const provisionTotal = 600;
    const realCharges = 720;
    const adjustment = calculateRegularizationCalc(provisionTotal, realCharges);

    assert.equal(adjustment, -120); // 600 - 720 = -120€ à payer
    assert.ok(adjustment < 0);
  });

  it('provisions = charges réelles → adjustment = 0', () => {
    const adjustment = calculateRegularizationCalc(600, 600);
    assert.equal(adjustment, 0);
  });

  it('charges réelles = 0 → remboursement total des provisions', () => {
    const adjustment = calculateRegularizationCalc(600, 0);
    assert.equal(adjustment, 600);
  });

  it('provisions = 0 → locataire doit tout payer', () => {
    const adjustment = calculateRegularizationCalc(0, 480);
    assert.equal(adjustment, -480);
  });

  it('arrondi au centime', () => {
    const adjustment = calculateRegularizationCalc(599.99, 480.01);
    assert.equal(adjustment, 119.98);
  });

  it('petits montants avec décimales', () => {
    const adjustment = calculateRegularizationCalc(50.33, 48.77);
    assert.equal(adjustment, 1.56);
  });
});

// ─── 4. Tests Validation dépôt de garantie (compléments) ────────

describe('Validation dépôt de garantie (cas supplémentaires)', () => {
  function validateDeposit(leaseType, rentAmount, depositAmount) {
    const type = (leaseType || '').toUpperCase();
    if (type === 'MOBILITE' && depositAmount !== 0)
      return 'Le dépôt de garantie doit être de 0 € pour un bail mobilité.';
    if ((type === 'VIDE' || type === 'NU' || type === 'NUE') && depositAmount > rentAmount)
      return 'Le dépôt de garantie ne peut excéder 1 mois de loyer HC pour un bail nu.';
    if ((type === 'MEUBLE' || type === 'MEUBLEE') && depositAmount > 2 * rentAmount)
      return 'Le dépôt de garantie ne peut excéder 2 mois de loyer HC pour un bail meublé.';
    return null;
  }

  it('loyer à 0€ : dépôt 0 OK pour tous types', () => {
    assert.equal(validateDeposit('VIDE', 0, 0), null);
    assert.equal(validateDeposit('MEUBLE', 0, 0), null);
    assert.equal(validateDeposit('MOBILITE', 0, 0), null);
  });

  it('bail nu : dépôt exactement = loyer est accepté', () => {
    assert.equal(validateDeposit('VIDE', 1200, 1200), null);
  });

  it('bail meublé : dépôt exactement = 2× loyer est accepté', () => {
    assert.equal(validateDeposit('MEUBLE', 1200, 2400), null);
  });

  it('bail nu : dépôt = loyer + 0.01 est refusé', () => {
    assert.ok(validateDeposit('VIDE', 1200, 1200.01) !== null);
  });

  it('bail meublé : dépôt = 2× loyer + 0.01 est refusé', () => {
    assert.ok(validateDeposit('MEUBLE', 1200, 2400.01) !== null);
  });

  it('gros loyers : bail nu 5000€, dépôt 5000€ OK', () => {
    assert.equal(validateDeposit('VIDE', 5000, 5000), null);
  });

  it('gros loyers : bail meublé 5000€, dépôt 10000€ OK', () => {
    assert.equal(validateDeposit('MEUBLE', 5000, 10000), null);
  });
});

// ─── 5. Tests Génération quittance (structure) ──────────────────

describe('Génération quittance — structure et mentions', () => {
  // On ne peut pas tester la génération PDF sans MongoDB,
  // mais on vérifie la logique de construction des données.

  function buildReceiptData(payment, owner, tenant, property) {
    const period = payment.period;
    const amounts = payment.amounts;
    const prorata = payment.prorata;
    const totalDays = daysInMonth(period.month, period.year);
    const periodStart = `01/${String(period.month).padStart(2, '0')}/${period.year}`;
    const periodEnd = `${totalDays}/${String(period.month).padStart(2, '0')}/${period.year}`;

    const ownerName = owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email : 'Propriétaire';
    const tenantName = tenant ? `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() || tenant.email : 'Locataire';
    const propertyAddress = property?.address || 'Adresse non renseignée';

    return {
      title: 'QUITTANCE DE LOYER',
      periodLabel: `Période : du ${periodStart} au ${periodEnd}`,
      ownerName,
      tenantName,
      propertyAddress,
      rentHC: amounts.rentHC,
      charges: amounts.charges,
      totalTTC: amounts.totalTTC,
      paidAmount: amounts.paidAmount,
      isProrata: prorata?.isProrata || false,
      legalMention: 'Cette quittance annule tous les reçus qui auraient pu être établis précédemment pour la même période.',
    };
  }

  const samplePayment = {
    period: { month: 3, year: 2026 },
    amounts: { rentHC: 800, charges: 50, totalTTC: 850, paidAmount: 850 },
    prorata: { isProrata: false },
    confirmedAt: '2026-03-05',
  };

  const owner = { firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com', address: '1 rue de Paris' };
  const tenant = { firstName: 'Marie', lastName: 'Martin', email: 'marie@example.com' };
  const property = { address: '15 avenue des Champs-Élysées, 75008 Paris' };

  it('contient le titre QUITTANCE DE LOYER', () => {
    const data = buildReceiptData(samplePayment, owner, tenant, property);
    assert.equal(data.title, 'QUITTANCE DE LOYER');
  });

  it('contient la période correcte', () => {
    const data = buildReceiptData(samplePayment, owner, tenant, property);
    assert.ok(data.periodLabel.includes('01/03/2026'));
    assert.ok(data.periodLabel.includes('31/03/2026'));
  });

  it('contient le nom du bailleur', () => {
    const data = buildReceiptData(samplePayment, owner, tenant, property);
    assert.equal(data.ownerName, 'Jean Dupont');
  });

  it('contient le nom du locataire', () => {
    const data = buildReceiptData(samplePayment, owner, tenant, property);
    assert.equal(data.tenantName, 'Marie Martin');
  });

  it('contient l\'adresse du bien', () => {
    const data = buildReceiptData(samplePayment, owner, tenant, property);
    assert.equal(data.propertyAddress, '15 avenue des Champs-Élysées, 75008 Paris');
  });

  it('contient les montants détaillés', () => {
    const data = buildReceiptData(samplePayment, owner, tenant, property);
    assert.equal(data.rentHC, 800);
    assert.equal(data.charges, 50);
    assert.equal(data.totalTTC, 850);
    assert.equal(data.paidAmount, 850);
  });

  it('contient la mention légale obligatoire', () => {
    const data = buildReceiptData(samplePayment, owner, tenant, property);
    assert.ok(data.legalMention.includes('annule tous les reçus'));
  });

  it('nom par défaut si propriétaire sans nom', () => {
    const data = buildReceiptData(samplePayment, { email: 'test@test.com' }, tenant, property);
    assert.equal(data.ownerName, 'test@test.com');
  });

  it('nom par défaut si locataire null', () => {
    const data = buildReceiptData(samplePayment, owner, null, property);
    assert.equal(data.tenantName, 'Locataire');
  });

  it('adresse par défaut si bien sans adresse', () => {
    const data = buildReceiptData(samplePayment, owner, tenant, {});
    assert.equal(data.propertyAddress, 'Adresse non renseignée');
  });

  it('quittance avec prorata affiche le flag', () => {
    const prorataPayment = {
      ...samplePayment,
      prorata: { isProrata: true, daysOccupied: 17, daysInMonth: 31, ratio: 0.5484 },
    };
    const data = buildReceiptData(prorataPayment, owner, tenant, property);
    assert.equal(data.isProrata, true);
  });

  it('période février : affiche 28 jours (non bissextile)', () => {
    const febPayment = { ...samplePayment, period: { month: 2, year: 2026 } };
    const data = buildReceiptData(febPayment, owner, tenant, property);
    assert.ok(data.periodLabel.includes('28/02/2026'));
  });

  it('période février bissextile : affiche 29 jours', () => {
    const febPayment = { ...samplePayment, period: { month: 2, year: 2028 } };
    const data = buildReceiptData(febPayment, owner, tenant, property);
    assert.ok(data.periodLabel.includes('29/02/2028'));
  });
});

// ─── 6. Tests statut paiement ───────────────────────────────────

describe('Logique de statut après confirmation', () => {
  function determineStatus(totalTTC, paidAmount) {
    if (paidAmount >= totalTTC) return 'CONFIRMED';
    if (paidAmount > 0) return 'PARTIAL';
    return 'PENDING';
  }

  it('paiement total → CONFIRMED', () => {
    assert.equal(determineStatus(850, 850), 'CONFIRMED');
  });

  it('paiement supérieur au total → CONFIRMED', () => {
    assert.equal(determineStatus(850, 900), 'CONFIRMED');
  });

  it('paiement partiel → PARTIAL', () => {
    assert.equal(determineStatus(850, 500), 'PARTIAL');
  });

  it('paiement = 0 → PENDING', () => {
    assert.equal(determineStatus(850, 0), 'PENDING');
  });

  it('paiement = 0.01 → PARTIAL', () => {
    assert.equal(determineStatus(850, 0.01), 'PARTIAL');
  });

  it('paiement = totalTTC - 0.01 → PARTIAL', () => {
    assert.equal(determineStatus(850, 849.99), 'PARTIAL');
  });
});
