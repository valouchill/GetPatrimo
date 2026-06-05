import { Metadata } from 'next';
import PropertyDetailClient from './PropertyDetailClient';
import { OwnerShell } from '../../components/OwnerShell';

export const metadata: Metadata = {
  title: 'Fiche bien | getpatrimo',
  description: 'Vue d\'ensemble du bien, candidatures, documents et gestion locative.',
};

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // V8.3 (audit C2) — enveloppé dans OwnerShell : la page était orpheline
  // (pas de Sidebar). Conteneur padded car PropertyDetailClient ne porte
  // pas de marge interne (root: space-y-4 pb-12).
  return (
    <OwnerShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PropertyDetailClient propertyId={id} />
      </div>
    </OwnerShell>
  );
}
