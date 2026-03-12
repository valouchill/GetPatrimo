import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import { notifyPassportViewed } from '@/app/actions/share-passport';

/**
 * GET /api/verify/[token]
 * Retourne les données "teasing" d'une candidature pour un propriétaire externe
 * Le token est soit un shareToken soit un passportSlug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectDiditDb();
    const { token } = await params;
    
    // Chercher par slug ou par shareToken
    // Pour l'instant on utilise le slug comme identifiant
    const app = await Application.findOne({
      $or: [
        { passportSlug: token },
        // On pourrait ajouter un champ shareTokens[] pour les tokens de partage
      ]
    }).lean();
    
    if (!app) {
      return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 });
    }
    
    const appData = app as any;
    const profile = appData.profile || {};
    const patrimometer = appData.patrimometer || {};
    const didit = appData.didit || {};
    const guarantor = appData.guarantor || {};
    const financialSummary = appData.financialSummary || {};
    const breakdown = patrimometer.breakdown || {};
    
    // Incrémenter le compteur de vues
    await Application.findByIdAndUpdate(appData._id, {
      $inc: { passportViewCount: 1 },
      passportLastViewedAt: new Date()
    });
    
    // Notifier le locataire (en arrière-plan)
    notifyPassportViewed(appData._id.toString()).catch(console.error);
    
    // Calculer l'âge si date de naissance disponible
    let age: number | undefined;
    const birthDate = profile.birthDate || didit.identityData?.birthDate;
    if (birthDate) {
      const birth = new Date(birthDate);
      const today = new Date();
      age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
    }

    // Générer le passportId
    const passportId = `PT-${new Date().getFullYear()}-${appData._id.toString().slice(-8).toUpperCase()}`;

    // Retourner les données "teasing" (pas les documents sensibles)
    return NextResponse.json({
      firstName: profile.firstName || 'Candidat',
      lastName: profile.lastName ? profile.lastName.charAt(0) + '.' : '',
      age,
      profession: 'Salarié(e)', // TODO: Récupérer depuis les documents
      contractType: 'CDI', // TODO: Récupérer depuis attestation employeur
      location: 'Île-de-France', // TODO: Récupérer depuis justificatif domicile
      score: patrimometer.score || 0,
      grade: patrimometer.grade || 'F',
      identityVerified: didit.status === 'VERIFIED',
      incomeVerified: financialSummary.certifiedIncome || false,
      guarantorCertified: guarantor.status === 'CERTIFIED' || guarantor.status === 'AUDITED',
      monthlyIncome: financialSummary.totalMonthlyIncome > 0 
        ? Math.round(financialSummary.totalMonthlyIncome / 100) * 100 // Arrondir pour le teasing
        : undefined,
      effortRate: 28, // Valeur teasing - la vraie valeur après inscription
      passportId,
      pillars: {
        identity: {
          verified: didit.status === 'VERIFIED',
        },
        domicile: {
          verified: appData.documents?.some((d: any) => d.category === 'address' && d.status === 'certified') || false,
        },
        activity: {
          verified: appData.documents?.some((d: any) => 
            (d.type === 'contrat_travail' || d.type === 'attestation_employeur') && d.status === 'certified'
          ) || false,
        },
        resources: {
          verified: financialSummary.certifiedIncome || false,
        },
      },
      certificationDate: appData.updatedAt 
        ? new Date(appData.updatedAt).toLocaleDateString('fr-FR')
        : new Date().toLocaleDateString('fr-FR'),
    });
    
  } catch (error) {
    console.error('GET /api/verify/[token]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
