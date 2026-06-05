import { Metadata } from 'next';
import PassportLandingClient from '../../p/[slug]/PassportLandingClient';

export const metadata: Metadata = {
  title: 'Dossier Certifié getpatrimo | Vérification Propriétaire',
  description: 'Consultez ce dossier de candidature certifié par getpatrimo. Identité vérifiée, solvabilité auditée, conformité Loi Alur.',
};

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PassportLandingClient slug={token} />;
}
