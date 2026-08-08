const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * Garde-fou du couplage Next/Express.
 *
 * server.js maintient `NEXT_SELF_PARSED_PREFIXES` : la liste des préfixes que le
 * middleware Express ne doit PAS parser, parce que les routes Next lisent
 * elles-mêmes `request.json()`. Toute famille de routes oubliée dans cette liste
 * se met à hang en 504 — piège récurrent, déjà survenu (PR #170), et jusqu'ici
 * aucune vérification automatique ne reliait l'arborescence app/api/ à la constante.
 *
 * Ce test liste les routes qui LISENT le corps de la requête et vérifie qu'elles
 * sont couvertes par un préfixe.
 */

const ROOT = path.join(__dirname, '..');

function listApiRoutes(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listApiRoutes(full, acc);
    else if (entry.name === 'route.ts' || entry.name === 'route.js') acc.push(full);
  }
  return acc;
}

/** Extrait la liste de préfixes déclarée dans server.js. */
function declaredPrefixes() {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const start = server.indexOf('NEXT_SELF_PARSED_PREFIXES');
  assert.ok(start > 0, 'NEXT_SELF_PARSED_PREFIXES doit exister dans server.js');
  const block = server
    .slice(start, server.indexOf('];', start))
    // Les commentaires contiennent des apostrophes françaises (« n'étaient ») qui
    // fausseraient l'appariement naïf des quotes : on les retire d'abord.
    .replace(/\/\/[^\n]*/g, '');
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('/api'));
}

describe('couplage Next/Express — body parsing', () => {
  const prefixes = declaredPrefixes();

  it('la liste de préfixes est bien renseignée', () => {
    assert.ok(prefixes.length > 5, `seulement ${prefixes.length} préfixes déclarés`);
  });

  it('toute route Next qui lit le corps est couverte par un préfixe', () => {
    const routes = listApiRoutes(path.join(ROOT, 'app', 'api'));
    const uncovered = [];

    for (const file of routes) {
      const src = fs.readFileSync(file, 'utf8');
      // Ne concerne que les routes qui consomment réellement le corps.
      if (!/request\.json\(\)|req\.json\(\)|request\.formData\(\)|request\.text\(\)/.test(src)) continue;

      const urlPath = '/' + path.relative(ROOT, file)
        .replace(/^app\//, '')
        .replace(/\/route\.(ts|js)$/, '');
      if (!prefixes.some((p) => urlPath.startsWith(p))) uncovered.push(urlPath);
    }

    assert.deepEqual(
      uncovered,
      [],
      `Ces routes lisent le corps mais ne sont couvertes par aucun préfixe de `
      + `NEXT_SELF_PARSED_PREFIXES → elles hangeront en 504 :\n  - ${uncovered.join('\n  - ')}`,
    );
  });
});
