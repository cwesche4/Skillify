import { describe, expect, it } from 'vitest'

import {
  resolveCrmReadiness,
  resolveSchedulingReadiness,
  resolveWorkspaceReadiness,
} from '@/lib/readiness/workspaceReadiness'

describe('workspace readiness', () => {
  it('composes module readiness without requiring external calendars', () => {
    const readiness = resolveWorkspaceReadiness({
      workspaceId: 'workspace-1',
      workspaceSlug: 'acme',
      businessInformationComplete: true,
      validWorkingHoursExist: true,
      notificationChannelsConfigured: true,
      manualLeadCreationAvailable: true,
      automatedLeadSourceConfigured: false,
      workflowBuilderAvailable: true,
      calendarConnections: [],
    })

    expect(readiness.status).toBe('readyWithWarnings')
    expect(readiness.issues.map((issue) => issue.code)).toContain(
      'noExternalCalendarConnected',
    )
    expect(
      readiness.issues.find(
        (issue) => issue.code === 'noExternalCalendarConnected',
      )?.blocking,
    ).toBe(false)
  })

  it('blocks Scheduling readiness when authoritative Working Hours are missing', () => {
    const readiness = resolveSchedulingReadiness({
      workspaceId: 'workspace-1',
      workspaceSlug: 'acme',
      validWorkingHoursExist: false,
      calendarConnections: [],
    })

    expect(readiness.status).toBe('blocked')
    expect(readiness.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missingWorkingHours',
          destination: '/dashboard/acme?setup=1&setupStep=workingHours',
        }),
      ]),
    )
  })

  it('keeps CRM manual lead creation ready without automated intake', () => {
    const readiness = resolveCrmReadiness({
      workspaceId: 'workspace-1',
      workspaceSlug: 'acme',
      manualLeadCreationAvailable: true,
      automatedLeadSourceConfigured: false,
      memberCount: 2,
    })

    expect(readiness.status).toBe('readyWithWarnings')
    expect(readiness.completedRequirements).toContain('Manual Lead creation')
    expect(readiness.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'noAutomatedLeadSource',
          blocking: false,
        }),
      ]),
    )
  })

  it('tracks skipped setup separately from readiness completion', () => {
    const readiness = resolveWorkspaceReadiness({
      workspaceId: 'workspace-1',
      workspaceSlug: 'acme',
      setupProgress: { calendars: 'skipped' },
      businessInformationComplete: true,
      validWorkingHoursExist: true,
      notificationChannelsConfigured: true,
      automatedLeadSourceConfigured: true,
    })

    expect(readiness.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'setupSkipped:calendars',
          severity: 'info',
          blocking: false,
        }),
      ]),
    )
  })
})
