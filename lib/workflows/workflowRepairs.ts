import type { Edge, Node } from 'reactflow'

import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import type {
  WorkflowHealth,
  WorkflowHealthIssue,
} from '@/lib/workflows/workflowHealth'

export type WorkflowRepairActionType =
  | 'focus_node'
  | 'open_step_settings'
  | 'focus_field'
  | 'open_add_node'
  | 'add_node_before'
  | 'add_node_after'
  | 'connect_nodes'
  | 'remove_connection'
  | 'replace_connection'
  | 'remove_node'
  | 'select_branch'
  | 'open_data_mapping'
  | 'choose_workflow_data'
  | 'use_custom_value'
  | 'apply_field_example'
  | 'review_issue'

export type WorkflowRepairRisk = 'safe' | 'structural' | 'destructive'
export type WorkflowRepairIntent =
  | 'navigate'
  | 'configure'
  | 'connect'
  | 'add'
  | 'replace'
  | 'remove'
  | 'review'

export type WorkflowRepairAvailability =
  | { available: true }
  | { available: false; reason: string }

export type WorkflowRepairAction = {
  id: string
  issueId: string
  label: string
  description: string
  actionType: WorkflowRepairActionType
  intent: WorkflowRepairIntent
  risk: WorkflowRepairRisk
  requiresConfirmation: boolean
  canAutoApply: boolean
  availability: WorkflowRepairAvailability
  targetNodeId?: string
  targetFieldKey?: string
  targetEdgeId?: string
  suggestedNodeType?: string
  suggestedPlacement?: 'before' | 'after' | 'branch'
  metadata?: Record<string, unknown>
}

export type WorkflowRepairContext = {
  nodes: Node[]
  edges: Edge[]
  health: WorkflowHealth
}

export type WorkflowRepairResult = {
  ok: boolean
  action: WorkflowRepairAction
  effects: Array<
    | { type: 'focus_node'; nodeId: string }
    | { type: 'focus_field'; nodeId: string; fieldKey: string }
    | {
        type: 'open_add_node'
        sourceNodeId?: string
        category?: string
        preferredNodeIds?: string[]
        repairContext?: Record<string, unknown> | null
      }
    | { type: 'open_data_mapping'; nodeId?: string; edgeId?: string }
    | { type: 'focus_edges'; edgeIds: string[] }
    | { type: 'confirm'; title: string; description: string }
  >
  message?: string
}

function registryIdForNode(node?: Node) {
  const registryNodeId = (
    node?.data as { __registryNodeId?: unknown } | undefined
  )?.__registryNodeId
  return typeof registryNodeId === 'string'
    ? registryNodeId
    : (node?.type ?? 'unknown')
}

function nodeLabel(node?: Node) {
  if (!node) return 'Workflow'
  const data = node.data as { label?: unknown } | undefined
  if (typeof data?.label === 'string' && data.label.trim())
    return data.label.trim()
  return (
    getWorkflowNodeDefinition(registryIdForNode(node))?.label ??
    node.type ??
    node.id
  )
}

function fieldLabel(
  issue: WorkflowHealthIssue,
  context: WorkflowRepairContext,
) {
  if (!issue.field || !issue.nodeId) return undefined
  const node = context.nodes.find((item) => item.id === issue.nodeId)
  const definition = getWorkflowNodeDefinition(registryIdForNode(node))
  const field = definition?.configFields.find(
    (item) => (item.key ?? item.id) === issue.field || item.id === issue.field,
  )
  return field?.mappingLabel ?? field?.label ?? issue.field
}

function action({
  issue,
  label,
  description,
  actionType,
  intent,
  risk = 'safe',
  requiresConfirmation,
  canAutoApply = false,
  availability = { available: true } as WorkflowRepairAvailability,
  targetNodeId = issue.nodeId,
  targetFieldKey = issue.field,
  targetEdgeId = issue.edgeId,
  suggestedNodeType,
  suggestedPlacement,
  metadata,
}: {
  issue: WorkflowHealthIssue
  label: string
  description: string
  actionType: WorkflowRepairActionType
  intent: WorkflowRepairIntent
  risk?: WorkflowRepairRisk
  requiresConfirmation?: boolean
  canAutoApply?: boolean
  availability?: WorkflowRepairAvailability
  targetNodeId?: string
  targetFieldKey?: string
  targetEdgeId?: string
  suggestedNodeType?: string
  suggestedPlacement?: WorkflowRepairAction['suggestedPlacement']
  metadata?: Record<string, unknown>
}): WorkflowRepairAction {
  return {
    id: `${issue.id}:${actionType}:${targetNodeId ?? ''}:${targetFieldKey ?? ''}:${targetEdgeId ?? ''}`,
    issueId: issue.id,
    label,
    description,
    actionType,
    intent,
    risk,
    requiresConfirmation: requiresConfirmation ?? risk !== 'safe',
    canAutoApply,
    availability,
    targetNodeId,
    targetFieldKey,
    targetEdgeId,
    suggestedNodeType,
    suggestedPlacement,
    metadata,
  }
}

