import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { z } from 'zod';
import mongoose from 'mongoose';

const addManagementSchema = z.object({
  // Bien
  name: z.string().min(1, 'Le nom du bien est obligatoire'),
  address: z.string().min(1, "L'adresse est obligatoire"),
  zipCode: z.string().optional().default(''),
  city: z.string().optional().default(''),
  surfaceM2: z.number().min(0).optional().nullable(),
  // Bail
  rentAmount: z.number().min(0, 'Le loyer ne peut pas être négatif'),
  chargesAmount: z.number().min(0).optional().default(0),
  depositAmount: z.number().min(0).optional().default(0),
  leaseType: z.enum(['VIDE', 'MEUBLE', 'MOBILITE', 'GARAGE_PARKING']).optional().default('VIDE'),
  startDate: z.string().min(1, 'La date de début est obligatoire'),
  paymentDay: z.number().min(1).max(31).optional().default(5),
  // Locataire
  tenantFirstName: z.string().min(1, 'Le prénom du locataire est obligatoire'),
  tenantLastName: z.string().min(1, 'Le nom du locataire est obligatoire'),
  tenantEmail: z.string().email('Email invalide'),
  tenantPhone: z.string().optional().default(''),
});

export async function POST(req: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const result = addManagementSchema.safeParse(body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message || 'Données invalides' },
        { status: 400 }
      );
    }

    const data = result.data;
    const userId = new mongoose.Types.ObjectId(session.user.id);

    // Chargement dynamique des modèles (évite les problèmes de compilation Next.js)
    const Property = (await import('@/models/Property')).default;
    const Lease = (await import('@/models/Lease')).default;

    // 1. Créer le bien directement en statut OCCUPIED + managed
    const property = await Property.create({
      user: userId,
      name: data.name,
      address: data.address,
      addressLine: data.address,
      zipCode: data.zipCode,
      city: data.city,
      surfaceM2: data.surfaceM2 || null,
      rentAmount: data.rentAmount,
      chargesAmount: data.chargesAmount,
      status: 'OCCUPIED',
      managed: true,
    });

    // 2. Créer le bail associé (source MANUAL, sans candidature)
    const lease = await Lease.create({
      user: userId,
      property: property._id,
      candidature: null,
      source: 'MANUAL',
      tenantFirstName: data.tenantFirstName,
      tenantLastName: data.tenantLastName,
      tenantEmail: data.tenantEmail,
      tenantPhone: data.tenantPhone,
      startDate: new Date(data.startDate),
      rentAmount: data.rentAmount,
      chargesAmount: data.chargesAmount,
      depositAmount: data.depositAmount,
      leaseType: data.leaseType,
      paymentDay: data.paymentDay,
      signatureStatus: 'SIGNED_BOTH',
      durationMonths: data.leaseType === 'MEUBLE' ? 12 : data.leaseType === 'MOBILITE' ? 10 : 36,
    });

    return NextResponse.json({
      success: true,
      property: {
        id: property._id,
        name: property.name,
        address: property.address,
        status: property.status,
      },
      lease: {
        id: lease._id,
        tenantName: `${data.tenantFirstName} ${data.tenantLastName}`,
        startDate: lease.startDate,
        rentAmount: lease.rentAmount,
      },
    }, { status: 201 });

  } catch (err: unknown) {
    console.error('[management/add]', err);
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
