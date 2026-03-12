import ApplyClient from './ApplyClient';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // L'ID dans l'URL est utilisé comme token pour l'API
  return <ApplyClient token={id} />;
}
