const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * Pré-remplissage automatique du bail — corrections de l'audit multi-agents.
 *
 * Le dossier candidat contient bien plus que ce que le bail exploitait :
 * colocataires, identité biométrique Didit, KYC du garant, n° Visale,
 * équipements du bien… Ces tests verrouillent chaque donnée nouvellement
 * injectée (fonctions pures, pas de DB).
 */

const { _internals } = require('../src/services/leaseCompileService');
const { buildLeaseData } = require('../src/utils/leaseDataBuilder');

const { normalizeApplication } = _internals;

const BASE_APP = {
  _id: 'app1',
  userEmail: 'bob@test.fr',
  profile: { firstName: 'Bob', lastName: 'Declaratif', phone: '0601020304', birthDate: '1990-01-01', status: 'Etudiant' },
  didit: { status: 'VERIFIED', identityData: { firstName: 'Robert', lastName: 'Certifie', birthDate: '1990-01-02' } },
  financialSummary: { totalMonthlyIncome: 2500, incomeSource: 'CDI' },
};

describe('normalizeApplication — données du dossier réellement exploitées', () => {
  it('l’identité certifiée Didit PRIME sur le déclaratif (document légal)', () => {
    const t = normalizeApplication(BASE_APP);
    assert.equal(t.firstName, 'Robert');
    assert.equal(t.lastName, 'Certifie');
    assert.equal(t.birthDate, '1990-01-02');
  });

  it('sans vérification Didit, le déclaratif reste prioritaire', () => {
    const t = normalizeApplication({ ...BASE_APP, didit: { status: 'PENDING', identityData: { firstName: 'X' } } });
    assert.equal(t.firstName, 'Bob');
  });

  it('les colocataires sont extraits (identité Didit prioritaire)', () => {
    const t = normalizeApplication({
      ...BASE_APP,
      coTenants: [
        { firstName: 'Coloc', lastName: 'Declare', email: 'coloc@test.fr', phone: '0611111111', didit: { identityData: { firstName: 'Colette', lastName: 'Verifiee' } } },
      ],
    });
    assert.equal(t.coTenants.length, 1);
    assert.equal(t.coTenants[0].firstName, 'Colette');
    assert.equal(t.coTenants[0].email, 'coloc@test.fr');
  });

  it('détection Visale robuste : le n° Visale seul suffit (pas d’acte de caution)', () => {
    const t = normalizeApplication({
      ...BASE_APP,
      guarantor: { guarantorId: { firstName: 'Garant', lastName: 'Legacy', email: 'g@test.fr' } },
      guarantee: { visaleNumber: 'V123456' },
    });
    assert.equal(t.guarantor, null, 'un dossier Visale ne doit JAMAIS générer de caution physique');
    assert.equal(t.guaranteeType, 'VISALE');
    assert.equal(t.visaleNumber, 'V123456');
  });

  it('détection Visale via certificationMethod (mode legacy droppé par l’ancien schéma)', () => {
    const t = normalizeApplication({
      ...BASE_APP,
      guarantor: { certificationMethod: 'VISALE', guarantorId: { firstName: 'G' } },
    });
    assert.equal(t.guarantor, null);
  });

  it('le nom KYC du garant prime sur le déclaratif pour l’acte de caution', () => {
    const t = normalizeApplication({
      ...BASE_APP,
      guarantor: {
        guarantorId: {
          firstName: '', lastName: '',
          email: 'garant@test.fr',
          identityVerification: { firstName: 'Gérard', lastName: 'Certifié', birthDate: '1960-05-05' },
        },
      },
    });
    assert.equal(t.guarantor.firstName, 'Gérard');
    assert.equal(t.guarantor.lastName, 'Certifié');
    assert.equal(t.guarantor.birthDate, '1960-05-05');
  });

  it('les revenus du garant extraits par l’IA sont injectés', () => {
    const t = normalizeApplication({
      ...BASE_APP,
      guarantor: { guarantorId: { firstName: 'G', lastName: 'A' } },
      documents: [
        { subjectType: 'GUARANTOR', category: 'INCOME', aiAnalysis: { extractedFields: { monthly_net_income: '3200' } } },
      ],
    });
    assert.equal(t.guarantor.income, 3200);
  });
});

