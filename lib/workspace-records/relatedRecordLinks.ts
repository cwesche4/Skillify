export type RelatedRecordRouteType =
  | 'client'
  | 'lead'
  | 'opportunity'
  | 'sale'
  | 'serviceRequest'
  | 'task'
  | 'project'

type RelatedRecordHrefOptions = {
  workspaceSlug: string
  type: RelatedRecordRouteType
  id: string
  clientId?: string | null
  serviceRequestId?: string | null
}

export function buildRelatedRecordHref({
  workspaceSlug,
  type,
  id,
  clientId,
  serviceRequestId,
}: RelatedRecordHrefOptions) {
  const encodedId = encodeURIComponent(id)
  const encodedClientId = clientId ? encodeURIComponent(clientId) : null
  const encodedServiceRequestId = serviceRequestId
    ? encodeURIComponent(serviceRequestId)
    : null

  switch (type) {
    case 'client':
      return `/dashboard/${workspaceSlug}/clients?clientId=${encodedId}#clients-workspace`
    case 'lead':
      return `/dashboard/${workspaceSlug}/leads?leadId=${encodedId}#leads-workspace`
    case 'opportunity':
      return `/dashboard/${workspaceSlug}/opportunities?opportunityId=${encodedId}#opportunities-workspace`
    case 'sale':
      return `/dashboard/${workspaceSlug}/sales-pipeline?dealId=${encodedId}`
    case 'serviceRequest':
      return `/dashboard/${workspaceSlug}/service-requests?requestId=${encodedId}#request-queue`
    case 'task': {
      const params = new URLSearchParams({ taskId: id })
      if (encodedClientId) params.set('clientId', clientId ?? '')
      if (encodedServiceRequestId) {
        params.set('serviceRequestId', serviceRequestId ?? '')
      }
      return `/dashboard/${workspaceSlug}/tasks?${params.toString()}#tasks-workspace`
    }
    case 'project':
      return `/dashboard/${workspaceSlug}/tasks?projectId=${encodedId}#tasks-workspace`
  }
}
