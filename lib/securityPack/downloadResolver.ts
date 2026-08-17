import { prisma } from '@/lib/db'

type DownloadResolution = {
  downloadAvailable: boolean
  downloadUrl?: string
}

/**
 * Compute download availability on read; do not store URLs in audit records.
 * - delivery marked event must exist
 * - caller must be requester or workspace admin (enforced upstream)
 * - URL is generated on demand (placeholder here)
 */
export async function resolveDownloadLink(params: {
  requestId: string
  workspaceId: string
}): Promise<DownloadResolution> {
  const delivered = await prisma.securityPackAuditEvent.findFirst({
    where: {
      requestId: params.requestId,
      workspaceId: params.workspaceId,
      eventType: 'DELIVERY_MARKED',
    },
    select: { id: true },
  })

  if (!delivered) return { downloadAvailable: false }

  // Placeholder: generate a short-lived URL or route reference.
  const url = `/api/security-pack/request/${params.requestId}/download`

  return { downloadAvailable: true, downloadUrl: url }
}
