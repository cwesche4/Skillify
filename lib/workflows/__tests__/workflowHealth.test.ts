import { describe, expect, it } from 'vitest'
import type { Edge, Node } from 'reactflow'

import { analyzeWorkflowHealth } from '@/lib/workflows/workflowHealth'
import { validateWorkflowConnection } from '@/lib/workflows/connectionRules'
import { validateWorkflowNodeConfig } from '@/lib/workflows/nodeValidation'

function node(
  id: string,
  registryId: string,
  data: Record<string, unknown> = {},
): Node {
  return {
    id,
    type: registryId,
    position: { x: 0, y: 0 },
    data: {
      label: data.label ?? registryId,
      __registryNodeId: registryId,
      ...data,
    },
  } as Node
}

function edge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: 'default',
  }
}

describe('workflow health analyzer', () => {
  it('detects a missing trigger and blocks publish readiness', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('email', 'send.email', {
          recipient: 'owner@example.com',
          subject: 'Follow-up',
          body: 'Hi',
        }),
      ],
      edges: [],
    })

    expect(health.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing-trigger' }),
      ]),
    )
    expect(health.publishReadiness.ready).toBe(false)
    expect(health.score.value).toBeLessThan(100)
  })

  it('warns on multiple triggers without treating the warning as a publish blocker', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('lead-a', 'lead.created'),
        node('lead-b', 'lead.created'),
        node('task', 'task.create', { title: 'Follow up', priority: 'Medium' }),
      ],
      edges: [edge('lead-a', 'task'), edge('lead-b', 'task')],
    })

    expect(health.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'multiple-triggers' }),
      ]),
    )
    expect(
      health.publishReadiness.blockers.map((item) => item.code),
    ).not.toContain('multiple-triggers')
  })

  it('detects orphan and unreachable nodes', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('lead', 'lead.created'),
        node('email', 'send.email', {
          recipient: '{{nodes.lead.lead.email}}',
          subject: 'Follow-up',
          body: 'Hi',
        }),
        node('task', 'task.create', { title: 'Unconnected task' }),
      ],
      edges: [edge('lead', 'email')],
    })

    expect(health.graph.orphanNodeIds).toContain('task')
    expect(health.graph.unreachableNodeIds).toContain('task')
    expect(health.blockedNodes.map((item) => item.nodeId)).toContain('task')
  })

  it('detects dead branches and empty branch paths', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('lead', 'lead.created'),
        node('condition', 'condition.branch', {
          condition: 'lead.value > 1000',
        }),
      ],
      edges: [edge('lead', 'condition')],
    })

    expect(health.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'empty-branch' }),
      ]),
    )
  })

  it('detects cycles', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('lead', 'lead.created'),
        node('sms', 'send.sms', {
          phone: '{{nodes.lead.lead.phone}}',
          message: 'Hi',
        }),
        node('task', 'task.create', { title: 'Follow up' }),
      ],
      edges: [edge('lead', 'sms'), edge('sms', 'task'), edge('task', 'sms')],
    })

    expect(health.graph.hasCycle).toBe(true)
    expect(health.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'cycle' })]),
    )
  })

  it('groups broken variables and invalid mappings under the affected node', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('lead', 'lead.created'),
        node('email', 'send.email', {
          recipient: '{{nodes.lead.lead.phone}}',
          subject: 'Follow-up',
          body: 'Hi {{nodes.deleted.lead.name}}',
        }),
      ],
      edges: [edge('lead', 'email')],
    })

    expect(health.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-mapping', nodeId: 'email' }),
        expect.objectContaining({ code: 'broken-variable', nodeId: 'email' }),
      ]),
    )
    expect(health.blockedNodes.map((item) => item.nodeId)).toContain('email')
  })

  it('detects missing required fields as blocking setup issues', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('lead', 'lead.created'),
        node('webhook', 'webhook.placeholder', { method: 'POST' }),
      ],
      edges: [edge('lead', 'webhook')],
    })

    expect(health.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-required-field',
          nodeId: 'webhook',
        }),
      ]),
    )
    expect(health.publishReadiness.ready).toBe(false)
  })

  it('uses field-specific business wording for required setup issues', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('lead', 'lead.created'),
        node('sms', 'send.sms', { phone: '', message: 'Hi' }),
        node('email', 'send.email', {
          recipient: 'owner@example.com',
          subject: 'Follow-up',
          body: '',
        }),
        node('task', 'task.create', { title: '', priority: 'Medium' }),
        node('condition', 'condition.branch', { condition: '' }),
      ],
      edges: [
        edge('lead', 'sms'),
        edge('sms', 'email'),
        edge('email', 'task'),
        edge('task', 'condition'),
      ],
    })

    const descriptions = [...health.errors, ...health.warnings].map(
      (issue) => issue.description,
    )

    expect(descriptions).toEqual(
      expect.arrayContaining([
        'Send SMS: Recipient Phone is empty.',
        'Send Email: Body is empty.',
        'Create Task: Title is empty.',
        'Condition / Branch: Choose a field, condition, and value for this branch.',
      ]),
    )
    expect(descriptions).not.toContain(
      'Choose data from a previous step, workspace data, or enter a custom value.',
    )
  })

  it('creates best-practice suggestions and unused variable suggestions without blocking publish', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('lead', 'lead.created'),
        node('sms', 'send.sms', {
          phone: '{{nodes.lead.lead.phone}}',
          message: 'Thanks for contacting us.',
        }),
        node('email', 'send.email', {
          recipient: '{{nodes.lead.lead.email}}',
          subject: 'Follow-up',
          body: 'Plain text body',
        }),
      ],
      edges: [edge('lead', 'sms'), edge('sms', 'email')],
    })

    expect(health.suggestions.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        'Consider a short delay',
        'Add personalization',
        'Unused workflow data',
      ]),
    )
    expect(
      health.publishReadiness.blockers.map((item) => item.severity),
    ).not.toContain('suggestion')
  })

  it('detects optimizations such as repeated identical setup', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('lead', 'lead.created'),
        node('task-a', 'task.create', {
          title: 'Follow up',
          priority: 'Medium',
        }),
        node('task-b', 'task.create', {
          title: 'Follow up',
          priority: 'Medium',
        }),
      ],
      edges: [edge('lead', 'task-a'), edge('task-a', 'task-b')],
    })

    expect(health.optimizations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate-node-kind' }),
      ]),
    )
  })

  it('reports a ready workflow with publish and execution readiness', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('lead', 'lead.created'),
        node('task', 'task.create', {
          title: 'Follow up with {{nodes.lead.lead.fullName}}',
          priority: 'Medium',
        }),
      ],
      edges: [edge('lead', 'task')],
    })

    expect(health.errors).toEqual([])
    expect(health.publishReadiness.ready).toBe(true)
    expect(health.executionReadiness.ready).toBe(true)
    expect(health.readyNodes.map((item) => item.nodeId)).toEqual([
      'lead',
      'task',
    ])
    expect(health.score.value).toBeGreaterThanOrEqual(80)
    expect(health.executionReadiness.longestPath).toBe(2)
  })

  it('treats required mixed-text fields as populated when they include literal text and variables', () => {
    expect(
      validateWorkflowNodeConfig('task.create', {
        title: 'Follow up with {{client.name}}',
        priority: 'Medium',
      }).messages,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'title', severity: 'error' }),
      ]),
    )

    expect(
      validateWorkflowNodeConfig('send.email', {
        recipient: 'owner@example.com',
        subject: 'Follow-up for {{client.name}}',
        body: 'Hi {{client.name}}',
      }).messages,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'subject', severity: 'error' }),
      ]),
    )
  })

  it('does not warn that Wait / Delay has unused branch paths without branch metadata', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('lead', 'lead.created'),
        node('delay', 'wait.delay', { duration: 36, unit: 'seconds' }),
        node('task', 'task.create', { title: 'Follow up', priority: 'Medium' }),
      ],
      edges: [edge('lead', 'delay'), edge('delay', 'task')],
    })

    expect(health.warnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'empty-branch', nodeId: 'delay' }),
      ]),
    )
  })

  it('allows terminal actions to end a workflow without requiring another step', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('lead', 'lead.created'),
        node('email', 'send.email', {
          recipient: 'owner@example.com',
          subject: 'Follow-up',
          body: 'Hi',
        }),
      ],
      edges: [edge('lead', 'email')],
    })

    expect(health.publishReadiness.ready).toBe(true)
    expect(health.errors.map((item) => item.code)).not.toContain(
      'missing-end-path',
    )
  })

  it('allows configured multi-output branch nodes to connect to multiple next steps', () => {
    const splitter = node('splitter', 'ai.splitter')
    const email = node('email', 'send.email', {
      recipient: 'owner@example.com',
      subject: 'Follow-up',
      body: 'Hi',
    })
    const task = node('task', 'task.create', {
      title: 'Follow up',
      priority: 'Medium',
    })
    const existing = [
      { ...edge('splitter', 'email'), sourceHandle: 'fields.email' },
    ]

    expect(
      validateWorkflowConnection({
        source: splitter,
        target: task,
        edges: existing,
        sourceHandle: 'fields.phone',
      }).valid,
    ).toBe(true)
  })

  it('allows a trigger to connect to multiple unconnected actions when trigger metadata permits it', () => {
    const trigger = node('lead', 'lead.created')
    const email = node('email', 'send.email', {
      recipient: 'owner@example.com',
      subject: 'Follow-up',
      body: 'Hi',
    })
    const sms = node('sms', 'send.sms', {
      phone: '+1 555 555 0100',
      message: 'Hi',
    })

    expect(
      validateWorkflowConnection({
        source: trigger,
        target: sms,
        edges: [edge('lead', 'email')],
      }),
    ).toMatchObject({ valid: true })
  })

  it('keeps trigger/action restrictions, duplicate protection, single-input limits, and cycle protection', () => {
    const trigger = node('lead', 'lead.created')
    const secondTrigger = node('task-trigger', 'task.created')
    const sms = node('sms', 'send.sms', {
      phone: '+1 555 555 0100',
      message: 'Hi',
    })
    const email = node('email', 'send.email', {
      recipient: 'owner@example.com',
      subject: 'Follow-up',
      body: 'Hi',
    })

    expect(
      validateWorkflowConnection({ source: trigger, target: secondTrigger }),
    ).toMatchObject({ valid: false })
    expect(
      validateWorkflowConnection({ source: sms, target: trigger }),
    ).toMatchObject({ valid: false })
    expect(
      validateWorkflowConnection({
        source: trigger,
        target: sms,
        edges: [edge('lead', 'sms')],
      }),
    ).toMatchObject({ valid: false })
    expect(
      validateWorkflowConnection({
        source: email,
        target: sms,
        edges: [edge('lead', 'sms')],
      }),
    ).toMatchObject({ valid: false })
    expect(
      validateWorkflowConnection({
        source: sms,
        target: email,
        edges: [edge('email', 'sms')],
      }),
    ).toMatchObject({ valid: false })
  })

  it('keeps standard single-output action nodes from creating a second outgoing connection', () => {
    const sms = node('sms', 'send.sms', {
      phone: '+1 555 555 0100',
      message: 'Hi',
    })
    const email = node('email', 'send.email', {
      recipient: 'owner@example.com',
      subject: 'Follow-up',
      body: 'Hi',
    })
    const task = node('task', 'task.create', {
      title: 'Follow up',
      priority: 'Medium',
    })

    expect(
      validateWorkflowConnection({
        source: sms,
        target: task,
        edges: [edge('sms', 'email')],
      }),
    ).toMatchObject({ valid: false })
  })

  it('deduplicates duplicate splitter issues by stable identity', () => {
    const health = analyzeWorkflowHealth({
      nodes: [
        node('lead', 'lead.created'),
        node('splitter', 'ai.splitter'),
        node('task', 'task.create', { title: 'Follow up', priority: 'Medium' }),
      ],
      edges: [
        edge('lead', 'splitter'),
        edge('splitter', 'task'),
        { ...edge('splitter', 'task'), id: 'splitter-task-duplicate' },
      ],
    })

    const duplicateIssues = health.warnings.filter(
      (item) => item.code === 'duplicate-connection',
    )
    expect(new Set(duplicateIssues.map((item) => item.id)).size).toBe(
      duplicateIssues.length,
    )
  })
})
