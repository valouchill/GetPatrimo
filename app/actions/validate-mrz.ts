'use server';

/**
 * Server Action pour valider la MRZ (Machine Readable Zone) d'une CNI
 * Implémente les algorithmes de vérification des checksums selon ICAO 9303
 */

interface MRZValidationResult {
  isValid: boolean;
  extractedData: {
    lastName: string;
    firstName: string;
    birthDate: string;
    expirationDate: string;
    documentNumber: string;
    nationality: string;
    sex: string;
  } | null;
  checksums: {
    documentNumber: { value: number; calculated: number; valid: boolean };
    birthDate: { value: number; calculated: number; valid: boolean };
    expirationDate: { value: number; calculated: number; valid: boolean };
    overall: { value: number; calculated: number; valid: boolean };
  } | null;
  errors: string[];
  score: number; // 0-100
}

// Table de conversion MRZ selon ICAO 9303
const MRZ_VALUES: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15, 'G': 16, 'H': 17,
  'I': 18, 'J': 19, 'K': 20, 'L': 21, 'M': 22, 'N': 23, 'O': 24, 'P': 25,
  'Q': 26, 'R': 27, 'S': 28, 'T': 29, 'U': 30, 'V': 31, 'W': 32, 'X': 33,
  'Y': 34, 'Z': 35, '<': 0
};

// Poids de la pondération MRZ (cyclique: 7, 3, 1)
const WEIGHTS = [7, 3, 1];

/**
 * Calcule le checksum d'une chaîne MRZ selon ICAO 9303
 */
function calculateChecksum(data: string): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data[i].toUpperCase();
    const value = MRZ_VALUES[char];
    if (value === undefined) {
      // Caractère invalide, on le traite comme '<'
      sum += 0;
    } else {
      sum += value * WEIGHTS[i % 3];
    }
  }
  return sum % 10;
}

/**
 * Nettoie une ligne MRZ (supprime les espaces, normalise les caractères)
 */
function cleanMRZLine(line: string): string {
  return line
    .replace(/\s/g, '')
    .replace(/0/g, 'O') // Correction OCR courante
    .replace(/</g, '<')
    .toUpperCase()
    .trim();
}

/**
 * Parse le nom et prénom depuis la zone nom de la MRZ
 */
function parseNames(nameZone: string): { lastName: string; firstName: string } {
  const parts = nameZone.split('<<');
  const lastName = (parts[0] || '').replace(/</g, ' ').trim();
  const firstName = (parts[1] || '').replace(/</g, ' ').trim();
  return { lastName, firstName };
}

/**
 * Parse une date MRZ (format YYMMDD) vers un format lisible
 */
function parseMRZDate(mrzDate: string): string {
  if (mrzDate.length !== 6) return '';
  
  const yy = parseInt(mrzDate.substring(0, 2), 10);
  const mm = mrzDate.substring(2, 4);
  const dd = mrzDate.substring(4, 6);
  
  // Déterminer le siècle (si > 50, c'est 19XX, sinon 20XX)
  const year = yy > 50 ? 1900 + yy : 2000 + yy;
  
  return `${dd}/${mm}/${year}`;
}

/**
 * Valide une MRZ de CNI française (format TD1 - 3 lignes de 30 caractères)
 */
