import LeaseWizard from "./LeaseWizard";

type ContractStudioPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ContractStudioPage({
  params,
  searchParams,
}: ContractStudioPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const returnUrl = typeof sp.returnUrl === "string" ? sp.returnUrl : undefined;
  return <LeaseWizard propertyId={id} returnUrl={returnUrl} />;
}
