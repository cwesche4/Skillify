import type { Edge, Node } from 'reactflow'

import { validateVariableValueForField } from '@/lib/workflows/dataMapping'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import type { NodeConfigField, WorkflowValueType } from '@/lib/workflows/types'
import {
  formatVariableReadableLabel,
  formatVariableSourceLabel,
  getAvailableVariablesForNode,
  getNodeOutputVariables,
  getUpstreamNodeIds,
  getWorkflowVariableDefinition,
  workflowVariableRegistry,
  type WorkflowVariableDefinition,
} from '@/lib/workflows/variableRegistry'
import {
  findVariableTokens,
  type WorkflowVariableToken,
} from '@/lib/workflows/variableTokens'

export type WorkflowDataFlowStatus =
  | 'valid'
  | 'deleted-producer'
  | 'unavailable-upstream'
  | 'missing-output'
  | 'incompatible'
  | 'unknown-variable'

export type WorkflowDataFlowConsumption = {
  id: string
  nodeId: string
  nodeLabel: string
  fieldKey: string
  fieldLabel: string
  token: string
  variableKey: string
  variableLabel: string
  variableType: WorkflowValueType | 'unknown'
  sourceNodeId?: string
  sourceNodeLabel?: string
  status: WorkflowDataFlowStatus
  message?: string
}

export type WorkflowDataRole = 'business' | 'runtime' | 'technical'

export type WorkflowDataFlowVariable = WorkflowVariableDefinition & {
  producerNodeId?: string
  producerNodeLabel?: string
  producerContextLabel: string
  dataRole: WorkflowDataRole
  warnWhenUnused: boolean
  canonicalWritePath?: string
  consumers: WorkflowDataFlowConsumption[]
  lastConsumerNodeId?: string
  unused: boolean
  overwritten: boolean
  overwriteSourceLabels: string[]
  overwriteMessage?: string
  valid: boolean
  invalidReason?: string
}

export type WorkflowVariableLineage = {
  variableKey: string
  label: string
  originNodeId?: string
  originNodeLabel?: string
  consumerNodeIds: string[]
  lastConsumerNodeId?: string
  valid: boolean
  unused: boolean
  overwritten: boolean
}

export type WorkflowDataFlowReport = {
  availableVariables: WorkflowDataFlowVariable[]
  producedVariables: WorkflowDataFlowVariable[]
  consumedVariables: WorkflowDataFlowConsumption[]
  orphanVariables: WorkflowDataFlowVariable[]
  unusedBusinessVariables: WorkflowDataFlowVariable[]
  unusedRuntimeVariables: WorkflowDataFlowVariable[]
  unusedTechnicalVariables: WorkflowDataFlowVariable[]
  invalidVariables: WorkflowDataFlowConsumption[]
  overwrittenVariables: WorkflowDataFlowVariable[]
  downstreamAvailability: Record<string, WorkflowDataFlowVariable[]>
  nodeInputs: Record<string, WorkflowDataFlowConsumption[]>
  nodeOutputs: Record<string, WorkflowDataFlowVariable[]>
  variableLineage: WorkflowVariableLineage[]
  graphOrder: string[]
}

function registryIdForNode(node: Node) {
  const registryNodeId = (
    node.data as { __registryNodeId?: unknown } | undefined
  )?.__registryNodeId
  return typeof registryNodeId === 'string'
    ? registryNodeId
    : (node.type ?? 'unknown')
}

function nodeLabel(node?: Node) {
  if (!node) return 'Workflow'
  const data = node.data as { label?: unknown } | undefined
  if (typeof data?.label === 'string' && data.label.trim())
    return data.label.trim()
  return (
    getWorkflowNodeDefinition(registryIdForNode(node))?.label ??
    node.type ??
    'Step'
  )
}

function fieldKey(field: NodeConfigField) {
  return field.key ?? field.id
}

