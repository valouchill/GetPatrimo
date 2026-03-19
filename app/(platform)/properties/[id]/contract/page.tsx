import LeaseWizard from "./LeaseWizard";

type ContractStudioPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContractStudioPage({
  params,
}: ContractStudioPageProps) {
  const { id } = await params;
  return <LeaseWizard propertyId={id} />;
}