function validateFrenchIDCard(line1: string, line2: string, line3: string): MRZValidationResult {
  const errors: string[] = [];
  
  // Nettoyer les lignes
  const l1 = cleanMRZLine(line1);
  const l2 = cleanMRZLine(line2);
  const l3 = cleanMRZLine(line3);
  
  // Vérifier la longueur des lignes
  if (l1.length !== 30) {
    errors.push(`Ligne 1 invalide: ${l1.length} caractères au lieu de 30`);
  }
  if (l2.length !== 30) {
    errors.push(`Ligne 2 invalide: ${l2.length} caractères au lieu de 30`);
  }
  if (l3.length !== 30) {
    errors.push(`Ligne 3 invalide: ${l3.length} caractères au lieu de 30`);
  }
  
  if (errors.length > 0) {
    return {
      isValid: false,
      extractedData: null,
      checksums: null,
      errors,
      score: 0
    };
  }
  
  // Parser les données
  // Ligne 1: Type (2) + Pays (3) + Numéro document (9) + Check (1) + Optionnel (15)
  const documentType = l1.substring(0, 2);
  const country = l1.substring(2, 5);
  const documentNumber = l1.substring(5, 14);
  const documentChecksum = parseInt(l1[14], 10);
  
  // Ligne 2: Date naissance (6) + Check (1) + Sexe (1) + Date expiration (6) + Check (1) + Nationalité (3) + Optionnel (11) + Check global (1)
  const birthDate = l2.substring(0, 6);
  const birthChecksum = parseInt(l2[6], 10);
  const sex = l2[7];
  const expirationDate = l2.substring(8, 14);
  const expirationChecksum = parseInt(l2[14], 10);
  const nationality = l2.substring(15, 18);
  const overallChecksum = parseInt(l2[29], 10);
  
  // Ligne 3: Nom << Prénom(s)
  const { lastName, firstName } = parseNames(l3);
  
  // Calculer les checksums
  const calcDocChecksum = calculateChecksum(documentNumber);
  const calcBirthChecksum = calculateChecksum(birthDate);
  const calcExpirationChecksum = calculateChecksum(expirationDate);
  
  // Checksum global (concaténation de plusieurs zones)
  const overallData = documentNumber + l1[14] + l1.substring(15) + 
                      birthDate + l2[6] + expirationDate + l2[14] + l2.substring(18, 29);
  const calcOverallChecksum = calculateChecksum(overallData);
  
  const checksums = {
    documentNumber: {
      value: documentChecksum,
      calculated: calcDocChecksum,
      valid: documentChecksum === calcDocChecksum
    },
    birthDate: {
      value: birthChecksum,
      calculated: calcBirthChecksum,
      valid: birthChecksum === calcBirthChecksum
    },
    expirationDate: {
      value: expirationChecksum,
      calculated: calcExpirationChecksum,
      valid: expirationChecksum === calcExpirationChecksum
    },
    overall: {
      value: overallChecksum,
      calculated: calcOverallChecksum,
      valid: overallChecksum === calcOverallChecksum
    }
  };
  
  // Vérifier chaque checksum
  if (!checksums.documentNumber.valid) {
    errors.push(`Checksum numéro de document invalide (attendu: ${calcDocChecksum}, trouvé: ${documentChecksum})`);
  }
  if (!checksums.birthDate.valid) {
    errors.push(`Checksum date de naissance invalide (attendu: ${calcBirthChecksum}, trouvé: ${birthChecksum})`);
  }
  if (!checksums.expirationDate.valid) {
    errors.push(`Checksum date d'expiration invalide (attendu: ${calcExpirationChecksum}, trouvé: ${expirationChecksum})`);
  }
  if (!checksums.overall.valid) {
    errors.push(`Checksum global invalide (attendu: ${calcOverallChecksum}, trouvé: ${overallChecksum})`);
  }
  
  // Calculer le score
  let score = 0;
  if (checksums.documentNumber.valid) score += 25;
  if (checksums.birthDate.valid) score += 25;
  if (checksums.expirationDate.valid) score += 25;
  if (checksums.overall.valid) score += 25;
  
  return {
    isValid: score === 100,
    extractedData: {
      lastName,
      firstName,
      birthDate: parseMRZDate(birthDate),
      expirationDate: parseMRZDate(expirationDate),
      documentNumber: documentNumber.replace(/</g, ''),
      nationality: country,
      sex: sex === 'M' ? 'Masculin' : sex === 'F' ? 'Féminin' : 'Indéterminé'
    },
    checksums,
    errors,
    score
  };
}

/**
 * Valide une MRZ de passeport (format TD3 - 2 lignes de 44 caractères)
 */
