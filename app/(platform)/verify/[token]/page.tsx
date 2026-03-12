import { Metadata } from 'next';
import VerifyLandingClient from './VerifyLandingClient';

export const metadata: Metadata = {
  title: 'Dossier Certifié PatrimoTrust™ | Vérification Propriétaire',
  description: 'Consultez ce dossier de candidature certifié par PatrimoTrust™. Identité vérifiée, solvabilité auditée, conformité Loi Alur.',
};

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <VerifyLandingClient token={token} />;
}
