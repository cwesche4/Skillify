import { getLocalTimestamp } from '@/lib/formatting/dates'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import { validateWorkflow } from '@/lib/workflows/validation'
import type {
  Workflow,
  WorkflowExecution,
  WorkflowExecutionContext,
  WorkflowExecutionLog,
  WorkflowExecutionStep,
  WorkflowNode,
  WorkflowRunStatus,
} from '@/lib/workflows/types'

function createLog(
  message: string,
  level: WorkflowExecutionLog['level'] = 'info',
  nodeId?: string,
): WorkflowExecutionLog {
  return {
    id: `log-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    timestamp: getLocalTimestamp(),
    level,
    message,
    nodeId,
  }
}

function buildAdjacency(workflow: Workflow) {
  const adjacency = new Map<string, string[]>()
  for (const edge of workflow.edges) {
    adjacency.set(edge.source, [
      ...(adjacency.get(edge.source) ?? []),
      edge.target,
    ])
  }
  return adjacency
}

function isTriggerNode(node: WorkflowNode) {
  return (
    node.type === 'trigger' ||
    node.type === 'crm-trigger' ||
    node.type === 'crm.trigger' ||
    node.type.includes('.created') ||
    node.type.includes('.converted') ||
    node.type.includes('.completed') ||
    node.type.includes('.changed')
  )
}

function getExecutionOrder(workflow: Workflow) {
  const adjacency = buildAdjacency(workflow)
  const ordered: WorkflowNode[] = []
  const seen = new Set<string>()
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]))
  const roots = workflow.nodes.filter(isTriggerNode)

  const visit = (node: WorkflowNode) => {
    if (seen.has(node.id)) return
    seen.add(node.id)
    ordered.push(node)
    for (const nextId of adjacency.get(node.id) ?? []) {
      const next = nodesById.get(nextId)
      if (next) visit(next)
    }
  }

  ;(roots.length ? roots : workflow.nodes.slice(0, 1)).forEach(visit)
  return ordered
}

function createStep(
  runId: string,
  node: WorkflowNode,
  status: WorkflowRunStatus,
  logs: WorkflowExecutionLog[],
  error?: string,
): WorkflowExecutionStep {
  return {
    id: `${runId}-step-${node.id}`,
    runId,
    nodeId: node.id,
    nodeType: node.type,
    label: node.label,
    status,
    startedAt: logs[0]?.timestamp,
    finishedAt: logs.at(-1)?.timestamp,
    logs,
    error,
    output:
      status === 'succeeded' ? { preview: true, nodeId: node.id } : undefined,
  }
}

export async function simulateWorkflowRun(
  workflow: Workflow,
  context: WorkflowExecutionContext,
): Promise<WorkflowExecution> {
  const runId = `preview-run-${Date.now()}`
  const startedAt = getLocalTimestamp()
  const logs: WorkflowExecutionLog[] = [
    createLog(`Preview run started for ${workflow.name}.`),
  ]
  const validation = validateWorkflow(workflow)

  if (!validation.ok) {
    const error = 'Workflow validation failed.'
    logs.push(createLog(error, 'error'))
    return {
      id: runId,
      workflowId: workflow.id,
      workspaceId: workflow.workspaceId,
      status: 'failed',
      triggerSource:
        context.triggerEvent ?? workflow.trigger?.event ?? 'manual',
      startedAt,
      finishedAt: getLocalTimestamp(),
      steps: [],
      logs,
      error,
    }
  }

  const steps: WorkflowExecutionStep[] = []
  let status: WorkflowRunStatus = 'succeeded'

  for (const node of getExecutionOrder(workflow)) {
    if (node.disabled) {
      const stepLogs = [
        createLog(
          `${node.label} skipped because it is disabled.`,
          'warning',
          node.id,
        ),
      ]
      steps.push(createStep(runId, node, 'skipped', stepLogs))
      continue
    }

    const definition = getWorkflowNodeDefinition(node.type)
    const stepLogs = [createLog(`${node.label} started.`, 'info', node.id)]

    try {
      if (!definition && node.type === 'unknown') {
        throw new Error('Unsupported node type.')
      }

      if (definition?.executePreview) {
        await definition.executePreview(node, context)
      }

      stepLogs.push(
        createLog(`${node.label} completed in preview mode.`, 'info', node.id),
      )
      steps.push(createStep(runId, node, 'succeeded', stepLogs))
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Node failed during preview run.'
      stepLogs.push(createLog(message, 'error', node.id))
      steps.push(createStep(runId, node, 'failed', stepLogs, message))
      status = 'failed'
      break
    }
  }

  logs.push(
    createLog(
      status === 'succeeded'
        ? 'Preview run finished successfully.'
        : 'Preview run stopped after a failed step.',
      status === 'succeeded' ? 'info' : 'error',
    ),
  )

  return {
    id: runId,
    workflowId: workflow.id,
    workspaceId: workflow.workspaceId,
    status,
    triggerSource: context.triggerEvent ?? workflow.trigger?.event ?? 'manual',
    startedAt,
    finishedAt: getLocalTimestamp(),
    steps,
    logs,
  }
}
