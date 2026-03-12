import ContractStudioClient from "./ContractStudioClient";

type ContractStudioPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContractStudioPage({
  params,
}: ContractStudioPageProps) {
  const { id } = await params;
  return <ContractStudioClient propertyId={id} />;
}
