import { describe, expect, it } from 'vitest'
import type { Edge, Node } from 'reactflow'

import {
  canCreateTriggerRepairEdge,
  hasPathBetweenNodes,
  resolveMissingTriggerRepairTarget,
  type MissingTriggerRepairContext,
} from '@/lib/workflows/triggerRepair'

function node(id: string, registryNodeId: string): Node {
  return {
    id,
    type: registryNodeId,
    position: { x: 0, y: 0 },
    data: {
      label: registryNodeId,
      __registryNodeId: registryNodeId,
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

describe('missing trigger repair targeting', () => {
  it('stores the affected target node in repair context shape', () => {
    const context: MissingTriggerRepairContext = {
      type: 'missing-trigger',
      targetNodeId: 'send-email',
      insertion: 'before',
      preferredNodeIds: ['lead.created'],
    }

    expect(context).toMatchObject({
      type: 'missing-trigger',
      targetNodeId: 'send-email',
      insertion: 'before',
    })
  })

  it('targets the affected node when it has no incoming path', () => {
    const result = resolveMissingTriggerRepairTarget({
      nodes: [node('send-email', 'send.email')],
      edges: [],
      targetNodeId: 'send-email',
    })

    expect(result).toEqual({
      status: 'insert',
      targetNodeId: 'send-email',
    })
  })

  it('connects before the earliest unambiguous root for a Send SMS to Send Email chain', () => {
    const nodes = [
      node('send-sms', 'send.sms'),
      node('send-email', 'send.email'),
    ]
    const edges = [edge('send-sms', 'send-email')]

    const result = resolveMissingTriggerRepairTarget({
      nodes,
      edges,
      targetNodeId: 'send-email',
    })

    expect(result).toEqual({
      status: 'insert',
      targetNodeId: 'send-sms',
    })
  })

  it('does not add another trigger when the path already has one', () => {
    const nodes = [
      node('lead-created', 'lead.created'),
      node('send-sms', 'send.sms'),
      node('send-email', 'send.email'),
    ]
    const edges = [
      edge('lead-created', 'send-sms'),
      edge('send-sms', 'send-email'),
    ]

    const result = resolveMissingTriggerRepairTarget({
      nodes,
      edges,
      targetNodeId: 'send-email',
    })

    expect(result.status).toBe('already-triggered')
  })

  it('falls back to the affected node when the earliest root is ambiguous', () => {
    const nodes = [
      node('send-sms', 'send.sms'),
      node('create-task', 'task.create'),
      node('send-email', 'send.email'),
    ]
    const edges = [
      edge('send-sms', 'send-email'),
      edge('create-task', 'send-email'),
    ]

    const result = resolveMissingTriggerRepairTarget({
      nodes,
      edges,
      targetNodeId: 'send-email',
    })

    expect(result).toEqual({
      status: 'ambiguous-root',
      targetNodeId: 'send-email',
    })
  })

  it('guards duplicate repair edges and cycles', () => {
    const nodes = [
      node('lead-created', 'lead.created'),
      node('send-email', 'send.email'),
    ]
    const edges = [edge('lead-created', 'send-email')]

    expect(
      canCreateTriggerRepairEdge({
        nodes,
        edges,
        sourceNodeId: 'lead-created',
        targetNodeId: 'send-email',
      }),
    ).toMatchObject({ valid: false })

    expect(
      hasPathBetweenNodes({
        edges: [edge('send-email', 'lead-created')],
        sourceId: 'send-email',
        targetId: 'lead-created',
      }),
    ).toBe(true)
  })

  it('allows a new trigger to connect to a non-trigger target', () => {
    const nodes = [
      node('lead-created', 'lead.created'),
      node('send-email', 'send.email'),
    ]

    expect(
      canCreateTriggerRepairEdge({
        nodes,
        edges: [],
        sourceNodeId: 'lead-created',
        targetNodeId: 'send-email',
      }),
    ).toEqual({ valid: true })
  })
})
