import CoTenantVerificationClient from './CoTenantVerificationClient';

export default async function CoTenantVerificationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CoTenantVerificationClient token={token} />;
}