function validatePassport(line1: string, line2: string): MRZValidationResult {
  const errors: string[] = [];
  
  // Nettoyer les lignes
  const l1 = cleanMRZLine(line1);
  const l2 = cleanMRZLine(line2);
  
  // Vérifier la longueur des lignes
  if (l1.length !== 44) {
    errors.push(`Ligne 1 invalide: ${l1.length} caractères au lieu de 44`);
  }
  if (l2.length !== 44) {
    errors.push(`Ligne 2 invalide: ${l2.length} caractères au lieu de 44`);
  }
  
  if (errors.length > 0) {
    return {
      isValid: false,
      extractedData: null,
      checksums: null,
      errors,
      score: 0
    };
  }
  
  // Parser les données
  // Ligne 1: Type (2) + Pays (3) + Nom << Prénom (39)
  const country = l1.substring(2, 5);
  const { lastName, firstName } = parseNames(l1.substring(5));
  
  // Ligne 2: Numéro passeport (9) + Check (1) + Nationalité (3) + Date naissance (6) + Check (1) + Sexe (1) + Date expiration (6) + Check (1) + Données optionnelles (14) + Check (1) + Check global (1)
  const documentNumber = l2.substring(0, 9);
  const documentChecksum = parseInt(l2[9], 10);
  const nationality = l2.substring(10, 13);
  const birthDate = l2.substring(13, 19);
  const birthChecksum = parseInt(l2[19], 10);
  const sex = l2[20];
  const expirationDate = l2.substring(21, 27);
  const expirationChecksum = parseInt(l2[27], 10);
  const optionalData = l2.substring(28, 42);
  const optionalChecksum = parseInt(l2[42], 10);
  const overallChecksum = parseInt(l2[43], 10);
  
  // Calculer les checksums
  const calcDocChecksum = calculateChecksum(documentNumber);
  const calcBirthChecksum = calculateChecksum(birthDate);
  const calcExpirationChecksum = calculateChecksum(expirationDate);
  const calcOptionalChecksum = calculateChecksum(optionalData);
  
  // Checksum global
  const overallData = documentNumber + l2[9] + birthDate + l2[19] + expirationDate + l2[27] + optionalData + l2[42];
  const calcOverallChecksum = calculateChecksum(overallData);
  
  const checksums = {
    documentNumber: {
      value: documentChecksum,
      calculated: calcDocChecksum,
      valid: documentChecksum === calcDocChecksum
    },
    birthDate: {
      value: birthChecksum,
      calculated: calcBirthChecksum,
      valid: birthChecksum === calcBirthChecksum
    },
    expirationDate: {
      value: expirationChecksum,
      calculated: calcExpirationChecksum,
      valid: expirationChecksum === calcExpirationChecksum
    },
    overall: {
      value: overallChecksum,
      calculated: calcOverallChecksum,
      valid: overallChecksum === calcOverallChecksum
    }
  };
  
  // Vérifier chaque checksum
  if (!checksums.documentNumber.valid) {
    errors.push(`Checksum numéro de passeport invalide`);
  }
  if (!checksums.birthDate.valid) {
    errors.push(`Checksum date de naissance invalide`);
  }
  if (!checksums.expirationDate.valid) {
    errors.push(`Checksum date d'expiration invalide`);
  }
  if (!checksums.overall.valid) {
    errors.push(`Checksum global invalide`);
  }
  
  // Calculer le score
  let score = 0;
  if (checksums.documentNumber.valid) score += 25;
  if (checksums.birthDate.valid) score += 25;
  if (checksums.expirationDate.valid) score += 25;
  if (checksums.overall.valid) score += 25;
  
  return {
    isValid: score === 100,
    extractedData: {
      lastName,
      firstName,
      birthDate: parseMRZDate(birthDate),
      expirationDate: parseMRZDate(expirationDate),
      documentNumber: documentNumber.replace(/</g, ''),
      nationality,
      sex: sex === 'M' ? 'Masculin' : sex === 'F' ? 'Féminin' : 'Indéterminé'
    },
    checksums,
    errors,
    score
  };
}

/**
 * Server Action principale pour valider une MRZ
 */
