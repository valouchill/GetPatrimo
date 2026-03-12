/**
 * Utilitaires de vérification de noms (fonction pure, pas une Server Action)
 */

/**
 * Vérifie la cohérence entre le nom extrait de la CNI et le nom saisi dans le formulaire
 */
export function verifyNameConsistency(
  extractedName: { nom?: string; prenom?: string },
  formName: { lastName: string; firstName: string }
): {
  matches: boolean;
  confidence: number;
  message: string;
} {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const extractedNom = normalize(extractedName.nom || '');
  const extractedPrenom = normalize(extractedName.prenom || '');
  const formNom = normalize(formName.lastName);
  const formPrenom = normalize(formName.firstName);

  const nomMatch = extractedNom === formNom || extractedNom.includes(formNom) || formNom.includes(extractedNom);
  const prenomMatch = extractedPrenom === formPrenom || extractedPrenom.includes(formPrenom) || formPrenom.includes(extractedPrenom);

  const matches = nomMatch && prenomMatch;
  const confidence = matches ? 100 : nomMatch || prenomMatch ? 50 : 0;

  let message = '';
  if (matches) {
    message = 'Les noms correspondent parfaitement.';
  } else if (nomMatch && !prenomMatch) {
    message = 'Le nom de famille correspond, mais le prénom diffère. Vérifiez l\'orthographe.';
  } else if (!nomMatch && prenomMatch) {
    message = 'Le prénom correspond, mais le nom de famille diffère. Vérifiez l\'orthographe.';
  } else {
    message = 'Les noms ne correspondent pas. Veuillez vérifier que la pièce d\'identité correspond bien à votre identité.';
  }

  return { matches, confidence, message };
}
