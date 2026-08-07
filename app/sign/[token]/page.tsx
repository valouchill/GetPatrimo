import { SignClient } from './SignClient';

export const metadata = {
  title: 'Signer le bail — Maison Patrimo',
  // Page privée par nature (accès par lien personnel) : jamais indexée.
  robots: { index: false, follow: false },
};

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SignClient token={token} />;
}
