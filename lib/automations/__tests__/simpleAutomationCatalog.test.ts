import { describe, expect, it } from 'vitest'

import {
  SIMPLE_AUTOMATION_CATALOG,
  getSimpleAutomationsForWorkspace,
} from '@/lib/automations/simpleAutomationCatalog'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'

describe('Simple Automation catalog', () => {
  it('uses the six stable recipe keys', () => {
    expect(SIMPLE_AUTOMATION_CATALOG.map((recipe) => recipe.key)).toEqual([
      'new-lead-alert',
      'lead-follow-up',
      'estimate-follow-up',
      'appointment-reminder',
      'schedule-change-notification',
      'job-completion-message',
    ])
  })

  it('shows all initial recipes to Simple Service workspaces', () => {
    expect(
      getSimpleAutomationsForWorkspace(
        WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      ),
    ).toHaveLength(6)
  })

  it('exposes only recipes backed by their durable foundations', () => {
    const byKey = new Map(
      SIMPLE_AUTOMATION_CATALOG.map((recipe) => [recipe.key, recipe]),
    )

    expect(byKey.get('estimate-follow-up')).toMatchObject({
      definitionVersion: 1,
      availability: { state: 'available' },
      supportedWorkspaceModels: [
        WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      ],
    })
    expect(byKey.get('job-completion-message')).toMatchObject({
      definitionVersion: 2,
      description: 'Let your team know when a Job has been completed.',
      availability: { state: 'available' },
    })
    expect(byKey.get('appointment-reminder')).toMatchObject({
      definitionVersion: 2,
      description: 'Remind your team before a scheduled appointment or visit.',
      availability: { state: 'available' },
    })
    expect(byKey.get('schedule-change-notification')).toMatchObject({
      definitionVersion: 2,
      description: 'Let your team know when an appointment schedule changes.',
      availability: { state: 'available' },
    })
  })

  it('exposes an explicit definition version for every recipe', () => {
    expect(
      SIMPLE_AUTOMATION_CATALOG.every(
        (recipe) =>
          Number.isInteger(recipe.definitionVersion) &&
          recipe.definitionVersion > 0,
      ),
    ).toBe(true)
    expect(
      SIMPLE_AUTOMATION_CATALOG.find(
        (recipe) => recipe.key === 'lead-follow-up',
      )?.definitionVersion,
    ).toBe(2)
    expect(
      SIMPLE_AUTOMATION_CATALOG.find(
        (recipe) => recipe.key === 'appointment-reminder',
      )?.definitionVersion,
    ).toBe(2)
    expect(
      SIMPLE_AUTOMATION_CATALOG.find(
        (recipe) => recipe.key === 'schedule-change-notification',
      )?.definitionVersion,
    ).toBe(2)
  })

  it('states the no-backfill boundary for time-sensitive recipes', () => {
    const byKey = new Map(
      SIMPLE_AUTOMATION_CATALOG.map((recipe) => [recipe.key, recipe]),
    )
    expect(byKey.get('lead-follow-up')?.activationNotice).toMatch(
      /not backfilled/i,
    )
    expect(byKey.get('appointment-reminder')?.activationNotice).toMatch(
      /not retroactively reconciled/i,
    )
    expect(byKey.get('schedule-change-notification')?.activationNotice).toMatch(
      /does not replay/i,
    )
  })

  it('does not show service-specific recipes to Product Commerce workspaces', () => {
    expect(
      getSimpleAutomationsForWorkspace(WorkspaceBusinessModel.PRODUCT_COMMERCE),
    ).toEqual([])
  })

  it('limits Direct Sales workspaces to compatible lead recipes', () => {
    expect(
      getSimpleAutomationsForWorkspace(WorkspaceBusinessModel.DIRECT_SALES).map(
        (recipe) => recipe.key,
      ),
    ).toEqual(['new-lead-alert'])
  })
})
