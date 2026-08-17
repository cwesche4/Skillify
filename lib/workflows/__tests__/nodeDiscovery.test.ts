import { describe, expect, it } from 'vitest'

import {
  discoverWorkflowNodes,
  groupWorkflowNodeResults,
  validateWorkflowNodeDiscoveryMetadata,
} from '@/lib/workflows/nodeDiscovery'
import {
  getWorkflowNodeDefinition,
  searchWorkflowNodes,
  validateWorkflowNodeRegistryDiscovery,
  workflowNodeRegistry,
} from '@/lib/workflows/nodeRegistry'
import {
  recordWorkflowNodeRecentUse,
  toggleWorkflowNodeFavorite,
  type WorkflowNodeDiscoveryPreferences,
} from '@/lib/workflows/nodeDiscoveryPreferences'

describe('workflow node discovery metadata', () => {
  it('requires every visible registry node to have valid discovery metadata', () => {
    expect(validateWorkflowNodeRegistryDiscovery()).toEqual([])
  })

  it('classifies Scheduling triggers, actions, conditions, communication, and provider nodes', () => {
    expect(
      getWorkflowNodeDefinition('scheduling.trigger.event_created')?.discovery,
    ).toMatchObject({
      type: 'trigger',
      domain: 'scheduling',
      group: 'Event Triggers',
    })
    expect(
      getWorkflowNodeDefinition('scheduling.action.create_event')?.discovery,
    ).toMatchObject({
      type: 'action',
      domain: 'scheduling',
      group: 'Event Actions',
    })
    expect(
      getWorkflowNodeDefinition('scheduling.condition.member_available')
        ?.discovery,
    ).toMatchObject({
      type: 'condition',
      domain: 'scheduling',
      group: 'Availability',
    })
    expect(
      getWorkflowNodeDefinition('scheduling.action.send_reminder')?.discovery,
    ).toMatchObject({
      type: 'communication',
      domain: 'scheduling',
      group: 'Notifications & Reminders',
    })
    expect(
      getWorkflowNodeDefinition('scheduling.action.sync_calendar')?.discovery,
    ).toMatchObject({
      type: 'integration',
      domain: 'scheduling',
      group: 'Calendar Providers',
    })
  })

  it('marks unsupported and authentication-gated Scheduling nodes clearly', () => {
    expect(
      getWorkflowNodeDefinition('scheduling.action.assign_team')?.availability,
    ).toMatchObject({
      state: 'comingSoon',
      selectable: false,
    })
    expect(
      getWorkflowNodeDefinition('scheduling.action.connect_calendar')
        ?.availability,
    ).toMatchObject({
      state: 'requiresAuthentication',
      selectable: true,
    })
  })

  it('rejects missing metadata, duplicates, and secret-like search metadata', () => {
    const node = workflowNodeRegistry[0]!
    expect(
      validateWorkflowNodeDiscoveryMetadata([
        { ...node, discovery: undefined },
        node,
        {
          ...node,
          id: `${node.id}.secret-test`,
          discovery: {
            type: 'action',
            domain: 'general',
            group: 'Test',
            aliases: ['api token hidden'],
          },
        },
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing a valid discovery type'),
        expect.stringContaining('Duplicate workflow node ID'),
        expect.stringContaining('restricted secret-like term'),
      ]),
    )
  })
})

describe('workflow node discovery filters and groups', () => {
  it('returns all nodes for all types and domains', () => {
    expect(
      discoverWorkflowNodes(workflowNodeRegistry, {
        type: 'all',
        domain: 'all',
      }).length,
    ).toBeGreaterThan(30)
  })

  it('filters by primary type', () => {
    expect(
      discoverWorkflowNodes(workflowNodeRegistry, {
        type: 'trigger',
        domain: 'all',
      }).every((result) => result.node.discovery?.type === 'trigger'),
    ).toBe(true)
    expect(
      discoverWorkflowNodes(workflowNodeRegistry, {
        type: 'action',
        domain: 'all',
      }).every((result) => result.node.discovery?.type === 'action'),
    ).toBe(true)
    expect(
      discoverWorkflowNodes(workflowNodeRegistry, {
        type: 'condition',
        domain: 'all',
      }).every((result) => result.node.discovery?.type === 'condition'),
    ).toBe(true)
  })

  it('filters by domain and composes type plus domain', () => {
    const scheduling = discoverWorkflowNodes(workflowNodeRegistry, {
      type: 'all',
      domain: 'scheduling',
    })
    expect(scheduling.length).toBeGreaterThan(40)
    expect(
      scheduling.every(
        (result) => result.node.discovery?.domain === 'scheduling',
      ),
    ).toBe(true)

    const schedulingConditions = discoverWorkflowNodes(workflowNodeRegistry, {
      type: 'condition',
      domain: 'scheduling',
    })
    expect(schedulingConditions.map((result) => result.node.id)).toEqual(
      expect.arrayContaining([
        'scheduling.condition.member_available',
        'scheduling.condition.has_scheduling_conflict',
      ]),
    )
    expect(
      schedulingConditions.every(
        (result) => result.node.discovery?.type === 'condition',
      ),
    ).toBe(true)

    const crmTriggers = discoverWorkflowNodes(workflowNodeRegistry, {
      type: 'trigger',
      domain: 'crm',
      query: 'created',
    }).map((result) => result.node.id)
    expect(crmTriggers).toContain('lead.created')
    expect(crmTriggers).not.toContain('scheduling.trigger.event_created')
  })

  it('groups all Scheduling results by primary type with concept subgroups', () => {
    const groups = groupWorkflowNodeResults(
      discoverWorkflowNodes(workflowNodeRegistry, {
        type: 'all',
        domain: 'scheduling',
      }),
      { type: 'all', domain: 'scheduling' },
    )
    expect(groups.map((group) => group.group)).toEqual(
      expect.arrayContaining([
        'Triggers',
        'Actions',
        'Conditions',
        'Communication',
        'Integrations',
      ]),
    )
    const triggers = groups.find((group) => group.group === 'Triggers')
    expect(triggers?.subgroups.map((group) => group.label)).toEqual(
      expect.arrayContaining([
        'Events',
        'Availability',
        'Providers',
        'Conflicts',
        'Notifications',
        'Recurrence',
        'Workers',
      ]),
    )
    expect(groups.length).toBeLessThan(8)
    expect(groups.every((group) => group.items.length > 0)).toBe(true)
  })

  it('groups specific Scheduling types by concise concepts', () => {
    const groups = groupWorkflowNodeResults(
      discoverWorkflowNodes(workflowNodeRegistry, {
        type: 'trigger',
        domain: 'scheduling',
      }),
      { type: 'trigger', domain: 'scheduling' },
    )
    expect(groups.map((group) => group.group)).toEqual(
      expect.arrayContaining(['Events', 'Availability', 'Providers']),
    )
    expect(groups.map((group) => group.group)).not.toContain('Event Triggers')
    expect(groups.every((group) => group.items.length > 0)).toBe(true)
  })
})

