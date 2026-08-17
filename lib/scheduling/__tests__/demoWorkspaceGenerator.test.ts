import { describe, expect, it } from 'vitest'

import {
  DEMO_APPOINTMENT_COUNT,
  assertDemoWorkspaceGeneratorAllowed,
  createDemoWorkspacePlan,
  getDemoWorkspaceSummary,
  resolveDemoWorkspaceGenerationConfig,
} from '@/lib/dev/demoWorkspaceGenerator'

const baseOptions = {
  workspaceId: 'workspace-demo-test',
  anchorDate: '2026-07-30',
  timezone: 'America/New_York',
}

function plan() {
  return createDemoWorkspacePlan(baseOptions)
}

describe('development demo workspace generator', () => {
  it('creates deterministic demo data for the same workspace and anchor date', () => {
    expect(plan()).toEqual(plan())
  })

  it('creates the requested demo structure', () => {
    const demo = plan()
    const summary = getDemoWorkspaceSummary(demo)

    expect(summary.teams).toBe(3)
    expect(summary.locations).toBe(3)
    expect(summary.technicians).toBe(10)
    expect(summary.customers).toBeGreaterThanOrEqual(40)
    expect(summary.customers).toBeLessThanOrEqual(60)
    expect(summary.appointments).toBe(DEMO_APPOINTMENT_COUNT)
    expect(summary.availabilityRecords).toBeGreaterThanOrEqual(14)
    expect(summary.recurringMasters).toBeGreaterThanOrEqual(4)
    expect(summary.emergencyCalls).toBeGreaterThanOrEqual(5)
  })

  it('does not generate duplicate stable IDs', () => {
    const demo = plan()
    const ids = [
      ...demo.teams.map((item) => item.id),
      ...demo.locations.map((item) => item.id),
      ...demo.technicians.flatMap((item) => [item.userId, item.memberId]),
      ...demo.customers.map((item) => item.id),
      ...demo.events.map((item) => item.id),
      ...demo.availability.map((item) => item.id),
    ]

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses valid workspace relationships for assignments, teams, locations, and customers', () => {
    const demo = plan()
    const memberIds = new Set(demo.technicians.map((tech) => tech.memberId))
    const teamIds = new Set(demo.teams.map((team) => team.id))
    const locationIds = new Set(demo.locations.map((location) => location.id))
    const customerWorkPrefixes = new Set(
      demo.customers.map((customer) => `${customer.id}-work-`),
    )

    for (const tech of demo.technicians) {
      expect(teamIds.has(tech.teamId)).toBe(true)
      expect(locationIds.has(tech.locationId)).toBe(true)
    }

    for (const event of demo.events) {
      for (const memberId of event.assignedMemberIds) {
        expect(memberIds.has(memberId)).toBe(true)
      }
      expect(
        [...customerWorkPrefixes].some((prefix) =>
          event.linkedRecord.recordId.startsWith(prefix),
        ),
      ).toBe(true)
    }
  })

  it('creates appointments across the previous, current, and next week', () => {
    const dates = plan().events.map((event) => event.date)

    expect(dates.some((date) => date < baseOptions.anchorDate)).toBe(true)
    expect(dates).toContain(baseOptions.anchorDate)
    expect(dates.some((date) => date > baseOptions.anchorDate)).toBe(true)
  })

  it('keeps every generated appointment chronologically valid', () => {
    for (const event of plan().events) {
      const [hour, minute] = event.startTime.split(':').map(Number)
      expect(Number.isFinite(hour)).toBe(true)
      expect(Number.isFinite(minute)).toBe(true)
      expect(event.durationMinutes).toBeGreaterThan(0)
    }
  })

  it('contains the intentional scheduling problem scenarios', () => {
    const summary = getDemoWorkspaceSummary(plan())

    expect(summary.scenarioCounts['overloaded-technician']).toBeGreaterThan(0)
    expect(summary.scenarioCounts['double-booking']).toBeGreaterThan(0)
    expect(summary.scenarioCounts['pto-conflict']).toBeGreaterThan(0)
    expect(summary.scenarioCounts['after-hours-emergency']).toBeGreaterThan(0)
    expect(summary.scenarioCounts['unassigned-work']).toBeGreaterThan(0)
    expect(summary.scenarioCounts['certification-mismatch']).toBeGreaterThan(0)
    expect(summary.scenarioCounts['location-mismatch']).toBeGreaterThan(0)
    expect(summary.scenarioCounts['recurring-collision']).toBeGreaterThan(0)
  })

  it('guards production execution', () => {
    expect(() =>
      assertDemoWorkspaceGeneratorAllowed({ NODE_ENV: 'production' }),
    ).toThrow('disabled in production')
    expect(() =>
      assertDemoWorkspaceGeneratorAllowed({ NODE_ENV: 'development' }),
    ).not.toThrow()
  })

  it('resolves named presets and respects deterministic event-count overrides', () => {
    const config = resolveDemoWorkspaceGenerationConfig({
      preset: 'ai-playground-comprehensive',
      seed: 42,
      scheduling: { eventCount: 60 },
    })
    const demo = createDemoWorkspacePlan({ ...baseOptions, config })
    const summary = getDemoWorkspaceSummary(demo)

    expect(summary.preset).toBe('ai-playground-comprehensive')
    expect(summary.seed).toBe(42)
    expect(summary.appointments).toBe(60)
    expect(summary.scenarioCounts['unassigned-work']).toBeGreaterThan(0)
    expect(summary.scenarioCounts['double-booking']).toBeGreaterThan(0)
  })

  it('normalizes advanced scheduling demo configuration and labels contact counts honestly', () => {
    const config = resolveDemoWorkspaceGenerationConfig({
      preset: 'scheduling-overloaded',
      seed: 7,
      memberCount: 8,
      teamCount: 4,
      locationCount: 5,
      schedulingContactCount: 44,
      recurringSeriesCount: 9,
      emergencyEventCount: 6,
      availabilityRecordCount: 18,
      naturalLanguageDescription: 'Busy dispatch week with recurring work.',
      scheduling: {
        completedPercent: 25,
        canceledPercent: 5,
        dateRangeDistribution: 'balanced',
        workloadDistribution: 'overloaded',
      },
      scenarios: {
        doubleBooking: 2,
        certificationMismatch: 1,
        externalCalendarBusyConflict: 1,
      },
    })
    const summary = getDemoWorkspaceSummary(
      createDemoWorkspacePlan({ ...baseOptions, config }),
    )

    expect(config.seed).toBe(7)
    expect(config.memberCount).toBe(8)
    expect(config.schedulingContactCount).toBe(44)
    expect(config.scheduling.completedPercent).toBe(25)
    expect(summary.schedulingContacts).toBe(summary.customers)
    expect(summary.crmClients).toBe(0)
    expect(summary.unsupportedRequestedModules).toEqual([])
  })

  it('rejects malformed advanced demo numeric configuration', () => {
    expect(() =>
      resolveDemoWorkspaceGenerationConfig({
        seed: 1.5,
      }),
    ).toThrow('Demo seed must be a whole number.')
    expect(() =>
      resolveDemoWorkspaceGenerationConfig({
        memberCount: -1,
      }),
    ).toThrow('Demo memberCount must be a whole number from 0 to 500.')
    expect(() =>
      resolveDemoWorkspaceGenerationConfig({
        scheduling: { completedPercent: 120 },
      }),
    ).toThrow(
      'Demo scheduling.completedPercent must be a percentage from 0 to 100.',
    )
  })

  it('reports unsupported requested modules honestly without creating fake records', () => {
    const config = resolveDemoWorkspaceGenerationConfig({
      preset: 'automation-failure-review',
      unsupportedModules: ['service requests'],
    })
    const summary = getDemoWorkspaceSummary(
      createDemoWorkspacePlan({ ...baseOptions, config }),
    )

    expect(summary.unsupportedRequestedModules).toEqual(
      expect.arrayContaining(['failed automation runs', 'service requests']),
    )
  })
})