function configValueForField(
  config: Record<string, unknown>,
  field: NodeConfigField,
): unknown {
  const key = fieldKey(field)
  const nested =
    config.config &&
    typeof config.config === 'object' &&
    !Array.isArray(config.config)
      ? (config.config as Record<string, unknown>)
      : {}
  return config[key] ?? nested[key] ?? field.defaultValue
}

function visibleFieldsForNode(node: Node) {
  const definition = getWorkflowNodeDefinition(registryIdForNode(node))
  if (!definition) return []
  const config = (node.data as Record<string, unknown> | undefined) ?? {}
  return definition.configFields.filter((field) => {
    if (!field.showWhen) return true
    const controlling = definition.configFields.find(
      (candidate) => fieldKey(candidate) === field.showWhen?.field,
    )
    const current =
      config[field.showWhen.field] ?? controlling?.defaultValue ?? ''
    return current === field.showWhen.equals
  })
}

function getGraphOrder(nodes: Node[], edges: Edge[]) {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  for (const node of nodes) {
    incoming.set(node.id, 0)
    outgoing.set(node.id, [])
  }
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1)
    outgoing.get(edge.source)?.push(edge.target)
  }
  const positionOrder = [...nodes].sort((a, b) => {
    const dx = (a.position?.x ?? 0) - (b.position?.x ?? 0)
    if (dx !== 0) return dx
    return (a.position?.y ?? 0) - (b.position?.y ?? 0)
  })
  const pending = positionOrder
    .filter((node) => (incoming.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
  const order: string[] = []
  while (pending.length) {
    const current = pending.shift()
    if (!current || order.includes(current)) continue
    order.push(current)
    for (const target of outgoing.get(current) ?? []) {
      incoming.set(target, Math.max(0, (incoming.get(target) ?? 0) - 1))
      if ((incoming.get(target) ?? 0) === 0) pending.push(target)
    }
  }
  for (const node of positionOrder) {
    if (!order.includes(node.id)) order.push(node.id)
  }
  return order
}

function variableFromDefinition(
  variable: WorkflowVariableDefinition,
): WorkflowDataFlowVariable {
  const dataRole = inferDataRole(variable)
  return {
    ...variable,
    producerNodeId: variable.sourceNodeId,
    producerNodeLabel: variable.sourceNodeLabel,
    producerContextLabel: producerContextLabel(variable),
    dataRole,
    warnWhenUnused:
      variable.warnWhenUnused ??
      (dataRole === 'business' && variable.direction === 'output'),
    canonicalWritePath: variable.writePath,
    consumers: [],
    unused: false,
    overwritten: false,
    overwriteSourceLabels: [],
    valid: true,
  }
}

function inferDataRole(variable: WorkflowVariableDefinition): WorkflowDataRole {
  if (variable.dataRole) return variable.dataRole
  const text =
    `${variable.path} ${variable.label} ${variable.key}`.toLowerCase()
  if (
    /\b(id|uuid|token|slug|provider|headers?)\b/.test(text) ||
    /(^|\.)(createdat|updatedat|sentat|resumedat|generatedat|occurredat)$/i.test(
      variable.path,
    ) ||
    /\b(created at|updated at|sent at|resumed at|generated at|occurred at|message id|delivery status|response status|response headers|run id)\b/.test(
      text,
    )
  ) {
    return 'runtime'
  }
  if (
    variable.type === 'object' ||
    variable.type === 'array' ||
    /\bmetadata|debug|raw\b/.test(text)
  ) {
    return 'technical'
  }
  return 'business'
}

function producerContextLabel(variable: WorkflowVariableDefinition) {
  const source = variable.sourceNodeLabel ?? formatVariableSourceLabel(variable)
  return source ? `From ${source}` : 'From Workflow'
}

function tokenKey(token: WorkflowVariableToken) {
  if (token.kind === 'node') return `nodes.${token.nodeId}.${token.path}`
  if (token.kind === 'workspace') return `workspace.${token.path}`
  return token.path
}

function outputPathLabel(path: string) {
  return (
    path
      .split('.')
      .at(-1)
      ?.replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\bid\b/gi, 'ID')
      .replace(/^\w/, (value) => value.toUpperCase()) ?? path
  )
}