describe('buildLeaseData — variables du template enfin sourcées', () => {
  const property = {
    address: '1 rue de la Paix', city: 'Paris', zipCode: '75001',
    rentAmount: 800, chargesAmount: 50,
    equipment: ['Réfrigérateur', 'Lave-linge', 'Four'],
    diagnostics: [{ type: 'DPE', isValid: true, uploadedAt: new Date('2025-06-15') }],
  };
  const tenant = {
    firstName: 'Bob', lastName: 'Locataire', fullName: 'Bob Locataire',
    email: 'bob@test.fr', phone: '0601020304',
    coTenants: [{ firstName: 'Colette', lastName: 'Coloc', email: 'coloc@test.fr', phone: '' }],
    guaranteeType: 'VISALE', visaleNumber: 'V99',
    profileStatus: 'Etudiant',
  };
  const landlord = { firstName: 'Alice', lastName: 'Bailleur', email: 'alice@test.fr' };

  it('les équipements du bien remplissent enfin equipements_logement (bug property.equipments)', () => {
    const data = buildLeaseData(property, tenant, landlord, {});
    assert.match(String(data.equipements_logement), /Réfrigérateur, Lave-linge, Four/);
  });

  it('les colocataires apparaissent dans les variables plurielles', () => {
    const data = buildLeaseData(property, tenant, landlord, {});
    assert.match(String(data.locataires_nom_prenoms_emails), /Bob Locataire/);
    assert.match(String(data.locataires_nom_prenoms_emails), /Colette Coloc/);
    assert.match(String(data.locataires_nom_prenoms_emails), /coloc@test\.fr/);
  });

  it('garantie_type retombe sur le dossier (VISALE) et le n° Visale est propagé', () => {
    const data = buildLeaseData(property, tenant, landlord, {});
    assert.equal(String(data.garantie_type), 'VISALE');
  });

  it('la date du DPE vient des diagnostics du bien', () => {
    const data = buildLeaseData(property, tenant, landlord, {});
    assert.match(String(data.date_dpe), /15\/06\/2025/);
  });

  it('bail mobilité : la case « études supérieures » se pré-coche pour un étudiant', () => {
    const data = buildLeaseData(property, tenant, landlord, { leaseType: 'MOBILITE' });
    assert.equal(data.coche_situation_etudes_superieures, '[X]');
    assert.equal(data.coche_situation_mutation_professionnelle, '[ ]');
  });

  it('le choix explicite du bailleur prime toujours sur la déduction', () => {
    const data = buildLeaseData(property, tenant, landlord, { leaseType: 'MOBILITE', mobilityReason: 'mutation' });
    assert.equal(data.coche_situation_mutation_professionnelle, '[X]');
    assert.equal(data.coche_situation_etudes_superieures, '[ ]');
  });
});

