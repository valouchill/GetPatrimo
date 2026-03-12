// Service de validation géographique (communes françaises)
const { GEO_VALIDATION } = require('../config/app');

/**
 * Valide qu'un code postal et une commune correspondent via l'API geo.api.gouv.fr
 * @param {string} zipCode - Code postal (5 chiffres)
 * @param {string} city - Nom de la commune
 * @returns {Promise<boolean>}
 */
async function validateFrenchCommune(zipCode, city) {
  if (!GEO_VALIDATION) {
    return true;
  }

  const z = String(zipCode || '').trim();
  const c = String(city || '').trim();

  if (!/^\d{5}$/.test(z) || !c) {
    return false;
  }

  const url = "https://geo.api.gouv.fr/communes?nom=" + encodeURIComponent(c) +
    "&codePostal=" + encodeURIComponent(z) +
    "&fields=nom,codesPostaux&limit=5";

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 3500);

  try {
    const response = await fetch(url, { 
      signal: ctrl.signal, 
      headers: { accept: "application/json" } 
    });
    
    if (!response.ok) {
      return false;
    }

    const arr = await response.json();
    return Array.isArray(arr) && arr.length > 0;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { validateFrenchCommune };
