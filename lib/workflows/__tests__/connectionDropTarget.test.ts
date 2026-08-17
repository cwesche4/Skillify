import { describe, expect, it } from 'vitest'
import type { Edge, Node } from 'reactflow'

import { resolveNodeBodyConnection } from '@/lib/workflows/connectionDropTarget'

function node(id: string, registryId: string): Node {
  return {
    id,
    type: registryId,
    position: { x: 0, y: 0 },
    data: {
      label: registryId,
      __registryNodeId: registryId,
    },
  }
}

function edge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: 'default',
  }
}

describe('node body connection drop resolution', () => {
  it('resolves a compatible body drop to the target node default handle', () => {
    const result = resolveNodeBodyConnection({
      nodes: [node('trigger', 'lead.created'), node('email', 'send.email')],
      edges: [],
      sourceId: 'trigger',
      targetId: 'email',
      sourceHandle: 'out',
    })

    expect(result).toEqual({
      valid: true,
      connection: {
        source: 'trigger',
        target: 'email',
        sourceHandle: 'out',
        targetHandle: null,
      },
    })
  })

  it('blocks incompatible body drops', () => {
    const result = resolveNodeBodyConnection({
      nodes: [node('email', 'send.email'), node('trigger', 'lead.created')],
      edges: [],
      sourceId: 'email',
      targetId: 'trigger',
    })

    expect(result).toMatchObject({
      valid: false,
      reason: expect.stringContaining('Trigger'),
    })
  })

  it('blocks duplicate edges and cycles', () => {
    const nodes = [
      node('trigger', 'lead.created'),
      node('sms', 'send.sms'),
      node('email', 'send.email'),
    ]

    expect(
      resolveNodeBodyConnection({
        nodes,
        edges: [edge('trigger', 'sms')],
        sourceId: 'trigger',
        targetId: 'sms',
      }),
    ).toMatchObject({ valid: false })

    expect(
      resolveNodeBodyConnection({
        nodes,
        edges: [edge('trigger', 'sms'), edge('sms', 'email')],
        sourceId: 'email',
        targetId: 'trigger',
      }),
    ).toMatchObject({
      valid: false,
      reason: 'This connection would create a loop.',
    })
  })

  it('preserves explicit handle-to-handle target handles', () => {
    const result = resolveNodeBodyConnection({
      nodes: [
        node('trigger', 'lead.created'),
        node('condition', 'condition.branch'),
      ],
      edges: [],
      sourceId: 'trigger',
      targetId: 'condition',
      sourceHandle: 'trigger-out',
      explicitTargetHandle: 'condition-in',
    })

    expect(result).toEqual({
      valid: true,
      connection: {
        source: 'trigger',
        target: 'condition',
        sourceHandle: 'trigger-out',
        targetHandle: 'condition-in',
      },
    })
  })

  it('preserves branch source handles for connection-drop Add Step flows', () => {
    const result = resolveNodeBodyConnection({
      nodes: [
        node('condition', 'condition.branch'),
        node('email', 'send.email'),
      ],
      edges: [],
      sourceId: 'condition',
      targetId: 'email',
      sourceHandle: 'fallback',
    })

    expect(result).toEqual({
      valid: true,
      connection: {
        source: 'condition',
        target: 'email',
        sourceHandle: 'fallback',
        targetHandle: null,
      },
    })
  })

  it('does not guess when multiple target handles are possible', () => {
    const result = resolveNodeBodyConnection({
      nodes: [
        node('trigger', 'lead.created'),
        node('condition', 'condition.branch'),
      ],
      edges: [],
      sourceId: 'trigger',
      targetId: 'condition',
      compatibleTargetHandles: ['a', 'b'],
    })

    expect(result).toEqual({
      valid: false,
      reason: 'Choose the specific input handle for this step.',
    })
  })
})
