/**
 * /pricing — Page tarifaire "Pay-per-Listing" (achat one-time par bien).
 *
 * Accessible sans authentification (marketing). Si un owner est connecté, on
 * charge ses biens côté serveur (léger : id + libellé) pour permettre l'achat
 * direct depuis la page (sélecteur de bien) sans aller-retour lent.
 */

import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { PricingClient, type PricingProperty } from './PricingClient';


const User = require('@/models/User');

const Property = require('@/models/Property');

export const metadata = {
  title: 'Tarifs · Maison Patrimo',
  description:
    'Paiement unique par logement : analysez vos dossiers locataires avec l’IA anti-fraude. Offres Essentiel, Analyse IA et Max.',
};

async function getOwnerContext(): Promise<{
  authenticated: boolean;
  properties: PricingProperty[];
}> {
  const session = (await getServerSession(authOptions as Record<string, unknown>)) as
    | { user?: { email?: string } }
    | null;
  if (!session?.user?.email) return { authenticated: false, properties: [] };
  try {
    await connectDiditDb();
    const user = await User.findOne({ email: session.user.email }).select('_id').lean();
    if (!user?._id) return { authenticated: true, properties: [] };
    const props = await Property.find({ user: user._id, archived: { $ne: true } })
      .select('name address')
      .sort({ createdAt: -1 })
      .lean();
    return {
      authenticated: true,
      properties: (props as Array<{ _id: unknown; name?: string; address?: string }>).map(
        (p) => ({
          id: String(p._id),
          label: p.name || p.address || 'Bien sans nom',
        }),
      ),
    };
  } catch {
    // En cas d'erreur DB, on dégrade proprement vers « connecté, sans bien chargé ».
    return { authenticated: true, properties: [] };
  }
}

export default async function PricingPage(): Promise<React.ReactElement> {
  const { authenticated, properties } = await getOwnerContext();
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <PricingClient authenticated={authenticated} properties={properties} />
    </Suspense>
  );
}
