import { describe, expect, it } from 'vitest'

import { jobCompletionRelatedRecordLink } from '@/lib/automations/jobCompletionLinks'

describe('Job Completion Message related-record links', () => {
  it('uses the canonical Jobs route and selects the completed Job safely', () => {
    expect(
      jobCompletionRelatedRecordLink('acme-services', 'job/with spaces'),
    ).toBe(
      '/dashboard/acme-services/service-requests?jobId=job%2Fwith%20spaces',
    )
  })
})