function focusAction(
  issue: WorkflowHealthIssue,
  context: WorkflowRepairContext,
) {
  const node = context.nodes.find((item) => item.id === issue.nodeId)
  return issue.nodeId
    ? action({
        issue,
        label: `Focus ${nodeLabel(node)}`,
        description: `Center ${nodeLabel(node)} on the canvas.`,
        actionType: 'focus_node',
        intent: 'navigate',
      })
    : null
}

function triggerPreferredNodeIds(
  issue: WorkflowHealthIssue,
  context: WorkflowRepairContext,
) {
  const node = context.nodes.find((item) => item.id === issue.nodeId)
  const definition = getWorkflowNodeDefinition(registryIdForNode(node))
  const text =
    `${definition?.category ?? ''} ${definition?.label ?? ''} ${definition?.description ?? ''}`.toLowerCase()
  if (text.includes('sms'))
    return [
      'crm.trigger',
      'lead.created',
      'task.created',
      'service_request.submitted',
    ]
  if (text.includes('email'))
    return [
      'lead.created',
      'crm.trigger',
      'service_request.submitted',
      'task.completed',
    ]
  if (text.includes('task'))
    return [
      'lead.created',
      'opportunity.stage_changed',
      'crm.trigger',
      'task.created',
    ]
  return [
    'lead.created',
    'crm.trigger',
    'service_request.submitted',
    'task.completed',
  ]
}

function isBranchCapable(
  issue: WorkflowHealthIssue,
  context: WorkflowRepairContext,
) {
  const node = context.nodes.find((item) => item.id === issue.nodeId)
  const definition = getWorkflowNodeDefinition(registryIdForNode(node))
  return Boolean(
    definition?.branchHandles?.length ||
    definition?.requiredBranchHandles?.length ||
    definition?.optionalBranchHandles?.length ||
    definition?.allowsMultipleOutgoing ||
    definition?.acceptsMultipleOutputs,
  )
}

