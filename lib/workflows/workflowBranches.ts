import type { Edge, Node } from 'reactflow'

import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import { evaluateConditionExpression } from '@/lib/workflows/branchPreviewInputs'
import {
  getNodeOutputVariables,
  type WorkflowVariableDefinition,
} from '@/lib/workflows/variableRegistry'
import type {
  WorkflowBranchMode,
  WorkflowBranchPathDefinition,
  WorkflowNodeDefinition,
} from '@/lib/workflows/types'
import type { WorkflowDataFlowReport } from '@/lib/workflows/workflowDataFlow'

export type WorkflowBranchIssue = {
  id: string
  severity: 'error' | 'warning' | 'suggestion'
  code:
    | 'branch-no-paths'
    | 'branch-path-disconnected'
    | 'branch-path-unconfigured'
    | 'branch-duplicate-path-key'
    | 'branch-duplicate-path-label'
    | 'branch-multiple-fallbacks'
    | 'branch-required-fallback-missing'
    | 'branch-empty-path'
    | 'branch-dead-path'
    | 'branch-invalid-handle'
    | 'branch-loop'
    | 'branch-immediate-rejoin'
    | 'branch-ambiguous-merge'
    | 'branch-optional-data'
    | 'branch-conflicting-data'
  nodeId?: string
  pathKey?: string
  message: string
}

export type WorkflowBranchPathStatus =
  | 'ready'
  | 'needs-condition'
  | 'needs-connection'
  | 'disabled'
  | 'fallback'
  | 'default'
  | 'selected'
  | 'skipped'
  | 'not-connected'

export type WorkflowBranchPath = {
  pathKey: string
  pathLabel: string
  sourceHandle: string
  order: number
  conditionField?: string
  conditionSummary?: string
  isDefault: boolean
  isFallback: boolean
  enabled: boolean
  connectedNodeIds: string[]
  reachableNodeIds: string[]
  terminalNodeIds: string[]
  rejoinNodeIds: string[]
  producedVariables: WorkflowVariableDefinition[]
  availableEnteringPath: WorkflowVariableDefinition[]
  status: WorkflowBranchPathStatus
  readiness: 'ready' | 'warning' | 'error'
  issues: WorkflowBranchIssue[]
}

export type WorkflowMergePoint = {
  mergeNodeId: string
  sourceBranchNodeId: string
  incomingPaths: string[]
  guaranteedVariables: WorkflowVariableDefinition[]
  optionalVariables: WorkflowVariableDefinition[]
  conflictingVariables: WorkflowVariableDefinition[]
  mergeStatus:
    | 'safe'
    | 'optional-data'
    | 'conflicting-data'
    | 'ambiguous'
    | 'unsupported'
}

export type WorkflowBranchNodeAnalysis = {
  nodeId: string
  nodeLabel: string
  registryId: string
  mode: WorkflowBranchMode
  branchRole?: WorkflowNodeDefinition['branchRole']
  paths: WorkflowBranchPath[]
  selectedPathKeys: string[]
  skippedPathKeys: string[]
  emptyPaths: string[]
  deadPaths: string[]
  overlappingPaths: string[]
  rejoiningPaths: string[]
  missingFallbackPaths: string[]
  ambiguousMerges: WorkflowMergePoint[]
  branchLocalVariables: Record<string, WorkflowVariableDefinition[]>
  variablesAvailableAfterRejoin: Record<
    string,
    {
      guaranteed: WorkflowVariableDefinition[]
      optional: WorkflowVariableDefinition[]
      conflicting: WorkflowVariableDefinition[]
    }
  >
  readiness: 'ready' | 'warning' | 'error'
  issues: WorkflowBranchIssue[]
}

export type WorkflowBranchAnalysisReport = {
  branchNodes: WorkflowBranchNodeAnalysis[]
  branchPaths: WorkflowBranchPath[]
  merges: WorkflowMergePoint[]
  issues: WorkflowBranchIssue[]
  graphReadiness: 'ready' | 'warning' | 'error'
  executionOrdering: string[]
  pathByNodeId: Record<
    string,
    {
      sourceBranchNodeId: string
      pathKey: string
      pathLabel: string
    }
  >
}

