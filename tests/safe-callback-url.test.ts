/**
 * Tests unitaires de la garde anti open-redirect `safeCallbackUrl`.
 *
 * On valide :
 *   - les chemins internes légitimes sont honorés (par rôle) ;
 *   - toutes les variantes d'open-redirect sont neutralisées ;
 *   - la garde de périmètre par rôle (tenant ↔ owner) ;
 *   - le décodage tolérant des valeurs encodées.
 *
 * Lancement : npx tsx tests/safe-callback-url.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { safeCallbackUrl } from '../lib/safe-callback-url';

const owner = 'owner';
const tenant = 'tenant';

// ── 1. Absence de callbackUrl ───────────────────────────────────────────────
test('T1 — aucune query → null', () => {
  assert.equal(safeCallbackUrl('', owner), null);
});

test('T2 — query sans callbackUrl → null', () => {
  assert.equal(safeCallbackUrl('?foo=bar', owner), null);
});

test('T3 — callbackUrl vide → null', () => {
  assert.equal(safeCallbackUrl('?callbackUrl=', owner), null);
});

// ── 2. Chemins internes légitimes (honorés) ─────────────────────────────────
test('T4 — owner vers /dashboard/owner/contracts', () => {
  assert.equal(
    safeCallbackUrl('?callbackUrl=/dashboard/owner/contracts', owner),
    '/dashboard/owner/contracts',
  );
});

test('T5 — owner vers /dashboard/owner/lease (sous-chemin)', () => {
  assert.equal(
    safeCallbackUrl('?callbackUrl=/dashboard/owner/lease/abc123', owner),
    '/dashboard/owner/lease/abc123',
  );
});

test('T6 — tenant vers /apply/<id>', () => {
  assert.equal(
    safeCallbackUrl('?callbackUrl=/apply/650f00aa', tenant),
    '/apply/650f00aa',
  );
});

test('T7 — tenant vers /dashboard/tenant', () => {
  assert.equal(
    safeCallbackUrl('?callbackUrl=/dashboard/tenant', tenant),
    '/dashboard/tenant',
  );
});

test('T8 — chemin neutre (/concierge) honoré quel que soit le rôle', () => {
  assert.equal(safeCallbackUrl('?callbackUrl=/concierge', owner), '/concierge');
  assert.equal(safeCallbackUrl('?callbackUrl=/concierge', tenant), '/concierge');
});

// ── 3. Open-redirect neutralisé ─────────────────────────────────────────────
test('T9 — URL externe https → null', () => {
  assert.equal(
    safeCallbackUrl('?callbackUrl=https://evil.com', owner),
    null,
  );
});

test('T10 — protocole-relatif //evil.com → null', () => {
  assert.equal(safeCallbackUrl('?callbackUrl=//evil.com', owner), null);
});

test('T11 — échappement backslash → null', () => {
  // encodé : /\evil.com  →  certains navigateurs le traitent comme //evil.com
  assert.equal(safeCallbackUrl('?callbackUrl=/%5Cevil.com', owner), null);
  assert.equal(safeCallbackUrl('?callbackUrl=/dashboard%5C..', owner), null);
});

test('T12 — valeur encodée d\'une URL externe → null', () => {
  // https%3A%2F%2Fevil.com décodé → https://evil.com (ne commence pas par /)
  assert.equal(
    safeCallbackUrl('?callbackUrl=https%3A%2F%2Fevil.com', owner),
    null,
  );
});

test('T13 — boucle vers /auth → null', () => {
  assert.equal(safeCallbackUrl('?callbackUrl=/auth/login', owner), null);
  assert.equal(safeCallbackUrl('?callbackUrl=/auth/register', owner), null);
});

// ── 4. Garde de périmètre par rôle ──────────────────────────────────────────
test('T14 — tenant vers espace owner → null (anti fuite cross-rôle)', () => {
  assert.equal(
    safeCallbackUrl('?callbackUrl=/dashboard/owner/contracts', tenant),
    null,
  );
});

test('T15 — owner vers espace tenant → null', () => {
  assert.equal(
    safeCallbackUrl('?callbackUrl=/dashboard/tenant', owner),
    null,
  );
  assert.equal(safeCallbackUrl('?callbackUrl=/apply/x', owner), null);
});

test('T16 — rôle undefined traité comme owner', () => {
  assert.equal(
    safeCallbackUrl('?callbackUrl=/dashboard/owner/contracts', undefined),
    '/dashboard/owner/contracts',
  );
  // …et donc un chemin tenant est refusé pour un rôle inconnu
  assert.equal(safeCallbackUrl('?callbackUrl=/apply/x', undefined), null);
});

// ── 5. Décodage encodé légitime ─────────────────────────────────────────────
test('T17 — chemin interne encodé décodé puis honoré', () => {
  assert.equal(
    safeCallbackUrl('?callbackUrl=%2Fdashboard%2Fowner%2Fcontracts', owner),
    '/dashboard/owner/contracts',
  );
});

console.log('✓ safe-callback-url : 17 cas de test définis');