export function getWorkflowRepairActions(
  issue: WorkflowHealthIssue,
  context: WorkflowRepairContext,
): WorkflowRepairAction[] {
  const actions: Array<WorkflowRepairAction | null> = []
  const label = fieldLabel(issue, context)
  const targetNode = context.nodes.find((node) => node.id === issue.nodeId)

  switch (issue.code) {
    case 'missing-trigger':
      actions.push(
        action({
          issue,
          label: 'Add Trigger',
          description: 'Choose what should start this workflow.',
          actionType: 'open_add_node',
          intent: 'add',
          suggestedPlacement: 'before',
          metadata: {
            category: 'Triggers',
            preferredNodeIds: triggerPreferredNodeIds(issue, context),
          },
        }),
      )
      actions.push(focusAction(issue, context))
      break
    case 'missing-required-field':
      actions.push(
        action({
          issue,
          label: label ? `Open ${label}` : 'Open Step Settings',
          description: label
            ? `Open ${label} so it can be completed.`
            : 'Open the step settings for this issue.',
          actionType: issue.field ? 'focus_field' : 'open_step_settings',
          intent: 'configure',
        }),
      )
      break
    case 'broken-variable':
      actions.push(
        action({
          issue,
          label: 'Replace Workflow Data',
          description:
            'Choose compatible workflow data or enter a custom value.',
          actionType: 'choose_workflow_data',
          intent: 'replace',
        }),
      )
      break
    case 'invalid-mapping':
      actions.push(
        action({
          issue,
          label: 'Review Mapping',
          description: 'Open Data Links and review compatible values.',
          actionType: 'open_data_mapping',
          intent: 'configure',
        }),
      )
      if (issue.field) {
        actions.push(
          action({
            issue,
            label: label ? `Open ${label}` : 'Open Field',
            description: 'Open the affected field in Step Settings.',
            actionType: 'focus_field',
            intent: 'configure',
          }),
        )
      }
      break
    case 'disconnected-node':
    case 'unreachable-node':
      actions.push(
        action({
          issue,
          label: 'Add Trigger',
          description:
            'Choose what should start this disconnected workflow path.',
          actionType: 'open_add_node',
          intent: 'add',
          suggestedPlacement: 'before',
          metadata: {
            category: 'Triggers',
            preferredNodeIds: triggerPreferredNodeIds(issue, context),
          },
        }),
      )
      actions.push(
        action({
          issue,
          label: 'Connect to Workflow',
          description: 'Select an existing step this should connect to.',
          actionType: 'connect_nodes',
          intent: 'connect',
          canAutoApply: false,
          metadata: { mode: 'target-selection' },
        }),
      )
      actions.push(focusAction(issue, context))
      break
    case 'orphan-node':
      actions.push(
        action({
          issue,
          label: 'Connect to Workflow',
          description: 'Choose where this step should connect in the workflow.',
          actionType: 'connect_nodes',
          intent: 'connect',
          canAutoApply: false,
          availability: { available: true },
          metadata: { mode: 'target-selection' },
        }),
      )
      actions.push(
        action({
          issue,
          label: 'Add Trigger',
          description: 'Choose what should start this isolated component.',
          actionType: 'open_add_node',
          intent: 'add',
          suggestedPlacement: 'before',
          metadata: {
            category: 'Triggers',
            preferredNodeIds: triggerPreferredNodeIds(issue, context),
          },
        }),
      )
      actions.push(focusAction(issue, context))
      break
    case 'duplicate-connection':
      actions.push(
        action({
          issue,
          label: 'Review Connections',
          description: 'Focus duplicate connections before changing them.',
          actionType: 'review_issue',
          intent: 'review',
          targetEdgeId: issue.edgeId,
        }),
      )
      if (
        issue.edgeId ||
        context.health.graph.duplicateConnectionIds.length === 1
      ) {
        actions.push(
          action({
            issue,
            label: 'Remove Duplicate',
            description: 'Remove the duplicate connection. This can be undone.',
            actionType: 'remove_connection',
            intent: 'remove',
            risk: 'destructive',
            targetEdgeId:
              issue.edgeId ?? context.health.graph.duplicateConnectionIds[0],
            canAutoApply: true,
          }),
        )
      }
      break
    case 'cycle':
      actions.push(
        action({
          issue,
          label: 'Review Cycle',
          description: `Review the loop involving ${context.health.graph.cycleNodeIds.map((id) => nodeLabel(context.nodes.find((node) => node.id === id))).join(' → ')}.`,
          actionType: 'review_issue',
          intent: 'review',
          metadata: { cycleNodeIds: context.health.graph.cycleNodeIds },
        }),
      )
      break
    case 'empty-branch':
    case 'dead-branch':
      {
        const branchCapable = isBranchCapable(issue, context)
        actions.push(
          action({
            issue,
            label:
              issue.code === 'empty-branch'
                ? 'Configure Branch'
                : branchCapable
                  ? 'Connect Branch'
                  : 'Add Next Step',
            description: branchCapable
              ? 'Open the branch step and complete the missing path.'
              : 'Add the next step after this workflow step.',
            actionType:
              issue.code === 'empty-branch' ? 'select_branch' : 'open_add_node',
            intent: issue.code === 'empty-branch' ? 'configure' : 'connect',
            suggestedPlacement: branchCapable ? 'branch' : 'after',
          }),
        )
        if (issue.code === 'empty-branch') {
          actions.push(
            action({
              issue,
              label: 'Select Field',
              description:
                'Choose the workflow data this branch should evaluate.',
              actionType: 'focus_field',
              intent: 'configure',
              targetFieldKey: 'condition',
              metadata: { conditionTarget: 'field' },
            }),
          )
          actions.push(
            action({
              issue,
              label: 'Select Condition',
              description: 'Choose the comparison for this branch.',
              actionType: 'focus_field',
              intent: 'configure',
              targetFieldKey: 'condition',
              metadata: { conditionTarget: 'operator' },
            }),
          )
          actions.push(
            action({
              issue,
              label: 'Select Value',
              description:
                'Choose the value this branch should compare against.',
              actionType: 'focus_field',
              intent: 'configure',
              targetFieldKey: 'condition',
              metadata: { conditionTarget: 'value' },
            }),
          )
        }
        actions.push(focusAction(issue, context))
      }
      break
    case 'missing-end-path':
      actions.push(
        action({
          issue,
          label: 'Add Ending Step',
          description: targetNode
            ? `Add a next step after ${nodeLabel(targetNode)}.`
            : 'Add the next step for this workflow path.',
          actionType: 'add_node_after',
          intent: 'add',
          suggestedPlacement: 'after',
        }),
      )
      actions.push(focusAction(issue, context))
      break
    case 'multiple-triggers':
      actions.push(
        action({
          issue,
          label: 'Review Triggers',
          description:
            'Focus all trigger nodes and decide whether they should be separate workflows.',
          actionType: 'review_issue',
          intent: 'review',
          metadata: { triggerNodeIds: context.health.graph.triggerNodeIds },
        }),
      )
      actions.push(
        action({
          issue,
          label: 'Move Trigger to New Workflow',
          description:
            'Moving a trigger into a new workflow is planned for a future release.',
          actionType: 'review_issue',
          intent: 'review',
          canAutoApply: false,
          availability: { available: false, reason: 'Coming soon' },
        }),
      )
      if (issue.nodeId) {
        actions.push(
          action({
            issue,
            label: 'Remove Trigger',
            description: `Remove ${nodeLabel(targetNode)} from this workflow. This can be undone.`,
            actionType: 'remove_node',
            intent: 'remove',
            risk: 'destructive',
            canAutoApply: false,
          }),
        )
      }
      break
    case 'invalid-connection':
      actions.push(
        action({
          issue,
          label: 'Review Connections',
          description: 'Focus the invalid connection before changing it.',
          actionType: 'review_issue',
          intent: 'review',
          targetEdgeId: issue.edgeId,
        }),
      )
      break
    case 'best-practice':
      actions.push(focusAction(issue, context))
      break
  }

  return actions
    .filter((item): item is WorkflowRepairAction => Boolean(item))
    .slice(0, 4)
}