function classifyNodeToken({
  token,
  targetNode,
  nodesById,
  edges,
}: {
  token: Extract<WorkflowVariableToken, { kind: 'node' }>
  targetNode: Node
  nodesById: Map<string, Node>
  edges: Edge[]
}): Pick<
  WorkflowDataFlowConsumption,
  'status' | 'message' | 'sourceNodeId' | 'sourceNodeLabel'
> {
  const sourceNode = nodesById.get(token.nodeId)
  if (!sourceNode) {
    return {
      status: 'deleted-producer',
      sourceNodeId: token.nodeId,
      message: 'Source step no longer exists.',
    }
  }
  const output = getNodeOutputVariables(sourceNode).find(
    (candidate) => candidate.path === token.path,
  )
  if (!output) {
    return {
      status: 'missing-output',
      sourceNodeId: sourceNode.id,
      sourceNodeLabel: nodeLabel(sourceNode),
      message: `${nodeLabel(sourceNode)} no longer produces ${outputPathLabel(token.path)}.`,
    }
  }
  const upstreamIds = getUpstreamNodeIds(targetNode.id, edges)
  if (sourceNode.id === targetNode.id || !upstreamIds.has(sourceNode.id)) {
    return {
      status: 'unavailable-upstream',
      sourceNodeId: sourceNode.id,
      sourceNodeLabel: nodeLabel(sourceNode),
      message: `${nodeLabel(sourceNode)} is not connected before ${nodeLabel(targetNode)}.`,
    }
  }
  return {
    status: 'valid',
    sourceNodeId: sourceNode.id,
    sourceNodeLabel: nodeLabel(sourceNode),
  }
}

function buildReachability(nodes: Node[], edges: Edge[]) {
  const outgoing = new Map<string, string[]>()
  for (const node of nodes) outgoing.set(node.id, [])
  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, [])
    outgoing.get(edge.source)?.push(edge.target)
  }
  const reachable = new Map<string, Set<string>>()
  for (const node of nodes) {
    const seen = new Set<string>()
    const pending = [...(outgoing.get(node.id) ?? [])]
    while (pending.length) {
      const current = pending.shift()
      if (!current || seen.has(current)) continue
      seen.add(current)
      pending.push(...(outgoing.get(current) ?? []))
    }
    reachable.set(node.id, seen)
  }
  return reachable
}

function canExecuteSequentially(
  first: WorkflowDataFlowVariable,
  second: WorkflowDataFlowVariable,
  reachable: Map<string, Set<string>>,
) {
  if (!first.sourceNodeId || !second.sourceNodeId) return false
  return reachable.get(first.sourceNodeId)?.has(second.sourceNodeId) ?? false
}

function overwriteMessage(
  variable: WorkflowDataFlowVariable,
  allOverwrites: WorkflowDataFlowVariable[],
) {
  const samePath = allOverwrites.filter(
    (candidate) => candidate.canonicalWritePath === variable.canonicalWritePath,
  )
  const ordered = samePath
    .filter((candidate) => candidate.sourceNodeLabel)
    .map((candidate) => candidate.sourceNodeLabel!)
  if (ordered.length >= 2) {
    return `${formatVariableReadableLabel(variable)} updated by ${ordered[0]}, then updated again by ${ordered.at(-1)}.`
  }
  return `${formatVariableReadableLabel(variable)} is updated more than once on the same workflow path.`
}

