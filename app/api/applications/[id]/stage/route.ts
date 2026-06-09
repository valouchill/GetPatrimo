import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { ownerOwnsApplication } from '@/lib/application-access';

 
const User = require('@/models/User');
 
const Application = require('@/models/Application');

const VALID_STAGES = ['received', 'reviewing', 'shortlisted', 'selected'];

/**
 * PATCH /api/applications/[id]/stage
 * Update the pipeline stage of a candidate application.
 */
export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { stage } = body;

  if (!stage || !VALID_STAGES.includes(stage)) {
    return NextResponse.json({ error: `Stage invalide. Valeurs acceptées : ${VALID_STAGES.join(', ')}` }, { status: 400 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const application = await Application.findById(id);
  if (!application) return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });

  // Sécurité (revue V1 — S7) : la candidature doit relever d'un bien de l'utilisateur.
  if (!(await ownerOwnsApplication(application, user._id))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  application.pipelineStage = stage;
  if (stage === 'selected') {
    application.ownerDecision = 'ACCEPTED';
    application.viewedByOwnerAt = new Date();
  }
  await application.save();

  return NextResponse.json({ success: true, data: { id, stage: application.pipelineStage } });
});
