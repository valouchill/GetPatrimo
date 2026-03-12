import GuarantorVerificationClient from './GuarantorVerificationClient';

export default async function GuarantorVerificationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <GuarantorVerificationClient token={token} />;
}
