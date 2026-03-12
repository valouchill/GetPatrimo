import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';

/**
 * GET /api/passport/public/[slug]
 * Données teasing pour la landing propriétaire externe + incrément vue
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDiditDb();
    const { slug } = await params;
    const app = await Application.findOne({ passportSlug: slug })
      .select('profile.firstName profile.lastName financialSummary.totalMonthlyIncome patrimometer.grade documents')
      .lean();
    if (!app) {
      return NextResponse.json({ error: 'Passeport introuvable' }, { status: 404 });
    }
    await Application.findByIdAndUpdate((app as any)._id, {
      $inc: { passportViewCount: 1 },
      passportLastViewedAt: new Date(),
    });
    const profile = (app as any).profile || {};
    const patrimometer = (app as any).patrimometer || {};
    const financialSummary = (app as any).financialSummary || {};
    const grade = patrimometer.grade || '';
    const gradeLabel = grade === 'SOUVERAIN' ? 'SOUVERAIN' : grade || 'Non noté';
    return NextResponse.json({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      grade: gradeLabel,
      monthlyNetIncome: financialSummary.totalMonthlyIncome ?? 0,
      hasDocs: Array.isArray((app as any).documents) && (app as any).documents.length > 0,
      docCount: Array.isArray((app as any).documents) ? (app as any).documents.length : 0,
    });
  } catch (e) {
    console.error('GET /api/passport/public/[slug]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
