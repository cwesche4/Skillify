import { describe, expect, it } from 'vitest'
import type { Edge, Node } from 'reactflow'

import { executeWorkflowPreview } from '@/lib/workflows/executionEngine'
import { analyzeWorkflowBranches } from '@/lib/workflows/workflowBranches'
import { analyzeWorkflowData } from '@/lib/workflows/workflowDataFlow'

function node(
  id: string,
  registryId: string,
  label = registryId,
  data: Record<string, unknown> = {},
): Node {
  return {
    id,
    type: registryId,
    position: { x: 0, y: 0 },
    data: {
      label,
      __registryNodeId: registryId,
      ...data,
    },
  } as Node
}

function edge(source: string, target: string, sourceHandle?: string): Edge {
  return {
    id: `${source}-${sourceHandle ?? 'out'}-${target}`,
    source,
    target,
    sourceHandle,
    type: 'default',
  }
}

describe('workflow branch analyzer', () => {
  it('selects one path for exclusive branches and skips the sibling path', () => {
    const trigger = node('trigger', 'lead.created', 'Lead Created')
    const branch = node('branch', 'condition.branch', 'Condition / Branch', {
      condition: '{{nodes.trigger.lead.status}} equals Qualified',
    })
    const sms = node('sms', 'send.sms', 'Send SMS')
    const email = node('email', 'send.email', 'Send Email')
    const report = analyzeWorkflowBranches({
      nodes: [trigger, branch, sms, email],
      edges: [
        edge('trigger', 'branch'),
        edge('branch', 'sms', 'matched'),
        edge('branch', 'email', 'unmatched'),
      ],
      previewData: { lead: { status: 'Qualified' } },
    })

    expect(report.branchNodes[0]).toMatchObject({
      mode: 'exclusive',
      selectedPathKeys: ['match'],
      skippedPathKeys: ['fallback'],
    })
  })

  it('runs fallback when no exclusive primary path matches', () => {
    const trigger = node('trigger', 'lead.created', 'Lead Created')
    const branch = node('branch', 'condition.branch', 'Condition / Branch', {
      condition: 'false',
    })
    const sms = node('sms', 'send.sms', 'Send SMS')
    const email = node('email', 'send.email', 'Send Email')
    const report = analyzeWorkflowBranches({
      nodes: [trigger, branch, sms, email],
      edges: [
        edge('trigger', 'branch'),
        edge('branch', 'sms', 'matched'),
        edge('branch', 'email', 'unmatched'),
      ],
    })

    expect(report.branchNodes[0].selectedPathKeys).toEqual(['fallback'])
  })

  it('does not run fallback when a primary path matches', () => {
    const branch = node('branch', 'condition.branch', 'Condition / Branch', {
      condition: 'true',
    })
    const sms = node('sms', 'send.sms', 'Send SMS')
    const email = node('email', 'send.email', 'Send Email')
    const report = analyzeWorkflowBranches({
      nodes: [branch, sms, email],
      edges: [
        edge('branch', 'sms', 'matched'),
        edge('branch', 'email', 'unmatched'),
      ],
    })

    expect(report.branchNodes[0].selectedPathKeys).toEqual(['match'])
    expect(report.branchNodes[0].skippedPathKeys).toContain('fallback')
  })

  it('first-match branches respect configured path order', () => {
    const router = node('router', 'or.path', 'OR Path', {
      conditions: 'always true',
    })
    const task = node('task', 'task.create', 'Create Task')
    const note = node('note', 'note.add', 'Add Note')
    const report = analyzeWorkflowBranches({
      nodes: [router, task, note],
      edges: [
        edge('router', 'task', 'path_a'),
        edge('router', 'note', 'path_b'),
      ],
    })

    expect(report.branchNodes[0]).toMatchObject({
      mode: 'first-match',
      selectedPathKeys: ['path_a'],
      skippedPathKeys: ['path_b'],
    })
  })

  it('multi-match branches select multiple connected paths', () => {
    const splitter = node('splitter', 'ai.splitter', 'AI Splitter', {
      schemaHint: '{ "name": "string", "email": "string" }',
    })
    const task = node('task', 'task.create', 'Create Task')
    const email = node('email', 'send.email', 'Send Email')
    const report = analyzeWorkflowBranches({
      nodes: [splitter, task, email],
      edges: [
        edge('splitter', 'task', 'fields.name'),
        edge('splitter', 'email', 'fields.email'),
      ],
    })

    expect(report.branchNodes[0]).toMatchObject({
      mode: 'multi-match',
      selectedPathKeys: ['fields.name', 'fields.email'],
    })
  })

  it('reports empty and configured-but-disconnected branch paths', () => {
    const branch = node('branch', 'condition.branch', 'Condition / Branch', {
      condition: 'client.health equals At Risk',
    })
    const report = analyzeWorkflowBranches({ nodes: [branch], edges: [] })

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'branch-path-disconnected',
          pathKey: 'match',
        }),
      ]),
    )
  })

  it('treats condition branches as ready when Matches and Otherwise are connected', () => {
    const branch = node('branch', 'condition.branch', 'Condition / Branch', {
      condition: 'client.health equals At Risk',
    })
    const task = node('task', 'task.create', 'Create Task')
    const email = node('email', 'send.email', 'Send Email')
    const report = analyzeWorkflowBranches({
      nodes: [branch, task, email],
      edges: [
        edge('branch', 'task', 'match'),
        edge('branch', 'email', 'fallback'),
      ],
    })

    expect(report.branchNodes[0].paths.map((path) => path.pathLabel)).toEqual([
      'Matches',
      'Otherwise',
    ])
    expect(
      report.issues.filter(
        (issue) => issue.code === 'branch-path-disconnected',
      ),
    ).toHaveLength(0)
  })

  it('reports missing Matches and missing Otherwise paths separately', () => {
    const branch = node('branch', 'condition.branch', 'Condition / Branch', {
      condition: 'true',
    })
    const task = node('task', 'task.create', 'Create Task')
    const missingOtherwise = analyzeWorkflowBranches({
      nodes: [branch, task],
      edges: [edge('branch', 'task', 'match')],
    })
    const missingMatches = analyzeWorkflowBranches({
      nodes: [branch, task],
      edges: [edge('branch', 'task', 'fallback')],
    })

    expect(missingOtherwise.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'branch-path-disconnected',
          pathKey: 'fallback',
          message: 'Condition / Branch: The Otherwise path is not connected.',
        }),
      ]),
    )
    expect(missingMatches.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'branch-path-disconnected',
          pathKey: 'match',
          message: 'Condition / Branch: The Matches path is not connected.',
        }),
      ]),
    )
  })

  it('supports legacy condition branch handle aliases without losing connections', () => {
    const branch = node('branch', 'condition.branch', 'Condition / Branch', {
      condition: 'true',
    })
    const task = node('task', 'task.create', 'Create Task')
    const email = node('email', 'send.email', 'Send Email')
    const report = analyzeWorkflowBranches({
      nodes: [branch, task, email],
      edges: [
        edge('branch', 'task', 'matched'),
        edge('branch', 'email', 'unmatched'),
      ],
    })

    expect(
      report.branchNodes[0].paths.find((path) => path.pathKey === 'match')
        ?.connectedNodeIds,
    ).toEqual(['task'])
    expect(
      report.branchNodes[0].paths.find((path) => path.pathKey === 'fallback')
        ?.connectedNodeIds,
    ).toEqual(['email'])
  })

  it('reports connected but unconfigured paths', () => {
    const branch = node('branch', 'condition.branch', 'Condition / Branch')
    const task = node('task', 'task.create', 'Create Task')
    const report = analyzeWorkflowBranches({
      nodes: [branch, task],
      edges: [edge('branch', 'task', 'matched')],
    })

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'branch-path-unconfigured',
          pathKey: 'match',
        }),
      ]),
    )
  })

  it('detects direct rejoin and optional branch data', () => {
    const branch = node('branch', 'condition.branch', 'Condition / Branch', {
      condition: 'true',
    })
    const task = node('task', 'task.create', 'Create Task')
    const note = node('note', 'note.add', 'Add Note')
    const email = node('email', 'send.email', 'Send Email')
    const report = analyzeWorkflowBranches({
      nodes: [branch, task, note, email],
      edges: [
        edge('branch', 'task', 'matched'),
        edge('branch', 'note', 'unmatched'),
        edge('task', 'email'),
        edge('note', 'email'),
      ],
    })

    expect(report.merges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mergeNodeId: 'email',
          mergeStatus: 'optional-data',
        }),
      ]),
    )
  })

  it('detects indirect rejoin through converging graph areas', () => {
    const branch = node('branch', 'condition.branch', 'Condition / Branch', {
      condition: 'true',
    })
    const task = node('task', 'task.create', 'Create Task')
    const note = node('note', 'note.add', 'Add Note')
    const wait = node('wait', 'wait.delay', 'Wait / Delay')
    const email = node('email', 'send.email', 'Send Email')
    const report = analyzeWorkflowBranches({
      nodes: [branch, task, note, wait, email],
      edges: [
        edge('branch', 'task', 'matched'),
        edge('branch', 'note', 'unmatched'),
        edge('task', 'wait'),
        edge('note', 'wait'),
        edge('wait', 'email'),
      ],
    })

    expect(report.merges.map((merge) => merge.mergeNodeId)).toContain('wait')
  })

  it('keeps branch-local variables off sibling paths', () => {
    const branch = node('branch', 'condition.branch', 'Condition / Branch', {
      condition: 'true',
    })
    const task = node('task', 'task.create', 'Create Task')
    const note = node('note', 'note.add', 'Add Note')
    const report = analyzeWorkflowBranches({
      nodes: [branch, task, note],
      edges: [
        edge('branch', 'task', 'matched'),
        edge('branch', 'note', 'unmatched'),
      ],
    })

    expect(
      report.branchNodes[0].branchLocalVariables.match.map(
        (variable) => variable.key,
      ),
    ).toContain('nodes.task.task.id')
    expect(
      report.branchNodes[0].branchLocalVariables.fallback.map(
        (variable) => variable.key,
      ),
    ).not.toContain('nodes.task.task.id')
  })

  it('supports nested branch path context without path identity collisions', () => {
    const outer = node('outer', 'condition.branch', 'Outer Branch', {
      condition: 'true',
    })
    const inner = node('inner', 'condition.branch', 'Inner Branch', {
      condition: 'true',
    })
    const task = node('task', 'task.create', 'Create Task')
    const note = node('note', 'note.add', 'Add Note')
    const report = analyzeWorkflowBranches({
      nodes: [outer, inner, task, note],
      edges: [
        edge('outer', 'inner', 'matched'),
        edge('inner', 'task', 'matched'),
        edge('inner', 'note', 'unmatched'),
      ],
    })

    expect(report.branchNodes).toHaveLength(2)
    expect(report.pathByNodeId.task).toMatchObject({
      sourceBranchNodeId: 'inner',
      pathKey: 'match',
    })
  })

  it('non-branch workflows return no branch issues', () => {
    const trigger = node('trigger', 'lead.created', 'Lead Created')
    const sms = node('sms', 'send.sms', 'Send SMS')
    const report = analyzeWorkflowBranches({
      nodes: [trigger, sms],
      edges: [edge('trigger', 'sms')],
    })

    expect(report.branchNodes).toHaveLength(0)
    expect(report.issues).toHaveLength(0)
  })

  it('integrates with data-flow for available path entry data', () => {
    const trigger = node('trigger', 'lead.created', 'Lead Created')
    const branch = node('branch', 'condition.branch', 'Condition / Branch', {
      condition: '{{nodes.trigger.lead.status}} equals New',
    })
    const sms = node('sms', 'send.sms', 'Send SMS')
    const dataFlow = analyzeWorkflowData({
      nodes: [trigger, branch, sms],
      edges: [edge('trigger', 'branch'), edge('branch', 'sms', 'matched')],
    })
    const report = analyzeWorkflowBranches({
      nodes: [trigger, branch, sms],
      edges: [edge('trigger', 'branch'), edge('branch', 'sms', 'matched')],
      dataFlow,
    })

    expect(
      report.branchNodes[0].paths[0].availableEnteringPath.map(
        (variable) => variable.key,
      ),
    ).toContain('nodes.trigger.lead.status')
  })

  it('preview run skips non-selected paths without counting them as failures', async () => {
    const trigger = node('trigger', 'lead.created', 'Lead Created')
    const branch = node('branch', 'condition.branch', 'Condition / Branch', {
      condition: 'true',
    })
    const sms = node('sms', 'send.sms', 'Send SMS', {
      phone: '+1 555 555 5555',
      message: 'Hi',
    })
    const email = node('email', 'send.email', 'Send Email', {
      recipient: 'owner@example.com',
      subject: 'Follow up',
      body: 'Hi',
    })
    const execution = await executeWorkflowPreview({
      automationId: 'automation',
      workspaceId: 'workspace',
      nodes: [trigger, branch, sms, email],
      edges: [
        edge('trigger', 'branch'),
        edge('branch', 'sms', 'matched'),
        edge('branch', 'email', 'unmatched'),
      ],
      previewDelayMs: 0,
    })

    expect(execution.summary.failed).toBe(0)
    expect(execution.summary.skippedPaths).toBe(1)
    expect(execution.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'email',
          status: 'skipped',
        }),
        expect.objectContaining({
          nodeId: 'branch',
          output: expect.objectContaining({
            __branchPaths: expect.arrayContaining([
              expect.objectContaining({ pathKey: 'match', status: 'selected' }),
              expect.objectContaining({
                pathKey: 'fallback',
                status: 'skipped',
              }),
            ]),
          }),
        }),
      ]),
    )
  })

  it('preview run selects Otherwise and skips Matches when the condition does not match', async () => {
    const trigger = node('trigger', 'lead.created', 'Lead Created')
    const branch = node('branch', 'condition.branch', 'Condition / Branch', {
      condition: 'false',
    })
    const sms = node('sms', 'send.sms', 'Send SMS', {
      phone: '+1 555 555 5555',
      message: 'Hi',
    })
    const email = node('email', 'send.email', 'Send Email', {
      recipient: 'owner@example.com',
      subject: 'Follow up',
      body: 'Hi',
    })
    const execution = await executeWorkflowPreview({
      automationId: 'automation',
      workspaceId: 'workspace',
      nodes: [trigger, branch, sms, email],
      edges: [
        edge('trigger', 'branch'),
        edge('branch', 'sms', 'match'),
        edge('branch', 'email', 'fallback'),
      ],
      previewDelayMs: 0,
    })

    expect(execution.summary.failed).toBe(0)
    expect(execution.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'sms',
          status: 'skipped',
        }),
        expect.objectContaining({
          nodeId: 'email',
          status: 'succeeded',
        }),
        expect.objectContaining({
          nodeId: 'branch',
          output: expect.objectContaining({
            __branchPaths: expect.arrayContaining([
              expect.objectContaining({ pathKey: 'match', status: 'skipped' }),
              expect.objectContaining({
                pathKey: 'fallback',
                status: 'selected',
              }),
            ]),
          }),
        }),
      ]),
    )
  })
})
