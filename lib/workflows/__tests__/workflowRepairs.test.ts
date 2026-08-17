import { describe, expect, it } from 'vitest'
import type { Edge, Node } from 'reactflow'

import { analyzeWorkflowHealth } from '@/lib/workflows/workflowHealth'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import {
  applyWorkflowRepair,
  getWorkflowRepairActions,
  type WorkflowRepairContext,
} from '@/lib/workflows/workflowRepairs'

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

function edge(
  source: string,
  target: string,
  id = `${source}-${target}`,
): Edge {
  return {
    id,
    source,
    target,
    type: 'default',
  }
}

function context(nodes: Node[], edges: Edge[]): WorkflowRepairContext {
  return {
    nodes,
    edges,
    health: analyzeWorkflowHealth({ nodes, edges }),
  }
}

function actionsForCode(ctx: WorkflowRepairContext, code: string) {
  const issue = [
    ...ctx.health.errors,
    ...ctx.health.warnings,
    ...ctx.health.suggestions,
  ].find((item) => item.code === code)
  expect(issue, code).toBeTruthy()
  return getWorkflowRepairActions(issue!, ctx)
}

describe('workflow repair engine', () => {
  it('exposes registry repair groups across reusable node families', () => {
    const fieldGroups = (registryId: string) =>
      new Map(
        (getWorkflowNodeDefinition(registryId)?.configFields ?? []).map(
          (field) => [field.key ?? field.id, field.repairGroup],
        ),
      )

    const emailGroups = fieldGroups('send.email')
    expect(emailGroups.get('recipient')).toBe('emailMessage')
    expect(emailGroups.get('subject')).toBe('emailMessage')
    expect(emailGroups.get('body')).toBe('emailMessage')
    const smsGroups = fieldGroups('send.sms')
    expect(smsGroups.get('phone')).toBe('smsMessage')
    expect(smsGroups.get('message')).toBe('smsMessage')
    expect(fieldGroups('task.create').get('title')).toBe('taskDefinition')
    expect(fieldGroups('condition.branch').get('condition')).toBe(
      'conditionBuilder',
    )
    const delayGroups = fieldGroups('wait.delay')
    expect(delayGroups.get('duration')).toBe('delayConfiguration')
    expect(delayGroups.get('unit')).toBe('delayConfiguration')
    expect(fieldGroups('webhook.placeholder').get('url')).toBe('webhookRequest')
    expect(fieldGroups('ai.splitter').get('schemaHint')).toBe('aiSchema')
  })

  it('produces Add Trigger repair for missing trigger issues', () => {
    const ctx = context(
      [
        node('email', 'send.email', {
          recipient: 'owner@example.com',
          subject: 'Follow-up',
          body: 'Hi',
        }),
      ],
      [],
    )

    const actions = actionsForCode(ctx, 'missing-trigger')
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Add Trigger',
          actionType: 'open_add_node',
          requiresConfirmation: false,
          metadata: expect.objectContaining({ category: 'Triggers' }),
        }),
      ]),
    )
    expect(applyWorkflowRepair(actions[0], ctx).effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'open_add_node' }),
      ]),
    )
  })

  it('uses registry field labels for required field repair actions across node families', () => {
    const ctx = context(
      [
        node('lead', 'lead.created'),
        node('sms', 'send.sms', { message: 'Hi' }),
        node('email', 'send.email', {
          recipient: 'owner@example.com',
          subject: 'Follow-up',
        }),
        node('task', 'task.create', { priority: 'Medium' }),
      ],
      [edge('lead', 'sms'), edge('sms', 'email'), edge('email', 'task')],
    )

    const missingFieldActions = ctx.health.errors
      .filter((issue) => issue.code === 'missing-required-field')
      .flatMap((issue) => getWorkflowRepairActions(issue, ctx))

    expect(missingFieldActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Open Recipient Phone',
          actionType: 'focus_field',
        }),
        expect.objectContaining({
          label: 'Open Body',
          actionType: 'focus_field',
        }),
        expect.objectContaining({
          label: 'Open Title',
          actionType: 'focus_field',
        }),
      ]),
    )
  })

  it('produces Replace Workflow Data repair for deleted source variables', () => {
    const ctx = context(
      [
        node('sms', 'send.sms', {
          phone: '{{nodes.deleted.lead.phone}}',
          message: 'Hi',
        }),
      ],
      [],
    )
    const actions = actionsForCode(ctx, 'broken-variable')

    expect(actions[0]).toMatchObject({
      label: 'Replace Workflow Data',
      actionType: 'choose_workflow_data',
      requiresConfirmation: false,
    })
  })

  it('produces guided connection repair without silently mutating ambiguous disconnected nodes', () => {
    const ctx = context(
      [
        node('lead', 'lead.created'),
        node('task', 'task.create', { title: 'Follow up' }),
      ],
      [],
    )
    const actions = actionsForCode(ctx, 'disconnected-node')

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Add Trigger',
          actionType: 'open_add_node',
        }),
        expect.objectContaining({
          label: 'Connect to Workflow',
          actionType: 'connect_nodes',
          canAutoApply: false,
          metadata: expect.objectContaining({ mode: 'target-selection' }),
        }),
      ]),
    )
  })

  it('uses trigger-specific repair context for disconnected trigger-path issues', () => {
    const ctx = context(
      [
        node('email', 'send.email', {
          recipient: 'owner@example.com',
          subject: 'Follow-up',
          body: 'Hi',
        }),
        node('task', 'task.create', { title: 'Follow up' }),
      ],
      [edge('email', 'task')],
    )
    const actions = actionsForCode(ctx, 'disconnected-node')
    const addTrigger = actions.find((item) => item.label === 'Add Trigger')
    expect(addTrigger).toMatchObject({
      actionType: 'open_add_node',
      suggestedPlacement: 'before',
      metadata: expect.objectContaining({ category: 'Triggers' }),
    })
    expect(applyWorkflowRepair(addTrigger!, ctx).effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'open_add_node',
          category: 'Triggers',
          repairContext: expect.objectContaining({
            type: 'missing-trigger',
            targetNodeId: 'email',
            insertion: 'before',
          }),
        }),
      ]),
    )
  })

  it('exposes typed condition repair targets for an incomplete branch', () => {
    const ctx = context(
      [
        node('lead', 'lead.created'),
        node('condition', 'condition.branch', { condition: '' }),
      ],
      [edge('lead', 'condition')],
    )
    const actions = actionsForCode(ctx, 'empty-branch')

    expect(actions.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Configure Branch',
        'Select Field',
        'Select Condition',
        'Select Value',
      ]),
    )
    expect(actions.find((item) => item.label === 'Select Field')).toMatchObject(
      {
        actionType: 'focus_field',
        targetFieldKey: 'condition',
        metadata: expect.objectContaining({ conditionTarget: 'field' }),
      },
    )
  })

  it('requires confirmation for destructive duplicate connection repair', () => {
    const ctx = context(
      [
        node('lead', 'lead.created'),
        node('task', 'task.create', { title: 'Follow up' }),
      ],
      [edge('lead', 'task', 'a'), edge('lead', 'task', 'b')],
    )
    const actions = actionsForCode(ctx, 'duplicate-connection')

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Review Connections',
          requiresConfirmation: false,
        }),
        expect.objectContaining({
          label: 'Remove Duplicate',
          requiresConfirmation: true,
        }),
      ]),
    )
  })

  it('includes cycle path context for cycle repairs', () => {
    const ctx = context(
      [
        node('lead', 'lead.created'),
        node('sms', 'send.sms', { phone: '555-555-5555', message: 'Hi' }),
        node('task', 'task.create', { title: 'Follow up' }),
      ],
      [edge('lead', 'sms'), edge('sms', 'task'), edge('task', 'sms')],
    )
    const actions = actionsForCode(ctx, 'cycle')

    expect(actions[0]).toMatchObject({
      label: 'Review Cycle',
      actionType: 'review_issue',
      metadata: expect.objectContaining({
        cycleNodeIds: expect.arrayContaining(['sms', 'task']),
      }),
    })
  })

  it('does not create Add Next Step repair for terminal-capable complete paths', () => {
    const ctx = context(
      [
        node('lead', 'lead.created'),
        node('email', 'send.email', {
          recipient: 'owner@example.com',
          subject: 'Follow-up',
          body: 'Hi',
        }),
      ],
      [edge('lead', 'email')],
    )

    expect(
      [...ctx.health.errors, ...ctx.health.warnings].map((issue) => issue.code),
    ).not.toContain('missing-end-path')
  })

  it('routes invalid mapping repairs to Data Links and field focus effects', () => {
    const ctx = context(
      [
        node('lead', 'lead.created'),
        node('email', 'send.email', {
          recipient: '{{nodes.lead.lead.phone}}',
          subject: 'Follow-up',
          body: 'Hi',
        }),
      ],
      [edge('lead', 'email')],
    )
    const actions = actionsForCode(ctx, 'invalid-mapping')
    const result = applyWorkflowRepair(actions[0], ctx)

    expect(actions[0]).toMatchObject({
      label: 'Review Mapping',
      actionType: 'open_data_mapping',
    })
    expect(result.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'open_data_mapping' }),
      ]),
    )
  })
})
