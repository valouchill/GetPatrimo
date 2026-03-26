import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Application = require('@/models/Application');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Candidature = require('@/models/Candidature');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Lease = require('@/models/Lease');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Document = require('@/models/Document');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Event = require('@/models/Event');

/**
 * GET /api/user/export
 * RGPD : exporte toutes les données personnelles de l'utilisateur en JSON.
 * Inclut : profil, propriétés, candidatures, baux, documents (metadata sans fichiers), événements.
 */
export async function GET() {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    await connectDiditDb();

    const user = await User.findOne({ email: session.user.email })
      .select('-password -magicSignInToken -__v')
      .lean();

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const userId = user._id;

    const [properties, applications, candidatures, leases, documents, events] = await Promise.all([
      Property.find({ user: userId }).select('-__v').lean(),
      Application.find({ $or: [{ user: userId }, { userEmail: session.user.email }] }).select('-__v').lean(),
      Candidature.find({ user: userId }).select('-__v').lean(),
      Lease.find({ user: userId }).select('-__v').lean(),
      Document.find({ user: userId }).select('-filePath -__v').lean(), // metadata sans fichiers
      Event.find({ user: userId }).select('-__v').sort({ createdAt: -1 }).limit(500).lean(),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        plan: user.plan,
        createdAt: user.createdAt,
      },
      properties: properties.map((p: any) => ({
        id: p._id,
        name: p.name,
        address: p.address,
        status: p.status,
        rentAmount: p.rentAmount,
        createdAt: p.createdAt,
      })),
      applications,
      candidatures,
      leases: leases.map((l: any) => ({
        id: l._id,
        property: l.property,
        tenantEmail: l.tenantEmail,
        startDate: l.startDate,
        endDate: l.endDate,
        rentAmount: l.rentAmount,
        leaseType: l.leaseType,
        signatureStatus: l.signatureStatus,
        createdAt: l.createdAt,
      })),
      documents: documents.map((d: any) => ({
        id: d._id,
        type: d.type,
        originalName: d.originalName,
        mimeType: d.mimeType,
        property: d.property,
        createdAt: d.createdAt,
      })),
      events: events.map((e: any) => ({
        type: e.type,
        meta: e.meta,
        createdAt: e.createdAt,
      })),
    };

    // Logger l'action RGPD
    await Event.create({
      user: userId,
      type: 'RGPD_EXPORT',
      meta: new Map([['action', 'export_data'], ['date', new Date().toISOString()]]),
    });

    return NextResponse.json(exportData);
  } catch (err) {
    console.error('[GET /api/user/export] Erreur:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
