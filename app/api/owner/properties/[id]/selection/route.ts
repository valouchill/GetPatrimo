import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { validateRequest } from '@/lib/validate-request';
import { SelectionSchema } from '@/lib/validations/lease';
import { logger } from '@/lib/server-logger';

import Property from '@/models/Property';
import Application from '@/models/Application';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
};

function selectionPayload(propertyId: string, applicationId: string | null) {
  return {
    ok: true,
    selectedCandidateId: applicationId,
    propertyId,
    leaseHref: applicationId ? `/dashboard/owner/lease/${applicationId}` : null,
    contractHubHref: '/dashboard/owner/contracts',
  };
}

async function resolveUserId(session: any): Promise<string | null> {
  let userId = session?.user?.id;
  if (!userId && session?.user?.email) {
    const user = await User.findOne({ email: session.user.email }).select('_id').lean();
    userId = user?._id?.toString();
  }
  return userId || null;
}

async function getPropertyForOwner(propertyId: string, userId: string) {
  return Property.findOne({ _id: propertyId, user: userId });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDiditDb();
    const userId = await resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = validateRequest(SelectionSchema, body);
    if (!result.success) return result.response;
    const { applicationId } = result.data;

    const property = await getPropertyForOwner(id, userId);
    if (!property) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });
    }

    if (!property.managed && !property.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Le bien doit d’abord être déverrouillé pour sélectionner un dossier.' },
        { status: 409 }
      );
    }

    if (['LEASE_IN_PROGRESS', 'OCCUPIED'].includes(String(property.status || '').toUpperCase())) {
      return NextResponse.json(
        { error: 'La sélection ne peut plus être modifiée une fois le bail engagé.' },
        { status: 409 }
      );
    }

    const application: any = await Application.findOne({
      _id: applicationId,
      property: property._id,
      status: { $in: ['COMPLETE', 'SUBMITTED', 'PENDING_REVIEW', 'ACCEPTED'] },
    }).lean();

    if (!application) {
      return NextResponse.json({ error: 'Dossier introuvable pour ce bien.' }, { status: 404 });
    }

    // V7.5 — Persistance complète de la sélection :
    //   1. Property.acceptedTenantId = application._id (source de vérité)
    //   2. Property.status : passe de "AVAILABLE"/"VACANT"/"" à
    //      "CANDIDATE_SELECTION" pour que le dashboard reflète l'état
    //      (sans toucher les statuts en aval : LEASE_IN_PROGRESS, OCCUPIED)
    const currentStatus = String(property.status || '').toUpperCase();
    const statusUpdate =
      ['', 'AVAILABLE', 'VACANT', 'DRAFT'].includes(currentStatus)
        ? { status: 'CANDIDATE_SELECTION' }
        : {};

    await Property.updateOne(
      { _id: property._id },
      {
        $set: {
          acceptedTenantId: application._id,
          ...statusUpdate,
        },
      }
    );

    await Application.updateMany(
      {
        property: property._id,
        ownerDecision: 'ACCEPTED',
        _id: { $ne: application._id },
      },
      {
        $set: {
          ownerDecision: 'PENDING',
          status: 'SUBMITTED',
        },
      }
    );

    await Application.updateOne(
      { _id: application._id },
      {
        $set: {
          status: 'ACCEPTED',
          ownerDecision: 'ACCEPTED',
          viewedByOwnerAt: new Date(),
        },
      }
    );

    logger.info('selection saved', {
      propertyId: String(property._id),
      applicationId: String(application._id),
      previousStatus: currentStatus,
      newStatus: statusUpdate.status || currentStatus,
    });

    return NextResponse.json(
      selectionPayload(String(property._id), String(application._id)),
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    logger.error('PUT /api/owner/properties/[id]/selection', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDiditDb();
    const userId = await resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 });
    }

    const { id } = await params;
    const property = await getPropertyForOwner(id, userId);
    if (!property) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });
    }

    if (['LEASE_IN_PROGRESS', 'OCCUPIED'].includes(String(property.status || '').toUpperCase())) {
      return NextResponse.json(
        { error: 'La sélection ne peut plus être retirée une fois le bail engagé.' },
        { status: 409 }
      );
    }

    const previousSelectionId = property.acceptedTenantId ? String(property.acceptedTenantId) : null;
    const currentStatus = String(property.status || '').toUpperCase();
    // V7.5 — Symétrie avec PUT : si on retire la sélection ET que le bien
    // était en CANDIDATE_SELECTION (résultat de la sélection précédente),
    // on le repasse en AVAILABLE.
    const statusRevert =
      currentStatus === 'CANDIDATE_SELECTION'
        ? { status: 'AVAILABLE' }
        : {};

    await Property.updateOne(
      { _id: property._id },
      {
        $set: {
          acceptedTenantId: null,
          ...statusRevert,
        },
      }
    );

    if (previousSelectionId) {
      await Application.updateOne(
        { _id: previousSelectionId },
        {
          $set: {
            status: 'SUBMITTED',
            ownerDecision: 'PENDING',
          },
        }
      );
    }

    return NextResponse.json(
      selectionPayload(String(property._id), null),
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    logger.error('DELETE /api/owner/properties/[id]/selection', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
