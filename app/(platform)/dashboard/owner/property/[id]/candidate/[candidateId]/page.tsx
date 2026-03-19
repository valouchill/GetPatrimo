import CandidateAuditClient from './CandidateAuditClient';

export default async function CandidateAuditPage({
  params,
}: {
  params: Promise<{ id: string; candidateId: string }>;
}) {
  const { id, candidateId } = await params;
  return <CandidateAuditClient propertyId={id} candidateId={candidateId} />;
}
