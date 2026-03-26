/**
 * Tests unitaires pour la validation du dépôt de garantie.
 * Règles légales (loi ALUR / loi ELAN) :
 * - Bail mobilité : dépôt = 0 €
 * - Bail nu/vide : dépôt ≤ 1 mois de loyer HC
 * - Bail meublé : dépôt ≤ 2 mois de loyer HC
 */
const { z } = require('zod');

// Reproduit les refinements du LeaseSchema Zod et du pre-save Mongoose
function validateDeposit(leaseType, rentAmount, depositAmount) {
  const type = (leaseType || '').toUpperCase();
  if (type === 'MOBILITE' && depositAmount !== 0) {
    return 'Le dépôt de garantie doit être de 0 € pour un bail mobilité.';
  }
  if ((type === 'VIDE' || type === 'NU' || type === 'NUE') && depositAmount > rentAmount) {
    return 'Le dépôt de garantie ne peut excéder 1 mois de loyer HC pour un bail nu.';
  }
  if ((type === 'MEUBLE' || type === 'MEUBLEE') && depositAmount > 2 * rentAmount) {
    return 'Le dépôt de garantie ne peut excéder 2 mois de loyer HC pour un bail meublé.';
  }
  return null;
}

describe('Validation dépôt de garantie (logique métier)', () => {
  // ─── Bail mobilité ───
  describe('Bail mobilité', () => {
    test('accepte dépôt = 0', () => {
      expect(validateDeposit('MOBILITE', 800, 0)).toBeNull();
    });
    test('refuse dépôt > 0', () => {
      expect(validateDeposit('MOBILITE', 800, 100)).toContain('bail mobilité');
    });
    test('refuse dépôt = 1', () => {
      expect(validateDeposit('MOBILITE', 800, 1)).toContain('bail mobilité');
    });
  });

  // ─── Bail nu/vide ───
  describe('Bail nu/vide', () => {
    test('accepte dépôt = loyer', () => {
      expect(validateDeposit('VIDE', 800, 800)).toBeNull();
    });
    test('accepte dépôt < loyer', () => {
      expect(validateDeposit('VIDE', 800, 500)).toBeNull();
    });
    test('accepte dépôt = 0', () => {
      expect(validateDeposit('VIDE', 800, 0)).toBeNull();
    });
    test('refuse dépôt > loyer', () => {
      expect(validateDeposit('VIDE', 800, 801)).toContain('bail nu');
    });
    test('refuse dépôt = 2x loyer', () => {
      expect(validateDeposit('NU', 800, 1600)).toContain('bail nu');
    });
  });

  // ─── Bail meublé ───
  describe('Bail meublé', () => {
    test('accepte dépôt = 2x loyer', () => {
      expect(validateDeposit('MEUBLE', 800, 1600)).toBeNull();
    });
    test('accepte dépôt = loyer', () => {
      expect(validateDeposit('MEUBLE', 800, 800)).toBeNull();
    });
    test('accepte dépôt = 0', () => {
      expect(validateDeposit('MEUBLE', 800, 0)).toBeNull();
    });
    test('refuse dépôt > 2x loyer', () => {
      expect(validateDeposit('MEUBLE', 800, 1601)).toContain('bail meublé');
    });
  });

  // ─── Variantes de nommage ───
  describe('Variantes enum', () => {
    test('NUE = bail nu', () => {
      expect(validateDeposit('NUE', 800, 801)).toContain('bail nu');
    });
    test('MEUBLEE = bail meublé', () => {
      expect(validateDeposit('MEUBLEE', 800, 1601)).toContain('bail meublé');
    });
  });
});

describe('Zod LeaseSchema refinements', () => {
  const LeaseZodSchema = z.object({
    leaseType: z.enum(['NUE', 'MEUBLEE', 'MOBILITE']),
    startDate: z.string().min(1),
    paymentDay: z.number().int().min(1).max(31),
    rentHC: z.number().min(0),
    charges: z.number().min(0),
    deposit: z.number().min(0),
    durationMonths: z.number().int().min(1),
    clauses: z.string().max(2000).optional(),
  }).refine(
    (data) => !(data.leaseType === 'MOBILITE' && data.deposit !== 0),
    { message: 'Dépôt = 0 pour mobilité', path: ['deposit'] }
  ).refine(
    (data) => !(data.leaseType === 'NUE' && data.deposit > data.rentHC),
    { message: 'Dépôt ≤ 1 mois pour bail nu', path: ['deposit'] }
  ).refine(
    (data) => !(data.leaseType === 'MEUBLEE' && data.deposit > 2 * data.rentHC),
    { message: 'Dépôt ≤ 2 mois pour meublé', path: ['deposit'] }
  );

  const baseForm = {
    startDate: '2026-04-01',
    paymentDay: 5,
    rentHC: 800,
    charges: 50,
    deposit: 800,
    durationMonths: 12,
  };

  test('bail nu : dépôt = loyer OK', () => {
    expect(LeaseZodSchema.safeParse({ ...baseForm, leaseType: 'NUE', deposit: 800 }).success).toBe(true);
  });
  test('bail nu : dépôt > loyer KO', () => {
    expect(LeaseZodSchema.safeParse({ ...baseForm, leaseType: 'NUE', deposit: 801 }).success).toBe(false);
  });
  test('mobilité : dépôt = 0 OK', () => {
    expect(LeaseZodSchema.safeParse({ ...baseForm, leaseType: 'MOBILITE', deposit: 0, durationMonths: 6 }).success).toBe(true);
  });
  test('mobilité : dépôt > 0 KO', () => {
    expect(LeaseZodSchema.safeParse({ ...baseForm, leaseType: 'MOBILITE', deposit: 1 }).success).toBe(false);
  });
  test('meublé : dépôt = 2x loyer OK', () => {
    expect(LeaseZodSchema.safeParse({ ...baseForm, leaseType: 'MEUBLEE', deposit: 1600 }).success).toBe(true);
  });
  test('meublé : dépôt > 2x loyer KO', () => {
    expect(LeaseZodSchema.safeParse({ ...baseForm, leaseType: 'MEUBLEE', deposit: 1601 }).success).toBe(false);
  });
});
