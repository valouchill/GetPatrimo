import { Metadata } from 'next';
import PropertyDetailClient from './PropertyDetailClient';

export const metadata: Metadata = {
  title: 'Sélection des Candidats | PatrimoTrust™',
  description: 'Consultez et sélectionnez les meilleurs candidats pour votre bien.',
};

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  return <PropertyDetailClient propertyId={id} />;
}
