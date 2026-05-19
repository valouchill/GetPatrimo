import AccessCodeClient from './AccessCodeClient';

export const metadata = {
  title: 'Accéder à ma candidature · PatrimoTrust',
  description:
    'Saisissez le code reçu de votre propriétaire pour déposer votre dossier locataire en toute sécurité.',
};

export default function Page() {
  return <AccessCodeClient />;
}
