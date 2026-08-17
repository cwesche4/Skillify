import { describe, expect, it } from 'vitest'
import type { Node } from 'reactflow'

import {
  branchPreviewDataFromInputs,
  branchPreviewFingerprint,
  evaluateBranchPreviewInput,
  evaluateConditionExpression,
  getBranchPreviewInputs,
} from '@/lib/workflows/branchPreviewInputs'
import { analyzeWorkflowBranches } from '@/lib/workflows/workflowBranches'
import { resolveWorkspaceFieldOptions } from '@/lib/workflows/workspaceFieldOptions'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'

function node(id: string, condition: string): Node {
  return {
    id,
    type: 'condition.branch',
    position: { x: 0, y: 0 },
    data: {
      label: 'Condition / Branch',
      __registryNodeId: 'condition.branch',
      condition,
    },
  } as Node
}

describe('branch preview inputs', () => {
  it('changing a preview value switches Matches to Otherwise and back', () => {
    const branch = node('branch', 'Owner is team_ops')
    const inputs = getBranchPreviewInputs({
      nodes: [branch],
      overrides: { 'branch:match:Owner': 'team_support' },
      workspace: {
        teams: [
          { id: 'team_ops', name: 'Operations' },
          { id: 'team_support', name: 'Support' },
        ],
      },
    })
    expect(evaluateBranchPreviewInput(inputs[0])).toMatchObject({
      matched: false,
    })

    const matchingInputs = getBranchPreviewInputs({
      nodes: [branch],
      overrides: { 'branch:match:Owner': 'team_ops' },
      workspace: {
        teams: [
          { id: 'team_ops', name: 'Operations' },
          { id: 'team_support', name: 'Support' },
        ],
      },
    })
    expect(evaluateBranchPreviewInput(matchingInputs[0])).toMatchObject({
      matched: true,
    })
  })

  it('preview input data changes selected and skipped paths', () => {
    const branch = node('branch', 'Owner is team_ops')
    const action = {
      id: 'sms',
      type: 'send.sms',
      position: { x: 0, y: 0 },
      data: { __registryNodeId: 'send.sms' },
    } as Node
    const fallback = {
      id: 'email',
      type: 'send.email',
      position: { x: 0, y: 0 },
      data: { __registryNodeId: 'send.email' },
    } as Node
    const edges = [
      { id: 'match', source: 'branch', target: 'sms', sourceHandle: 'match' },
      {
        id: 'fallback',
        source: 'branch',
        target: 'email',
        sourceHandle: 'fallback',
      },
    ]

    expect(
      analyzeWorkflowBranches({
        nodes: [branch, action, fallback],
        edges,
        previewData: { Owner: 'team_ops' },
      }).branchNodes[0],
    ).toMatchObject({
      selectedPathKeys: ['match'],
      skippedPathKeys: ['fallback'],
    })
    expect(
      analyzeWorkflowBranches({
        nodes: [branch, action, fallback],
        edges,
        previewData: { Owner: 'team_support' },
      }).branchNodes[0],
    ).toMatchObject({
      selectedPathKeys: ['fallback'],
      skippedPathKeys: ['match'],
    })
  })

  it('includes preview input overrides in fingerprinting', () => {
    expect(branchPreviewFingerprint({ a: '1' })).not.toEqual(
      branchPreviewFingerprint({ a: '2' }),
    )
  })

  it('resolves renamed workspace labels while preserving canonical IDs', () => {
    const options = resolveWorkspaceFieldOptions({
      field: { semanticRole: 'team', workspaceOptionCategory: 'teams' },
      workspace: { teams: [{ id: 'team_ops', name: 'Operations' }] },
      currentValue: 'team_ops',
    })
    expect(options[0]).toMatchObject({ label: 'Operations', value: 'team_ops' })
  })

  it('marks deleted workspace values as unavailable', () => {
    const options = resolveWorkspaceFieldOptions({
      field: { semanticRole: 'team', workspaceOptionCategory: 'teams' },
      workspace: { teams: [{ id: 'team_support', name: 'Support' }] },
      currentValue: 'team_ops',
    })
    expect(options[0]).toMatchObject({ value: 'team_ops', unavailable: true })
  })

  it('reuses workspace-driven options for Condition / Branch and task owner fields', () => {
    const taskOwner = getWorkflowNodeDefinition(
      'task.create',
    )?.configFields.find((field) => field.id === 'owner')
    const conditionInput = getBranchPreviewInputs({
      nodes: [node('branch', 'Owner is user_1')],
      workspace: {
        members: [{ userId: 'user_1', fullName: 'Sarah Dispatch' }],
      },
    })[0]
    const taskOptions = resolveWorkspaceFieldOptions({
      field: taskOwner,
      workspace: {
        members: [{ userId: 'user_1', fullName: 'Sarah Dispatch' }],
      },
      currentValue: 'user_1',
    })
    expect(conditionInput.options.map((option) => option.label)).toContain(
      'Sarah Dispatch',
    )
    expect(taskOptions.map((option) => option.label)).toContain(
      'Sarah Dispatch',
    )
  })

  it('evaluates string, number, boolean, and enum-like conditions', () => {
    expect(
      evaluateConditionExpression('Stage is Proposal', { Stage: 'Proposal' })
        .matched,
    ).toBe(true)
    expect(
      evaluateConditionExpression('Value greater than 100', { Value: '150' })
        .matched,
    ).toBe(true)
    expect(
      evaluateConditionExpression('Approved is true', { Approved: 'false' })
        .matched,
    ).toBe(false)
    expect(
      evaluateConditionExpression('Health is At Risk', { Health: 'Healthy' })
        .matched,
    ).toBe(false)
  })

  it('keeps multiple branch nodes independent', () => {
    const inputs = getBranchPreviewInputs({
      nodes: [
        node('branch-a', 'Stage is Proposal'),
        node('branch-b', 'Health is At Risk'),
      ],
      overrides: {
        'branch-a:match:Stage': 'Proposal',
        'branch-b:match:Health': 'Healthy',
      },
    })
    expect(
      inputs.map((input) => [
        input.id,
        evaluateBranchPreviewInput(input).matched,
      ]),
    ).toEqual([
      ['branch-a:match:Stage', true],
      ['branch-b:match:Health', false],
    ])
    expect(branchPreviewDataFromInputs(inputs)).toMatchObject({
      Stage: 'Proposal',
      Health: 'Healthy',
    })
  })
})