export function analyzeWorkflowData({
  nodes,
  edges,
}: {
  nodes: Node[]
  edges: Edge[]
}): WorkflowDataFlowReport {
  const graphOrder = getGraphOrder(nodes, edges)
  const orderIndex = new Map(graphOrder.map((nodeId, index) => [nodeId, index]))
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const reachable = buildReachability(nodes, edges)
  const producedVariables = nodes.flatMap((node) =>
    getNodeOutputVariables(node).map(variableFromDefinition),
  )
  const globals = workflowVariableRegistry
    .filter(
      (variable) =>
        variable.category === 'Workspace Variables' ||
        variable.category === 'Automation' ||
        variable.key.startsWith('owner.'),
    )
    .map(variableFromDefinition)
  const variablesByKey = new Map<string, WorkflowDataFlowVariable>()
  for (const variable of [...globals, ...producedVariables]) {
    variablesByKey.set(variable.key, variable)
    variablesByKey.set(variable.token, variable)
  }

  const consumedVariables: WorkflowDataFlowConsumption[] = []
  for (const node of nodes) {
    const config = (node.data as Record<string, unknown> | undefined) ?? {}
    for (const field of visibleFieldsForNode(node)) {
      if (!field.supportsVariables) continue
      const value = configValueForField(config, field)
      const tokens = findVariableTokens(value)
      for (const token of tokens) {
        const key = tokenKey(token)
        const definition =
          variablesByKey.get(key) ??
          variablesByKey.get(token.raw) ??
          getWorkflowVariableDefinition(key, [...globals, ...producedVariables])
        const validationIssue = validateVariableValueForField({
          value: token.raw,
          field,
          targetNode: node,
          nodes,
          edges,
        })[0]
        const nodeTokenState =
          token.kind === 'node'
            ? classifyNodeToken({
                token,
                targetNode: node,
                nodesById,
                edges,
              })
            : undefined
        const status: WorkflowDataFlowStatus =
          nodeTokenState && nodeTokenState.status !== 'valid'
            ? nodeTokenState.status
            : validationIssue?.status === 'incompatible'
              ? 'incompatible'
              : validationIssue?.status === 'broken-source'
                ? 'unknown-variable'
                : 'valid'
        const variableLabel = definition
          ? formatVariableReadableLabel(definition)
          : token.kind === 'node'
            ? outputPathLabel(token.path)
            : key
        const consumption: WorkflowDataFlowConsumption = {
          id: `${node.id}:${fieldKey(field)}:${token.raw}`,
          nodeId: node.id,
          nodeLabel: nodeLabel(node),
          fieldKey: fieldKey(field),
          fieldLabel: field.mappingLabel ?? field.label,
          token: token.raw,
          variableKey: definition?.key ?? key,
          variableLabel,
          variableType: definition?.type ?? 'unknown',
          sourceNodeId:
            nodeTokenState?.sourceNodeId ??
            (definition?.sourceNodeId ? definition.sourceNodeId : undefined),
          sourceNodeLabel:
            nodeTokenState?.sourceNodeLabel ??
            (definition?.sourceNodeLabel
              ? definition.sourceNodeLabel
              : undefined),
          status,
          message: nodeTokenState?.message ?? validationIssue?.message,
        }
        consumedVariables.push(consumption)
        const variable = definition
          ? variablesByKey.get(definition.key)
          : undefined
        if (variable) {
          variable.consumers.push(consumption)
        }
      }
    }
  }

  const invalidVariables = consumedVariables.filter(
    (variable) => variable.status !== 'valid',
  )
  const overwritePairs: WorkflowDataFlowVariable[] = []
  const writeTargets = producedVariables.filter(
    (variable) => variable.canonicalWritePath,
  )
  for (const first of writeTargets) {
    for (const second of writeTargets) {
      if (first.key === second.key) continue
      if (first.canonicalWritePath !== second.canonicalWritePath) continue
      if (canExecuteSequentially(first, second, reachable)) {
        overwritePairs.push(first, second)
      }
    }
  }
  const overwrittenVariables = Array.from(
    new Map(
      overwritePairs.map((variable) => [variable.key, variable]),
    ).values(),
  )
  const overwrittenKeys = new Set(
    overwrittenVariables.map((variable) => variable.key),
  )

  const finalizeVariable = (
    variable: WorkflowDataFlowVariable,
  ): WorkflowDataFlowVariable => {
    const consumers = [...variable.consumers].sort(
      (a, b) =>
        (orderIndex.get(a.nodeId) ?? Number.MAX_SAFE_INTEGER) -
        (orderIndex.get(b.nodeId) ?? Number.MAX_SAFE_INTEGER),
    )
    const invalid = invalidVariables.find(
      (item) => item.variableKey === variable.key,
    )
    return {
      ...variable,
      consumers,
      lastConsumerNodeId: consumers.at(-1)?.nodeId,
      unused: Boolean(variable.sourceNodeId) && consumers.length === 0,
      overwritten: overwrittenKeys.has(variable.key),
      overwriteSourceLabels: overwrittenVariables
        .filter(
          (candidate) =>
            candidate.canonicalWritePath &&
            candidate.canonicalWritePath === variable.canonicalWritePath,
        )
        .map(
          (candidate) =>
            candidate.sourceNodeLabel ??
            candidate.sourceNodeId ??
            'Workflow step',
        ),
      overwriteMessage: overwrittenKeys.has(variable.key)
        ? overwriteMessage(variable, overwrittenVariables)
        : undefined,
      valid: !invalid,
      invalidReason: invalid?.message,
    }
  }

  const finalizedProduced = producedVariables.map(finalizeVariable)
  const finalizedGlobals = globals.map(finalizeVariable)
  const availableVariables = [...finalizedGlobals, ...finalizedProduced]
  const producedByKey = new Map(
    finalizedProduced.map((variable) => [variable.key, variable]),
  )

  const downstreamAvailability = nodes.reduce<
    Record<string, WorkflowDataFlowVariable[]>
  >((availability, node) => {
    availability[node.id] = getAvailableVariablesForNode(node, { nodes, edges })
      .map(
        (variable) =>
          producedByKey.get(variable.key) ?? variableFromDefinition(variable),
      )
      .map(finalizeVariable)
    return availability
  }, {})
  const nodeInputs = nodes.reduce<
    Record<string, WorkflowDataFlowConsumption[]>
  >((inputs, node) => {
    inputs[node.id] = consumedVariables.filter(
      (item) => item.nodeId === node.id,
    )
    return inputs
  }, {})
  const nodeOutputs = nodes.reduce<Record<string, WorkflowDataFlowVariable[]>>(
    (outputs, node) => {
      outputs[node.id] = finalizedProduced.filter(
        (variable) => variable.sourceNodeId === node.id,
      )
      return outputs
    },
    {},
  )
  const variableLineage = availableVariables.map((variable) => ({
    variableKey: variable.key,
    label: formatVariableReadableLabel(variable),
    originNodeId: variable.sourceNodeId,
    originNodeLabel:
      variable.sourceNodeLabel ??
      (variable.sourceNodeId
        ? nodeLabel(nodesById.get(variable.sourceNodeId))
        : formatVariableSourceLabel(variable)),
    consumerNodeIds: variable.consumers.map((consumer) => consumer.nodeId),
    lastConsumerNodeId: variable.lastConsumerNodeId,
    valid: variable.valid,
    unused: variable.unused,
    overwritten: variable.overwritten,
  }))

  const orphanVariables = finalizedProduced.filter(
    (variable) => variable.unused,
  )

  return {
    availableVariables,
    producedVariables: finalizedProduced,
    consumedVariables,
    orphanVariables,
    unusedBusinessVariables: orphanVariables.filter(
      (variable) => variable.dataRole === 'business' && variable.warnWhenUnused,
    ),
    unusedRuntimeVariables: orphanVariables.filter(
      (variable) => variable.dataRole === 'runtime',
    ),
    unusedTechnicalVariables: orphanVariables.filter(
      (variable) => variable.dataRole === 'technical',
    ),
    invalidVariables,
    overwrittenVariables: finalizedProduced.filter(
      (variable) => variable.overwritten,
    ),
    downstreamAvailability,
    nodeInputs,
    nodeOutputs,
    variableLineage,
    graphOrder,
  }
}
