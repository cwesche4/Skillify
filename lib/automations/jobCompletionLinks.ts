export function jobCompletionRelatedRecordLink(
  workspaceSlug: string,
  jobId: string,
) {
  return `/dashboard/${workspaceSlug}/service-requests?jobId=${encodeURIComponent(jobId)}`
}