export function applyWorkflowRepair(
  repair: WorkflowRepairAction,
  _context: WorkflowRepairContext,
): WorkflowRepairResult {
  const effects: WorkflowRepairResult['effects'] = []
  if (repair.requiresConfirmation) {
    effects.push({
      type: 'confirm',
      title: repair.label,
      description: repair.description,
    })
  }
  switch (repair.actionType) {
    case 'focus_field':
      if (repair.targetNodeId && repair.targetFieldKey) {
        effects.push({
          type: 'focus_field',
          nodeId: repair.targetNodeId,
          fieldKey: repair.targetFieldKey,
        })
      }
      break
    case 'open_step_settings':
    case 'focus_node':
    case 'review_issue':
    case 'select_branch':
      if (repair.targetNodeId)
        effects.push({ type: 'focus_node', nodeId: repair.targetNodeId })
      if (
        repair.metadata?.cycleNodeIds &&
        Array.isArray(repair.metadata.cycleNodeIds)
      ) {
        const first = repair.metadata.cycleNodeIds.find(
          (id): id is string => typeof id === 'string',
        )
        if (first) effects.push({ type: 'focus_node', nodeId: first })
      }
      break
    case 'open_add_node':
    case 'add_node_before':
    case 'add_node_after':
    case 'connect_nodes':
      effects.push({
        type: 'open_add_node',
        sourceNodeId:
          repair.actionType === 'add_node_after' ||
          repair.actionType === 'connect_nodes'
            ? repair.targetNodeId
            : undefined,
        category:
          typeof repair.metadata?.category === 'string'
            ? repair.metadata.category
            : undefined,
        preferredNodeIds: Array.isArray(repair.metadata?.preferredNodeIds)
          ? repair.metadata.preferredNodeIds.filter(
              (item): item is string => typeof item === 'string',
            )
          : undefined,
        repairContext:
          repair.actionType === 'open_add_node' &&
          repair.suggestedPlacement === 'before' &&
          repair.targetNodeId
            ? {
                type: 'missing-trigger',
                targetNodeId: repair.targetNodeId,
                insertion: 'before',
                preferredNodeIds: Array.isArray(
                  repair.metadata?.preferredNodeIds,
                )
                  ? repair.metadata.preferredNodeIds
                  : undefined,
              }
            : null,
      })
      if (repair.targetNodeId)
        effects.unshift({ type: 'focus_node', nodeId: repair.targetNodeId })
      break
    case 'open_data_mapping':
    case 'choose_workflow_data':
    case 'use_custom_value':
      effects.push({
        type: 'open_data_mapping',
        nodeId: repair.targetNodeId,
        edgeId: repair.targetEdgeId,
      })
      if (repair.targetNodeId && repair.targetFieldKey) {
        effects.push({
          type: 'focus_field',
          nodeId: repair.targetNodeId,
          fieldKey: repair.targetFieldKey,
        })
      }
      break
    case 'remove_connection':
    case 'replace_connection':
    case 'remove_node':
      if (repair.targetEdgeId)
        effects.push({ type: 'focus_edges', edgeIds: [repair.targetEdgeId] })
      if (repair.targetNodeId)
        effects.push({ type: 'focus_node', nodeId: repair.targetNodeId })
      break
    case 'apply_field_example':
      if (repair.targetNodeId && repair.targetFieldKey) {
        effects.push({
          type: 'focus_field',
          nodeId: repair.targetNodeId,
          fieldKey: repair.targetFieldKey,
        })
      }
      break
  }
  return { ok: effects.length > 0, action: repair, effects }
}