export async function validateMRZ(
  line1: string,
  line2: string,
  line3?: string
): Promise<MRZValidationResult> {
  try {
    // Déterminer le type de document
    const cleanLine1 = cleanMRZLine(line1);
    
    if (line3 && cleanLine1.length <= 30) {
      // Format TD1 (CNI française) - 3 lignes de 30 caractères
      return validateFrenchIDCard(line1, line2, line3);
    } else if (cleanLine1.length >= 44) {
      // Format TD3 (Passeport) - 2 lignes de 44 caractères
      return validatePassport(line1, line2);
    } else {
      return {
        isValid: false,
        extractedData: null,
        checksums: null,
        errors: ['Format MRZ non reconnu. Veuillez fournir une CNI (3 lignes) ou un passeport (2 lignes).'],
        score: 0
      };
    }
  } catch (error) {
    return {
      isValid: false,
      extractedData: null,
      checksums: null,
      errors: [`Erreur lors de la validation MRZ: ${error instanceof Error ? error.message : 'Erreur inconnue'}`],
      score: 0
    };
  }
}

/**
 * Compare les données MRZ avec une identité connue
 */
export async function compareMRZWithIdentity(
  mrzData: MRZValidationResult['extractedData'],
  knownIdentity: { firstName: string; lastName: string; birthDate?: string }
): Promise<{
  matches: boolean;
  matchScore: number;
  details: string[];
}> {
  if (!mrzData) {
    return { matches: false, matchScore: 0, details: ['Données MRZ invalides'] };
  }
  
  const details: string[] = [];
  let score = 0;
  
  // Normaliser les noms pour comparaison
  const normalizeName = (name: string) => 
    name.toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '')
      .trim();
  
  const mrzLastName = normalizeName(mrzData.lastName);
  const mrzFirstName = normalizeName(mrzData.firstName);
  const knownLastName = normalizeName(knownIdentity.lastName);
  const knownFirstName = normalizeName(knownIdentity.firstName);
  
  // Comparer le nom de famille
  if (mrzLastName === knownLastName) {
    score += 40;
    details.push(`✅ Nom de famille correspond: ${mrzData.lastName}`);
  } else if (mrzLastName.includes(knownLastName) || knownLastName.includes(mrzLastName)) {
    score += 20;
    details.push(`⚠️ Nom de famille partiellement correspondant: MRZ="${mrzData.lastName}" vs Connu="${knownIdentity.lastName}"`);
  } else {
    details.push(`❌ Nom de famille ne correspond pas: MRZ="${mrzData.lastName}" vs Connu="${knownIdentity.lastName}"`);
  }
  
  // Comparer le prénom
  if (mrzFirstName === knownFirstName) {
    score += 40;
    details.push(`✅ Prénom correspond: ${mrzData.firstName}`);
  } else if (mrzFirstName.includes(knownFirstName) || knownFirstName.includes(mrzFirstName)) {
    score += 20;
    details.push(`⚠️ Prénom partiellement correspondant: MRZ="${mrzData.firstName}" vs Connu="${knownIdentity.firstName}"`);
  } else {
    details.push(`❌ Prénom ne correspond pas: MRZ="${mrzData.firstName}" vs Connu="${knownIdentity.firstName}"`);
  }
  
  // Comparer la date de naissance si disponible
  if (knownIdentity.birthDate && mrzData.birthDate) {
    // Normaliser les formats de date
    const mrzBirthDate = mrzData.birthDate.replace(/\//g, '');
    const knownBirthDate = knownIdentity.birthDate.replace(/[\/-]/g, '');
    
    if (mrzBirthDate === knownBirthDate) {
      score += 20;
      details.push(`✅ Date de naissance correspond: ${mrzData.birthDate}`);
    } else {
      details.push(`❌ Date de naissance ne correspond pas: MRZ="${mrzData.birthDate}" vs Connu="${knownIdentity.birthDate}"`);
    }
  }
  
  return {
    matches: score >= 60,
    matchScore: score,
    details
  };
}