type AnalyzeWorkflowBranchesInput = {
  nodes: Node[]
  edges: Edge[]
  dataFlow?: WorkflowDataFlowReport
  previewData?: Record<string, unknown>
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
  if (!node) return 'Workflow Step'
  const label = (node.data as { label?: unknown } | undefined)?.label
  if (typeof label === 'string' && label.trim()) return label.trim()
  return (
    getWorkflowNodeDefinition(registryIdForNode(node))?.label ??
    node.type ??
    'Step'
  )
}

function pathDefinitions(
  definition: WorkflowNodeDefinition,
): WorkflowBranchPathDefinition[] {
  if (definition.branchPaths?.length) {
    return definition.branchPaths.map((path, index) => ({
      ...path,
      order: path.order ?? index,
      enabled: path.enabled ?? true,
    }))
  }
  return (definition.branchHandles ?? []).map((handle, index) => ({
    pathKey: handle,
    pathLabel: handle
      .replace(/[_-]+/g, ' ')
      .replace(/^\w/, (value) => value.toUpperCase()),
    sourceHandle: handle,
    order: index,
    enabled: true,
    required: definition.requiredBranchHandles?.includes(handle),
    isFallback: definition.fallbackPath === handle,
    isDefault: definition.defaultPath === handle,
  }))
}

function edgeMatchesPath(
  edge: Edge,
  path: WorkflowBranchPathDefinition,
  pathIndex: number,
) {
  void pathIndex
  if (!edge.sourceHandle) return false
  return (
    edge.sourceHandle === path.sourceHandle ||
    (path.handleAliases ?? []).includes(edge.sourceHandle)
  )
}

function outgoingEdgesForPath({
  path,
  pathIndex,
  allPathDefinitions,
  outgoingEdges,
}: {
  path: WorkflowBranchPathDefinition
  pathIndex: number
  allPathDefinitions: WorkflowBranchPathDefinition[]
  outgoingEdges: Edge[]
}) {
  const identifiedEdges = outgoingEdges.filter((edge) =>
    edgeMatchesPath(edge, path, pathIndex),
  )
  if (identifiedEdges.length) return identifiedEdges
  const unidentifiedEdges = outgoingEdges.filter((edge) => !edge.sourceHandle)
  const explicitlyAssignedPathIndexes = new Set(
    outgoingEdges
      .filter((edge) => edge.sourceHandle)
      .flatMap((edge) =>
        allPathDefinitions
          .map((definition, index) =>
            edgeMatchesPath(edge, definition, index) ? index : -1,
          )
          .filter((index) => index >= 0),
      ),
  )
  const unassignedPathIndexes = allPathDefinitions
    .map((_, index) => index)
    .filter((index) => !explicitlyAssignedPathIndexes.has(index))
  const unidentifiedIndex = unassignedPathIndexes.indexOf(pathIndex)
  if (unidentifiedIndex >= 0 && unidentifiedEdges[unidentifiedIndex]) {
    return [unidentifiedEdges[unidentifiedIndex]]
  }
  return []
}

function buildMaps(nodes: Node[], edges: Edge[]) {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const outgoing = new Map<string, Edge[]>()
  const incoming = new Map<string, Edge[]>()
  for (const node of nodes) {
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
  }
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    outgoing.get(edge.source)?.push(edge)
    incoming.get(edge.target)?.push(edge)
  }
  return { outgoing, incoming }
}

function reachableFrom(startNodeIds: string[], outgoing: Map<string, Edge[]>) {
  const seen = new Set<string>()
  const pending = [...startNodeIds]
  while (pending.length) {
    const current = pending.shift()
    if (!current || seen.has(current)) continue
    seen.add(current)
    for (const edge of outgoing.get(current) ?? []) {
      pending.push(edge.target)
    }
  }
  return seen
}

function topologicalOrder(nodes: Node[], edges: Edge[]) {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const incomingCount = new Map(nodes.map((node) => [node.id, 0]))
  const outgoing = new Map<string, string[]>()
  for (const node of nodes) outgoing.set(node.id, [])
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1)
    outgoing.get(edge.source)?.push(edge.target)
  }
  const queue = nodes
    .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
    .sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0))
    .map((node) => node.id)
  const order: string[] = []
  while (queue.length) {
    const nodeId = queue.shift()
    if (!nodeId || order.includes(nodeId)) continue
    order.push(nodeId)
    for (const target of outgoing.get(nodeId) ?? []) {
      incomingCount.set(
        target,
        Math.max(0, (incomingCount.get(target) ?? 0) - 1),
      )
      if ((incomingCount.get(target) ?? 0) === 0) queue.push(target)
    }
  }
  for (const node of nodes) {
    if (!order.includes(node.id)) order.push(node.id)
  }
  return order
}

