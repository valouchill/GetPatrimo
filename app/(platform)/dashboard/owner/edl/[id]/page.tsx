import EdlWizardClient from './EdlWizardClient';

export const metadata = { title: 'État des lieux | PatrimoTrust' };

export default async function EdlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EdlWizardClient inspectionId={id} />;
}
