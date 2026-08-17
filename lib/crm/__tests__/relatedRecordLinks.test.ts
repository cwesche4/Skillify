import { describe, expect, it } from 'vitest'

import { buildRelatedRecordHref } from '@/lib/workspace-records/relatedRecordLinks'

describe('related record deep links', () => {
  it('builds contextual module URLs for exact records', () => {
    expect(
      buildRelatedRecordHref({
        workspaceSlug: 'acme',
        type: 'lead',
        id: 'lead-123',
      }),
    ).toBe('/dashboard/acme/leads?leadId=lead-123#leads-workspace')

    expect(
      buildRelatedRecordHref({
        workspaceSlug: 'acme',
        type: 'opportunity',
        id: 'opp-123',
      }),
    ).toBe(
      '/dashboard/acme/opportunities?opportunityId=opp-123#opportunities-workspace',
    )

    expect(
      buildRelatedRecordHref({
        workspaceSlug: 'acme',
        type: 'task',
        id: 'task-123',
        clientId: 'client-123',
        serviceRequestId: 'request-123',
      }),
    ).toBe(
      '/dashboard/acme/tasks?taskId=task-123&clientId=client-123&serviceRequestId=request-123#tasks-workspace',
    )
  })
})
