import PassportLandingClient from './PassportLandingClient';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PassportLandingClient slug={slug} />;
}