describe('workflow node deterministic search', () => {
  it('ranks exact title matches above boosted favorite and recent matches', () => {
    const results = discoverWorkflowNodes(workflowNodeRegistry, {
      query: 'Create Event',
      favoriteIds: ['scheduling.action.send_reminder'],
      recentIds: ['scheduling.action.sync_calendar'],
      includeUnavailable: true,
    })
    expect(results[0]?.node.id).toBe('scheduling.action.create_event')
  })

  it('matches aliases, tags, descriptions, and provider terms deterministically', () => {
    expect(searchWorkflowNodes('assign').map((node) => node.id)).toContain(
      'scheduling.action.assign_member',
    )
    expect(searchWorkflowNodes('technician').map((node) => node.id)).toContain(
      'scheduling.action.assign_member',
    )
    expect(searchWorkflowNodes('pto').map((node) => node.id)).toContain(
      'scheduling.action.create_time_off',
    )
    expect(
      searchWorkflowNodes('personal calendar').map((node) => node.id),
    ).toEqual(
      expect.arrayContaining([
        'scheduling.condition.has_external_availability_conflict',
        'scheduling.condition.personal_calendar_approved',
      ]),
    )
    expect(searchWorkflowNodes('google').map((node) => node.id)).toContain(
      'scheduling.action.sync_calendar',
    )
    expect(searchWorkflowNodes('recurring').map((node) => node.id)).toContain(
      'scheduling.action.pause_series',
    )
  })

  it('keeps stable alphabetical ties', () => {
    const labels = discoverWorkflowNodes(workflowNodeRegistry, {
      type: 'communication',
      domain: 'all',
      query: 'message',
    }).map((result) => result.node.label)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
  })

  it('does not call AI or network services for search', () => {
    const beforeFetch = globalThis.fetch
    searchWorkflowNodes('calendar sync')
    expect(globalThis.fetch).toBe(beforeFetch)
  })
})

describe('workflow node recent and favorite preferences', () => {
  const empty: WorkflowNodeDiscoveryPreferences = { favorites: [], recent: [] }

  it('toggles favorites without changing recents', () => {
    const favorited = toggleWorkflowNodeFavorite(empty, 'send.email')
    expect(favorited.favorites).toEqual(['send.email'])
    expect(favorited.recent).toEqual([])
    expect(
      toggleWorkflowNodeFavorite(favorited, 'send.email').favorites,
    ).toEqual([])
  })

  it('records recents, moves reused nodes to the top, and limits the list', () => {
    let preferences = empty
    for (let index = 0; index < 22; index += 1) {
      preferences = recordWorkflowNodeRecentUse(
        preferences,
        `node-${index}`,
        new Date(2026, 0, index + 1),
      )
    }
    preferences = recordWorkflowNodeRecentUse(
      preferences,
      'node-10',
      new Date(2026, 1, 1),
    )
    expect(preferences.recent).toHaveLength(20)
    expect(preferences.recent[0]).toMatchObject({
      nodeId: 'node-10',
      useCount: 2,
    })
  })

  it('ignores stale favorite and recent IDs during discovery', () => {
    const results = discoverWorkflowNodes(workflowNodeRegistry, {
      favoriteIds: ['missing-node'],
      recentIds: ['missing-node'],
      query: 'missing-node',
    })
    expect(results).toEqual([])
  })
})
