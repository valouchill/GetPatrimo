import { Metadata } from 'next';
import PropertyDetailClient from './PropertyDetailClient';

export const metadata: Metadata = {
  title: 'Sélection locataire | PatrimoTrust™',
  description: 'Comparez les dossiers, confirmez votre choix et passez ensuite au bail.',
};

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  return <PropertyDetailClient propertyId={id} />;
}
