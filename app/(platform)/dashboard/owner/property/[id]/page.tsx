import { Metadata } from 'next';
import PropertyDetailClient from './PropertyDetailClient';

export const metadata: Metadata = {
  title: 'Fiche bien | PatrimoTrust™',
  description: 'Vue d\'ensemble du bien, candidatures, documents et gestion locative.',
};

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  return <PropertyDetailClient propertyId={id} />;
}
