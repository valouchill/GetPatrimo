/**
 * Tests unitaires pour la validation du dépôt de garantie.
 * Règles légales (loi ALUR / loi ELAN) :
 * - Bail mobilité : dépôt = 0 €
 * - Bail nu/vide : dépôt ≤ 1 mois de loyer HC
 * - Bail meublé : dépôt ≤ 2 mois de loyer HC
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
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
  describe('Bail mobilité', () => {
    it('accepte dépôt = 0', () => {
      assert.equal(validateDeposit('MOBILITE', 800, 0), null);
    });
    it('refuse dépôt > 0', () => {
      assert.ok(validateDeposit('MOBILITE', 800, 100)?.includes('bail mobilité'));
    });
    it('refuse dépôt = 1', () => {
      assert.ok(validateDeposit('MOBILITE', 800, 1)?.includes('bail mobilité'));
    });
  });

  describe('Bail nu/vide', () => {
    it('accepte dépôt = loyer', () => {
      assert.equal(validateDeposit('VIDE', 800, 800), null);
    });
    it('accepte dépôt < loyer', () => {
      assert.equal(validateDeposit('VIDE', 800, 500), null);
    });
    it('accepte dépôt = 0', () => {
      assert.equal(validateDeposit('VIDE', 800, 0), null);
    });
    it('refuse dépôt > loyer', () => {
      assert.ok(validateDeposit('VIDE', 800, 801)?.includes('bail nu'));
    });
    it('refuse dépôt = 2x loyer', () => {
      assert.ok(validateDeposit('NU', 800, 1600)?.includes('bail nu'));
    });
  });

  describe('Bail meublé', () => {
    it('accepte dépôt = 2x loyer', () => {
      assert.equal(validateDeposit('MEUBLE', 800, 1600), null);
    });
    it('accepte dépôt = loyer', () => {
      assert.equal(validateDeposit('MEUBLE', 800, 800), null);
    });
    it('accepte dépôt = 0', () => {
      assert.equal(validateDeposit('MEUBLE', 800, 0), null);
    });
    it('refuse dépôt > 2x loyer', () => {
      assert.ok(validateDeposit('MEUBLE', 800, 1601)?.includes('bail meublé'));
    });
  });

  describe('Variantes enum', () => {
    it('NUE = bail nu', () => {
      assert.ok(validateDeposit('NUE', 800, 801)?.includes('bail nu'));
    });
    it('MEUBLEE = bail meublé', () => {
      assert.ok(validateDeposit('MEUBLEE', 800, 1601)?.includes('bail meublé'));
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

  it('bail nu : dépôt = loyer OK', () => {
    assert.ok(LeaseZodSchema.safeParse({ ...baseForm, leaseType: 'NUE', deposit: 800 }).success);
  });
  it('bail nu : dépôt > loyer KO', () => {
    assert.ok(!LeaseZodSchema.safeParse({ ...baseForm, leaseType: 'NUE', deposit: 801 }).success);
  });
  it('mobilité : dépôt = 0 OK', () => {
    assert.ok(LeaseZodSchema.safeParse({ ...baseForm, leaseType: 'MOBILITE', deposit: 0, durationMonths: 6 }).success);
  });
  it('mobilité : dépôt > 0 KO', () => {
    assert.ok(!LeaseZodSchema.safeParse({ ...baseForm, leaseType: 'MOBILITE', deposit: 1 }).success);
  });
  it('meublé : dépôt = 2x loyer OK', () => {
    assert.ok(LeaseZodSchema.safeParse({ ...baseForm, leaseType: 'MEUBLEE', deposit: 1600 }).success);
  });
  it('meublé : dépôt > 2x loyer KO', () => {
    assert.ok(!LeaseZodSchema.safeParse({ ...baseForm, leaseType: 'MEUBLEE', deposit: 1601 }).success);
  });
});
