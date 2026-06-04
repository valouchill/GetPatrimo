/**
 * Préchargé avant toute la suite (voir package.json: `test` / `test:coverage`,
 * via `node --require ./tests/_setup.js`).
 *
 * 1) Secrets de test : certains modules exigent la présence de variables
 *    (ex. JWT_SECRET) dès leur import. On fournit des valeurs de test pour que
 *    la suite soit autonome (aucune dépendance à un .env réel).
 *
 * 2) Horloge figée : plusieurs tests valident la « récence » des justificatifs
 *    (bulletins de salaire, etc.) avec des dates fixes. Sans horloge figée, ces
 *    tests « pourrissent » avec le temps (un dossier frais finit par être jugé
 *    périmé). On fige `new Date()` / `Date.now()` à une date stable proche de
 *    celle des fixtures, tout en gardant `new Date(arg)` intact.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-not-for-production-0123456789';
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-nextauth-secret-not-for-production';

const RealDate = Date;
const FROZEN_NOW = new RealDate('2026-03-10T12:00:00.000Z').getTime();

class FrozenDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) {
      super(FROZEN_NOW);
    } else {
      super(...args);
    }
  }

  static now() {
    return FROZEN_NOW;
  }
}

// Mongoose mappe les types de schéma par NOM de constructeur (`{ type: Date }`
// → name === 'Date'). Sans ça, une sous-classe nommée 'FrozenDate' casse le
// chargement des modèles. On rétablit donc le nom 'Date'.
Object.defineProperty(FrozenDate, 'name', { value: 'Date' });

globalThis.Date = FrozenDate;