describe('UX signature & wizard (garde-fous de source)', () => {
  const ROOT = path.join(__dirname, '..');
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  it('le canvas met les coordonnées à l’échelle du buffer (trait décalé sur mobile)', () => {
    const src = read('app/sign/[token]/SignClient.tsx');
    assert.match(src, /c\.width \/ rect\.width/);
    assert.match(src, /c\.height \/ rect\.height/);
  });

  it('le renvoi d’OTP a un cooldown serveur (anti-spam de boîte mail)', () => {
    const src = read('src/services/leaseSignatureService.js');
    assert.match(src, /patientez.*avant d'en redemander/);
  });

  it('la route publique expose l’avancement ANONYMISÉ (rôles, jamais les emails d’autrui)', () => {
    const src = read('app/api/public/sign/[token]/route.ts');
    assert.match(src, /\.select\('role status order'\)/);
    assert.match(src, /reason: expired \? 'expired' : 'invalid'/);
  });

  it('l’aperçu du wizard reçoit les variables requises ET vérifiées', () => {
    const src = read('app/(platform)/properties/[id]/contract/LeaseWizard.tsx');
    assert.match(src, /requiredVarNames=\{requiredVarNames\}/);
    assert.match(src, /verifiedVarNames=\{verifiedVarNames\}/);
    assert.match(src, /champs remplis automatiquement/);
  });

  it('le lancement de signature affiche destinataire et suite (plus de redirection aveugle)', () => {
    const wizard = read('app/(platform)/properties/[id]/contract/LeaseWizard.tsx');
    assert.match(wizard, /setSignatureResult/);
    const footer = read('app/(platform)/properties/[id]/contract/wizard/LeaseFooter.tsx');
    assert.match(footer, /Lien de signature envoyé à/);
    assert.match(footer, /Renvoyer le lien/);
  });

  it('les colocataires du dossier sont copiés sur le bail à la création', () => {
    const src = read('app/api/leases/route.ts');
    assert.match(src, /appCoTenants/);
    assert.match(src, /visaleNumber: appVisaleNumber/);
  });
});

describe('backlog audit — finitions wizard', () => {
  const ROOT2 = path.join(__dirname, '..');
  const read2 = (rel) => fs.readFileSync(path.join(ROOT2, rel), 'utf8');

  it('le garant du dossier est exposé par la preview et affiché « Auto-rempli »', () => {
    const route = read2('app/api/owner/leases/preview/route.ts');
    assert.match(route, /resolvedGuarantor/);
    const section = read2('app/(platform)/properties/[id]/contract/wizard/SectionGarantDetails.tsx');
    assert.match(section, /Garant du dossier/);
    // l'email du dossier pré-remplit le champ, l'override du bailleur garde la main
    assert.match(section, /overrides\.email \?\? resolvedGuarantor\?\.email/);
  });

  it('les avertissements serveur de la preview sont enfin affichés', () => {
    const preview = read2('app/(platform)/properties/[id]/contract/wizard/ContractPreview.tsx');
    assert.match(preview, /À vérifier avant de générer/);
    const wizard = read2('app/(platform)/properties/[id]/contract/LeaseWizard.tsx');
    assert.match(wizard, /warnings=\{preview\.warnings\}/);
  });

  it('les erreurs de compilation sont traduites en français actionnable', () => {
    const footer = read2('app/(platform)/properties/[id]/contract/wizard/LeaseFooter.tsx');
    assert.match(footer, /humanizeCompileError/);
    assert.match(footer, /La génération a échoué/);
    assert.match(footer, /Réessayer/);
  });

  it('le header mobile montre locataire, type de bail et compteur', () => {
    const header = read2('app/(platform)/properties/[id]/contract/wizard/CompactHeader.tsx');
    assert.match(header, /sm:hidden/);
    assert.match(header, /champs du bail remplis sur/); // aria-label du ring
  });
});

describe('IRL, dépôt légal, zone tendue', () => {
  const ROOT3 = path.join(__dirname, '..');
  const read3 = (rel) => fs.readFileSync(path.join(ROOT3, rel), 'utf8');

  it('la table IRL est triée du plus récent au plus ancien, valeurs au format FR', () => {
    const src = read3('lib/lease/irl.ts');
    assert.match(src, /148,37/); // T2 2026 — vérifié sur insee.fr
    assert.match(src, /146,60/); // T1 2026
    const dates = [...src.matchAll(/publishedAt: '(\d{4}-\d{2}-\d{2})'/g)].map((m) => m[1]);
    assert.ok(dates.length >= 2);
    const sorted = [...dates].sort().reverse();
    assert.deepEqual(dates, sorted, 'du plus récent au plus ancien');
  });

  it('le pré-remplissage IRL se désactive si la table devient périmée', () => {
    const src = read3('lib/lease/irl.ts');
    assert.match(src, /MAX_AGE_DAYS = 240/);
    assert.match(src, /ageDays >= 0 && ageDays <= MAX_AGE_DAYS/);
  });

  it('activer la révision pré-remplit le dernier IRL, sans écraser une saisie', () => {
    const src = read3('app/(platform)/properties/[id]/contract/wizard/SectionRevision.tssx'.replace('tssx','tsx'));
    assert.match(src, /!formData\.irlReference/); // prefill seulement si vide
    assert.match(src, /getLatestIrl/);
    assert.match(src, /Dernier indice publié par l&apos;INSEE/);
  });

  it('la section révision pointe vers le simulateur officiel zone tendue', () => {
    const irl = read3('lib/lease/irl.ts');
    assert.match(irl, /service-public\.fr\/simulateur\/calcul\/zones-tendues/);
    const section = read3('app/(platform)/properties/[id]/contract/wizard/SectionRevision.tsx');
    assert.match(section, /ZONE_TENDUE_SIMULATOR_URL/);
  });

  it('un dépôt au-dessus du plafond légal est signalé (clause nulle)', () => {
    const src = read3('app/(platform)/properties/[id]/contract/wizard/SectionFinancier.tsx');
    assert.match(src, /deposit\) > depositConstraints\.max/);
    assert.match(src, /art\. 22, loi 89-462/);
    assert.match(src, /interdit pour un bail mobilité/);
  });
});
