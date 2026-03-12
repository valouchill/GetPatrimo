import SuccessClient from './SuccessClient';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const candidatureId = typeof params?.candidatureId === 'string' ? params.candidatureId : undefined;
  const ownerName = typeof params?.ownerName === 'string' ? params.ownerName : undefined;
  return <SuccessClient candidatureId={candidatureId} ownerName={ownerName} />;
}
