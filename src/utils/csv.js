// Utilitaires CSV
/**
 * Échappe une valeur pour le format CSV
 * @param {any} v - Valeur à échapper
 * @returns {string}
 */
function csvEscape(v) {
  const s = String(v ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

module.exports = { csvEscape };