function configValue(node: Node, fieldKey?: string) {
  if (!fieldKey) return ''
  const data = (node.data ?? {}) as Record<string, unknown>
  return data[fieldKey] ?? ''
}

function conditionSummary(node: Node, path: WorkflowBranchPathDefinition) {
  const raw = String(configValue(node, path.conditionField) ?? '').trim()
  if (!raw) {
    if (path.isFallback) return 'Fallback when no other path matches'
    return ''
  }
  return raw.replace(
    /\{\{\s*([^{}]+?)\s*\}\}/g,
    (_, key: string) =>
      key
        .split('.')
        .at(-1)
        ?.replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^\w/, (value: string) => value.toUpperCase()) ?? key,
  )
}

function pathMatches(
  node: Node,
  path: WorkflowBranchPathDefinition,
  previewData?: Record<string, unknown>,
) {
  if (path.isFallback) return false
  const raw = configValue(node, path.conditionField)
  const summary = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!summary) return true
  if (summary === 'false') return false
  if (summary === 'true') return true
  return evaluateConditionExpression(raw, previewData).matched
}

function selectedPathKeys({
  mode,
  paths,
  node,
  previewData,
}: {
  mode: WorkflowBranchMode
  paths: WorkflowBranchPath[]
  node: Node
  previewData?: Record<string, unknown>
}) {
  const connected = paths.filter(
    (path) => path.connectedNodeIds.length > 0 && path.enabled,
  )
  if (mode === 'parallel') return connected.map((path) => path.pathKey)
  const matching = connected.filter((path) =>
    pathMatches(node, path, previewData),
  )
  if (mode === 'multi-match') {
    return matching.length
      ? matching.filter((path) => !path.isFallback).map((path) => path.pathKey)
      : connected.filter((path) => path.isFallback).map((path) => path.pathKey)
  }
  const primary = matching.find((path) => !path.isFallback)
  if (primary) return [primary.pathKey]
  const fallback =
    connected.find((path) => path.isFallback) ??
    connected.find((path) => path.isDefault)
  return fallback ? [fallback.pathKey] : []
}

function variablesForNodeIds(nodeIds: string[], nodeMap: Map<string, Node>) {
  return nodeIds.flatMap((nodeId) => {
    const node = nodeMap.get(nodeId)
    return node ? getNodeOutputVariables(node) : []
  })
}

function computeMergeVariables(
  paths: WorkflowBranchPath[],
  mergeNodeId: string,
  incomingPathKeys: string[],
) {
  const incomingPaths = paths.filter((path) =>
    incomingPathKeys.includes(path.pathKey),
  )
  const byPath = incomingPaths.map((path) => ({
    pathKey: path.pathKey,
    variables: path.producedVariables,
  }))
  const allKeys = new Set(
    byPath.flatMap((path) => path.variables.map((variable) => variable.path)),
  )
  const guaranteed: WorkflowVariableDefinition[] = []
  const optional: WorkflowVariableDefinition[] = []
  const conflicting: WorkflowVariableDefinition[] = []
  for (const pathKey of allKeys) {
    const present = byPath
      .map((path) =>
        path.variables.find((variable) => variable.path === pathKey),
      )
      .filter((variable): variable is WorkflowVariableDefinition =>
        Boolean(variable),
      )
    if (!present.length) continue
    const typeCount = new Set(present.map((variable) => variable.type)).size
    if (typeCount > 1) {
      conflicting.push(...present)
    } else if (present.length === byPath.length) {
      guaranteed.push(present[0])
    } else {
      optional.push(present[0])
    }
  }
  return { guaranteed, optional, conflicting }
}

function issue(input: WorkflowBranchIssue): WorkflowBranchIssue {
  return input
}

export function analyzeWorkflowBranches({
  nodes,
  edges,
  dataFlow,
  previewData,
}: AnalyzeWorkflowBranchesInput): WorkflowBranchAnalysisReport {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const { outgoing, incoming } = buildMaps(nodes, edges)
  const executionOrdering = topologicalOrder(nodes, edges)
  const branchNodes: WorkflowBranchNodeAnalysis[] = []
  const pathByNodeId: WorkflowBranchAnalysisReport['pathByNodeId'] = {}

  for (const node of nodes) {
    const definition = getWorkflowNodeDefinition(registryIdForNode(node))
    if (!definition?.branchMode && !definition?.branchHandles?.length) continue
    const mode = definition.branchMode ?? 'exclusive'
    const definitions = pathDefinitions(definition)
    const nodeIssues: WorkflowBranchIssue[] = []
    const pathKeyCounts = new Map<string, number>()
    const pathLabelCounts = new Map<string, number>()
    for (const path of definitions) {
      pathKeyCounts.set(
        path.pathKey,
        (pathKeyCounts.get(path.pathKey) ?? 0) + 1,
      )
      pathLabelCounts.set(
        path.pathLabel.toLowerCase(),
        (pathLabelCounts.get(path.pathLabel.toLowerCase()) ?? 0) + 1,
      )
    }
    for (const [key, count] of pathKeyCounts) {
      if (count > 1) {
        nodeIssues.push(
          issue({
            id: `branch:${node.id}:duplicate-key:${key}`,
            severity: 'error',
            code: 'branch-duplicate-path-key',
            nodeId: node.id,
            pathKey: key,
            message: `Duplicate branch path key "${key}".`,
          }),
        )
      }
    }
    for (const [label, count] of pathLabelCounts) {
      if (count > 1) {
        nodeIssues.push(
          issue({
            id: `branch:${node.id}:duplicate-label:${label}`,
            severity: 'warning',
            code: 'branch-duplicate-path-label',
            nodeId: node.id,
            message: `Duplicate branch path label "${label}".`,
          }),
        )
      }
    }
    const fallbackCount = definitions.filter((path) => path.isFallback).length
    if (fallbackCount > 1) {
      nodeIssues.push(
        issue({
          id: `branch:${node.id}:multiple-fallbacks`,
          severity: 'error',
          code: 'branch-multiple-fallbacks',
          nodeId: node.id,
          message: `${nodeLabel(node)} has more than one fallback path.`,
        }),
      )
    }
    if (
      definition.fallbackPath &&
      !definitions.some((path) => path.pathKey === definition.fallbackPath)
    ) {
      nodeIssues.push(
        issue({
          id: `branch:${node.id}:fallback-missing`,
          severity: 'error',
          code: 'branch-required-fallback-missing',
          nodeId: node.id,
          message: `${nodeLabel(node)} requires a fallback path.`,
        }),
      )
    }
    if (!definitions.length) {
      nodeIssues.push(
        issue({
          id: `branch:${node.id}:no-paths`,
          severity: 'error',
          code: 'branch-no-paths',
          nodeId: node.id,
          message: `${nodeLabel(node)} has no configured paths.`,
        }),
      )
    }

    const paths: WorkflowBranchPath[] = definitions
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((path, index) => {
        const pathEdges = outgoingEdgesForPath({
          path,
          pathIndex: index,
          allPathDefinitions: definitions,
          outgoingEdges: outgoing.get(node.id) ?? [],
        })
        const connectedNodeIds = pathEdges.map((edge) => edge.target)
        const reachable = reachableFrom(connectedNodeIds, outgoing)
        const allReachable = Array.from(reachable)
        const terminalNodeIds = allReachable.filter(
          (nodeId) => (outgoing.get(nodeId) ?? []).length === 0,
        )
        const producedVariables = variablesForNodeIds(allReachable, nodeMap)
        const pathIssues: WorkflowBranchIssue[] = []
        const summary = conditionSummary(node, path)
        if (path.enabled === false) {
          // no-op
        } else if (!connectedNodeIds.length) {
          pathIssues.push(
            issue({
              id: `branch:${node.id}:${path.pathKey}:disconnected`,
              severity: path.required ? 'error' : 'warning',
              code: 'branch-path-disconnected',
              nodeId: node.id,
              pathKey: path.pathKey,
              message: `${nodeLabel(node)}: The ${path.pathLabel} path is not connected.`,
            }),
          )
        }
        const pathRequiresRule =
          definition.requiresConfiguredBranch &&
          Boolean(path.conditionField) &&
          !path.isFallback
        if (pathRequiresRule && !summary) {
          pathIssues.push(
            issue({
              id: `branch:${node.id}:${path.pathKey}:unconfigured`,
              severity: path.required ? 'error' : 'warning',
              code: 'branch-path-unconfigured',
              nodeId: node.id,
              pathKey: path.pathKey,
              message: `${path.pathLabel} path needs a rule.`,
            }),
          )
        }
        if (pathEdges.some((edge) => edge.target === node.id)) {
          pathIssues.push(
            issue({
              id: `branch:${node.id}:${path.pathKey}:loop`,
              severity: 'error',
              code: 'branch-loop',
              nodeId: node.id,
              pathKey: path.pathKey,
              message: `${path.pathLabel} path loops back into ${nodeLabel(node)}.`,
            }),
          )
        }
        const status: WorkflowBranchPathStatus =
          path.enabled === false
            ? 'disabled'
            : path.isFallback
              ? 'fallback'
              : path.isDefault
                ? 'default'
                : !connectedNodeIds.length
                  ? 'needs-connection'
                  : pathRequiresRule && !summary
                    ? 'needs-condition'
                    : 'ready'
        for (const reachableNodeId of allReachable) {
          pathByNodeId[reachableNodeId] = {
            sourceBranchNodeId: node.id,
            pathKey: path.pathKey,
            pathLabel: path.pathLabel,
          }
        }
        return {
          pathKey: path.pathKey,
          pathLabel: path.pathLabel,
          sourceHandle: path.sourceHandle,
          order: path.order ?? index,
          conditionField: path.conditionField,
          conditionSummary: summary,
          isDefault: Boolean(
            path.isDefault || definition.defaultPath === path.pathKey,
          ),
          isFallback: Boolean(
            path.isFallback || definition.fallbackPath === path.pathKey,
          ),
          enabled: path.enabled !== false,
          connectedNodeIds,
          reachableNodeIds: allReachable,
          terminalNodeIds,
          rejoinNodeIds: [],
          producedVariables,
          availableEnteringPath:
            dataFlow?.downstreamAvailability[node.id] ?? [],
          status,
          readiness: pathIssues.some((item) => item.severity === 'error')
            ? 'error'
            : pathIssues.length
              ? 'warning'
              : 'ready',
          issues: pathIssues,
        }
      })

    const mergeNodes = new Map<string, string[]>()
    for (const path of paths) {
      for (const nodeId of path.reachableNodeIds) {
        const pathKeys = mergeNodes.get(nodeId) ?? []
        if (!pathKeys.includes(path.pathKey)) pathKeys.push(path.pathKey)
        mergeNodes.set(nodeId, pathKeys)
      }
    }
    const mergePoints: WorkflowMergePoint[] = []
    for (const [mergeNodeId, incomingPaths] of mergeNodes) {
      if (incomingPaths.length < 2) continue
      const variables = computeMergeVariables(paths, mergeNodeId, incomingPaths)
      const mergeStatus: WorkflowMergePoint['mergeStatus'] = variables
        .conflicting.length
        ? 'conflicting-data'
        : variables.optional.length
          ? 'optional-data'
          : 'safe'
      mergePoints.push({
        mergeNodeId,
        sourceBranchNodeId: node.id,
        incomingPaths,
        guaranteedVariables: variables.guaranteed,
        optionalVariables: variables.optional,
        conflictingVariables: variables.conflicting,
        mergeStatus,
      })
      for (const path of paths) {
        if (incomingPaths.includes(path.pathKey)) {
          path.rejoinNodeIds.push(mergeNodeId)
          if (path.connectedNodeIds.includes(mergeNodeId)) {
            path.issues.push(
              issue({
                id: `branch:${node.id}:${path.pathKey}:immediate-rejoin:${mergeNodeId}`,
                severity: 'warning',
                code: 'branch-immediate-rejoin',
                nodeId: node.id,
                pathKey: path.pathKey,
                message: `${path.pathLabel} rejoins before doing any work.`,
              }),
            )
          }
        }
      }
      if (mergeStatus === 'optional-data') {
        nodeIssues.push(
          issue({
            id: `branch:${node.id}:merge:${mergeNodeId}:optional-data`,
            severity: 'warning',
            code: 'branch-optional-data',
            nodeId: node.id,
            message: `${nodeLabel(nodeMap.get(mergeNodeId))} receives path-specific data that may not exist on every path.`,
          }),
        )
      }
      if (mergeStatus === 'conflicting-data') {
        nodeIssues.push(
          issue({
            id: `branch:${node.id}:merge:${mergeNodeId}:conflicting-data`,
            severity: 'warning',
            code: 'branch-conflicting-data',
            nodeId: node.id,
            message: `${nodeLabel(nodeMap.get(mergeNodeId))} receives conflicting branch data.`,
          }),
        )
      }
    }

    const selected = selectedPathKeys({ mode, paths, node, previewData })
    const skipped = paths
      .filter(
        (path) =>
          path.connectedNodeIds.length > 0 && !selected.includes(path.pathKey),
      )
      .map((path) => path.pathKey)
    const allIssues = [...nodeIssues, ...paths.flatMap((path) => path.issues)]
    const branchLocalVariables = Object.fromEntries(
      paths.map((path) => [path.pathKey, path.producedVariables]),
    )
    const variablesAvailableAfterRejoin = Object.fromEntries(
      mergePoints.map((merge) => [
        merge.mergeNodeId,
        {
          guaranteed: merge.guaranteedVariables,
          optional: merge.optionalVariables,
          conflicting: merge.conflictingVariables,
        },
      ]),
    )
    branchNodes.push({
      nodeId: node.id,
      nodeLabel: nodeLabel(node),
      registryId: definition.id,
      mode,
      branchRole: definition.branchRole,
      paths,
      selectedPathKeys: selected,
      skippedPathKeys: skipped,
      emptyPaths: paths
        .filter((path) => !path.connectedNodeIds.length)
        .map((path) => path.pathKey),
      deadPaths: paths
        .filter(
          (path) =>
            path.connectedNodeIds.length > 0 && !path.terminalNodeIds.length,
        )
        .map((path) => path.pathKey),
      overlappingPaths: Array.from(mergeNodes.entries())
        .filter(([, pathKeys]) => pathKeys.length > 1)
        .flatMap(([, pathKeys]) => pathKeys),
      rejoiningPaths: paths
        .filter((path) => path.rejoinNodeIds.length)
        .map((path) => path.pathKey),
      missingFallbackPaths:
        definition.fallbackPath && !paths.some((path) => path.isFallback)
          ? [definition.fallbackPath]
          : [],
      ambiguousMerges: mergePoints.filter(
        (merge) => merge.mergeStatus === 'ambiguous',
      ),
      branchLocalVariables,
      variablesAvailableAfterRejoin,
      readiness: allIssues.some((item) => item.severity === 'error')
        ? 'error'
        : allIssues.length
          ? 'warning'
          : 'ready',
      issues: allIssues,
    })
  }

  const issues = branchNodes.flatMap((branch) => branch.issues)
  const merges = branchNodes.flatMap((branch) =>
    Object.entries(branch.variablesAvailableAfterRejoin).map(
      ([mergeNodeId, variables]) => ({
        mergeNodeId,
        sourceBranchNodeId: branch.nodeId,
        incomingPaths: branch.paths
          .filter((path) => path.rejoinNodeIds.includes(mergeNodeId))
          .map((path) => path.pathKey),
        guaranteedVariables: variables.guaranteed,
        optionalVariables: variables.optional,
        conflictingVariables: variables.conflicting,
        mergeStatus: variables.conflicting.length
          ? ('conflicting-data' as const)
          : variables.optional.length
            ? ('optional-data' as const)
            : ('safe' as const),
      }),
    ),
  )

  return {
    branchNodes,
    branchPaths: branchNodes.flatMap((branch) => branch.paths),
    merges,
    issues: Array.from(new Map(issues.map((item) => [item.id, item])).values()),
    graphReadiness: issues.some((item) => item.severity === 'error')
      ? 'error'
      : issues.length
        ? 'warning'
        : 'ready',
    executionOrdering,
    pathByNodeId,
  }
}
