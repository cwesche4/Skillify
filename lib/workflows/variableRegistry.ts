import type { Edge, Node } from 'reactflow'

import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import { schedulingVariableDefinitions } from '@/lib/workflows/schedulingRegistry'
import type { WorkflowPort, WorkflowValueType } from '@/lib/workflows/types'
import {
  buildNodeVariableToken,
  buildWorkspaceVariableToken,
  findVariableTokens,
  parseVariableToken,
  type WorkflowVariableToken,
} from '@/lib/workflows/variableTokens'

export type WorkflowVariableType = Exclude<WorkflowValueType, 'any'>

export type WorkflowVariableCategory =
  | 'Scheduling'
  | 'CRM'
  | 'Lead'
  | 'Opportunity'
  | 'Client'
  | 'Task'
  | 'Service Request'
  | 'Automation'
  | 'Workspace Variables'
  | 'Custom Variables'

export type WorkflowVariableDefinition = {
  id: string
  key: string
  path: string
  token: string
  label: string
  category: WorkflowVariableCategory
  group?: string
  type: WorkflowVariableType
  valueType: WorkflowVariableType
  description?: string
  previewValue: unknown
  sampleValue: unknown
  nullable?: boolean
  itemType?: WorkflowVariableType
  sourceNodeId?: string
  sourceNodeType?: string
  sourceNodeLabel?: string
  origin?: string
  direction?: 'input' | 'output'
  dataRole?: WorkflowPort['dataRole']
  warnWhenUnused?: boolean
  importance?: WorkflowPort['importance']
  namespace?: string
  writePath?: string
}

export type WorkflowVariableReference = {
  raw: string
  key: string
  token?: WorkflowVariableToken
  definition?: WorkflowVariableDefinition
  status?: 'resolved' | 'broken'
  message?: string
}

const variable = (
  category: WorkflowVariableCategory,
  key: string,
  label: string,
  type: WorkflowVariableType,
  previewValue: unknown,
  description?: string,
): WorkflowVariableDefinition => ({
  id: key,
  key,
  path: key,
  token: key.startsWith('workspace.')
    ? buildWorkspaceVariableToken(key.slice('workspace.'.length))
    : `{{${key}}}`,
  label: friendlyRegistryLabel({ category, key, label }),
  category,
  group: category,
  type,
  valueType: type,
  previewValue,
  sampleValue: previewValue,
  description,
})

function friendlyRegistryLabel({
  category,
  key,
  label,
}: {
  category: WorkflowVariableCategory
  key: string
  label: string
}) {
  const trimmed = businessVariableLabel(label.trim())
  const lower = trimmed.toLowerCase()
  const prefix =
    category === 'Lead'
      ? 'Lead'
      : category === 'Client'
        ? 'Client'
        : category === 'Workspace Variables'
          ? 'Workspace'
          : category === 'Service Request'
            ? 'Service Request'
            : key.startsWith('contact.')
              ? 'Contact'
              : key.startsWith('owner.')
                ? 'Owner'
                : ''

  if (!prefix) return trimmed
  if (lower.startsWith(prefix.toLowerCase())) return trimmed
  if (
    ['email', 'phone', 'name', 'address', 'status', 'id', 'website'].includes(
      lower,
    )
  ) {
    return `${prefix} ${lower === 'id' ? 'ID' : trimmed}`
  }
  return trimmed
}

export const workflowVariableRegistry: WorkflowVariableDefinition[] = [
  ...schedulingVariableDefinitions.map(
    ([category, key, label, type, previewValue, description]) =>
      variable(category, key, label, type, previewValue, description),
  ),
  variable('CRM', 'crm.record_id', 'CRM Record ID', 'string', 'crm_12345'),
  variable('CRM', 'crm.owner', 'CRM Owner', 'string', 'Sam Rivera'),
  variable('Lead', 'lead.name', 'Lead Name', 'string', 'NorthStar Electric'),
  variable('Lead', 'lead.first_name', 'Lead First Name', 'string', 'Jordan'),
  variable('Lead', 'lead.company', 'Company', 'string', 'NorthStar Electric'),
  variable('Lead', 'lead.email', 'Email', 'email', 'owner@northstar.com'),
  variable('Lead', 'lead.phone', 'Phone', 'phone', '555-555-5555'),
  variable('Lead', 'lead.source', 'Source', 'string', 'Website Form'),
  variable('Lead', 'lead.value', 'Value', 'number', 12500),
  variable('Lead', 'lead.id', 'Lead ID', 'string', 'lead_987'),
  variable('Opportunity', 'opportunity.stage', 'Stage', 'string', 'Qualified'),
  variable('Opportunity', 'opportunity.owner', 'Owner', 'string', 'Avery Chen'),
  variable(
    'Opportunity',
    'opportunity.probability',
    'Probability',
    'number',
    72,
  ),
  variable('Opportunity', 'opportunity.revenue', 'Revenue', 'number', 42000),
  variable('Client', 'client.name', 'Name', 'string', 'NorthStar Electric'),
  variable('Client', 'client.id', 'Client ID', 'string', 'client_123'),
  variable('Client', 'client.first_name', 'First Name', 'string', 'Jordan'),
  variable('Client', 'client.email', 'Email', 'email', 'owner@northstar.com'),
  variable('Client', 'client.phone', 'Phone', 'phone', '555-555-5555'),
  variable('Client', 'client.health', 'Health', 'string', 'Healthy'),
  variable(
    'Client',
    'client.assigned_tech',
    'Assigned Tech',
    'string',
    'Mina Patel',
  ),
  variable('Client', 'client.tags', 'Tags', 'array', ['VIP', 'Commercial']),
  variable(
    'Task',
    'task.due_date',
    'Due Date',
    'datetime',
    '2026-07-10T14:00:00Z',
  ),
  variable('Task', 'task.assignee', 'Assignee', 'string', 'Avery Chen'),
  variable('Task', 'task.priority', 'Priority', 'string', 'High'),
  variable('CRM', 'contact.name', 'Contact Name', 'string', 'Jordan Lee'),
  variable(
    'CRM',
    'contact.email',
    'Contact Email',
    'email',
    'contact@example.com',
  ),
  variable('CRM', 'contact.phone', 'Contact Phone', 'phone', '555-555-0123'),
  variable('Workspace Variables', 'owner.id', 'Owner', 'string', 'user_owner'),
  variable(
    'CRM',
    'owner.email',
    'Owner Email',
    'email',
    'owner@skillify.local',
  ),
  variable('Workspace Variables', 'team.ops', 'Ops Team', 'string', 'team_ops'),
  variable(
    'Workspace Variables',
    'team.support',
    'Support Team',
    'string',
    'team_support',
  ),
  variable(
    'Workspace Variables',
    'skillify.ai',
    'Skillify AI',
    'string',
    'skillify_ai',
  ),
  variable(
    'Service Request',
    'service_request.id',
    'Request ID',
    'string',
    'sr_4421',
  ),
  variable(
    'Service Request',
    'service_request.customer',
    'Customer',
    'string',
    'NorthStar Electric',
  ),
  variable(
    'Service Request',
    'service_request.email',
    'Customer Email',
    'email',
    'customer@example.com',
  ),
  variable(
    'Service Request',
    'service_request.phone',
    'Customer Phone',
    'phone',
    '+1 555 555 0144',
  ),
  variable(
    'Service Request',
    'service_request.address',
    'Address',
    'string',
    '1200 Market St',
  ),
  variable(
    'Service Request',
    'service_request.equipment',
    'Equipment',
    'string',
    'Panel A',
  ),
  variable(
    'Automation',
    'automation.run_id',
    'Run ID',
    'string',
    'run_preview_001',
  ),
  variable(
    'Automation',
    'automation.current_time',
    'Current Time',
    'datetime',
    '2026-07-08T12:00:00Z',
  ),
  variable(
    'Automation',
    'automation.workspace',
    'Workspace',
    'string',
    'Skillify Demo',
  ),
  variable(
    'Workspace Variables',
    'workspace.name',
    'Workspace Name',
    'string',
    'Skillify Demo',
  ),
  variable(
    'Workspace Variables',
    'workspace.slug',
    'Workspace Slug',
    'string',
    'demo-workspace',
  ),
  variable(
    'Workspace Variables',
    'workspace.email',
    'Workspace Email',
    'email',
    'workspace@example.com',
  ),
  variable(
    'Workspace Variables',
    'workspace.timezone',
    'Timezone',
    'string',
    'America/New_York',
  ),
  variable(
    'Workspace Variables',
    'workspace.supportEmail',
    'Support Email',
    'email',
    'support@example.com',
  ),
  variable(
    'Workspace Variables',
    'workspace.ownerName',
    'Owner Name',
    'string',
    'Avery Chen',
  ),
  variable(
    'Workspace Variables',
    'workspace.phone',
    'Phone',
    'phone',
    '+1 555 555 0100',
  ),
  variable(
    'Workspace Variables',
    'workspace.website',
    'Website',
    'url',
    'https://example.com',
  ),
  variable(
    'Workspace Variables',
    'workspace.address',
    'Address',
    'string',
    'Preview address',
  ),
  variable(
    'Custom Variables',
    'custom.note',
    'Custom Note',
    'string',
    'Follow up next week',
  ),
]

const previewValueForType = (type: WorkflowVariableType, label: string) => {
  if (type === 'number') return 42
  if (type === 'boolean') return true
  if (type === 'array') return []
  if (type === 'object') return { preview: true }
  if (type === 'email') return 'john@example.com'
  if (type === 'phone') return '+1 555 555 5555'
  if (type === 'url') return 'https://example.com'
  if (type === 'date') return '2026-07-10'
  if (type === 'datetime') return '2026-07-10T14:00:00Z'
  if (type === 'duration') return '30 minutes'
  return `${label} preview`
}

function registryIdForNode(node: Node) {
  const registryNodeId = (
    node.data as { __registryNodeId?: unknown } | undefined
  )?.__registryNodeId
  return typeof registryNodeId === 'string'
    ? registryNodeId
    : (node.type ?? 'unknown')
}

function normalizeValueType(
  dataType: WorkflowPort['dataType'],
): WorkflowVariableType {
  if (dataType === 'any') return 'unknown'
  return dataType
}

function nodeLabel(node: Node) {
  return typeof (node.data as { label?: unknown } | undefined)?.label ===
    'string'
    ? String((node.data as { label?: string }).label)
    : (node.type ?? 'Node')
}

function businessVariableLabel(label: string) {
  return label
    .replace(/^send\s+id$/i, 'Message ID')
    .replace(/^message\s+status$/i, 'Delivery Status')
    .replace(/^sent\s+at$/i, 'Sent Time')
    .replace(/^lead\s+id$/i, 'Lead Record ID')
    .replace(/^record\s+id$/i, 'Lead Record ID')
    .replace(/^record\s+name$/i, 'Lead Name')
    .replace(/^record\s+email$/i, 'Lead Email')
    .replace(/^record\s+phone$/i, 'Lead Phone')
    .replace(/^record\s+status$/i, 'Lead Status')
    .replace(/\bid\b/g, 'ID')
    .replace(/\bemail\b/gi, 'Email')
    .replace(/\bphone\b/gi, 'Phone')
    .replace(/\bname\b/gi, 'Name')
    .replace(/\bcompany\b/gi, 'Company')
    .replace(/\bstatus\b/gi, 'Status')
    .replace(/\btime\b/gi, 'Time')
    .replace(/\bat\b/gi, 'At')
}

function readablePathLabel(
  path: string,
  fallback: string,
  sourceLabel: string,
) {
  const explicitLabel = businessVariableLabel(fallback.trim())
  if (explicitLabel && explicitLabel !== fallback.trim()) {
    return explicitLabel
  }
  const lastPart = path.split('.').at(-1) ?? fallback
  const normalizedLast = lastPart
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
  const sourcePrefix = sourceLabel
    .replace(/\b(created|changed|completed|submitted|trigger|logged)\b/gi, '')
    .trim()
  const simplePrefix =
    sourcePrefix.split(/\s+/)[0] || sourceLabel.split(/\s+/)[0] || ''
  const simpleLabel = normalizedLast
    ? normalizedLast.replace(/\b(id)\b/gi, 'ID')
    : fallback
  if (
    !simplePrefix ||
    simpleLabel.toLowerCase().startsWith(simplePrefix.toLowerCase())
  ) {
    return businessVariableLabel(simpleLabel)
      .replace(/\brecord\s+/i, '')
      .replace(/\brecipient\s+/i, 'Recipient ')
      .replace(/\bfull name\b/i, 'Name')
  }
  return businessVariableLabel(`${simplePrefix} ${simpleLabel}`)
    .replace(/\brecord\s+/i, '')
    .replace(/\bfull name\b/i, 'Name')
}

function portToVariable(
  port: WorkflowPort,
  node: Node,
  direction: 'input' | 'output',
): WorkflowVariableDefinition {
  const type = normalizeValueType(port.dataType)
  const sourceLabel = nodeLabel(node)
  const label = readablePathLabel(port.id, port.label || port.id, sourceLabel)
  const path = port.id
  const token = buildNodeVariableToken(node.id, path)
  return {
    id: `nodes.${node.id}.${path}`,
    key: `nodes.${node.id}.${path}`,
    path,
    token,
    label,
    category: 'Custom Variables',
    group: sourceLabel,
    type,
    valueType: type,
    previewValue: port.sampleValue ?? previewValueForType(type, label),
    sampleValue: port.sampleValue ?? previewValueForType(type, label),
    nullable: port.nullable,
    itemType: port.itemType === 'any' ? 'unknown' : port.itemType,
    description: port.description,
    sourceNodeId: node.id,
    sourceNodeType: registryIdForNode(node),
    sourceNodeLabel: sourceLabel,
    origin: sourceLabel,
    direction,
    dataRole: port.dataRole,
    warnWhenUnused: port.warnWhenUnused,
    importance: port.importance,
    namespace: port.namespace,
    writePath: port.writePath,
  }
}

export function formatVariableToken(key: string) {
  if (key.startsWith('{{')) return key
  if (key.startsWith('nodes.')) return `{{${key}}}`
  if (key.startsWith('workspace.')) {
    return buildWorkspaceVariableToken(key.slice('workspace.'.length))
  }
  return `{{${key}}}`
}

export function getWorkflowVariableDefinition(
  key: string,
  variables: WorkflowVariableDefinition[] = workflowVariableRegistry,
) {
  const token = parseVariableToken(key.startsWith('{{') ? key : `{{${key}}}`)
  const normalizedKey =
    token?.kind === 'node'
      ? `nodes.${token.nodeId}.${token.path}`
      : token?.kind === 'workspace'
        ? `workspace.${token.path}`
        : (token?.path ?? key)
  return variables.find(
    (item) =>
      item.key === normalizedKey ||
      item.path === normalizedKey ||
      item.token === key ||
      item.token === `{{${key}}}`,
  )
}

export function searchWorkflowVariables(
  query: string,
  variables: WorkflowVariableDefinition[] = workflowVariableRegistry,
) {
  const q = query.trim().toLowerCase()
  if (!q) return variables
  return variables.filter((item) =>
    [
      item.key,
      item.path,
      item.label,
      item.group,
      item.category,
      item.type,
      item.description,
      item.sourceNodeLabel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
}

export function extractVariableReferences(
  value: unknown,
  variables: WorkflowVariableDefinition[] = workflowVariableRegistry,
): WorkflowVariableReference[] {
  return findVariableTokens(value).map((token) => {
    const key =
      token.kind === 'node'
        ? `nodes.${token.nodeId}.${token.path}`
        : token.kind === 'workspace'
          ? `workspace.${token.path}`
          : token.path
    const definition =
      getWorkflowVariableDefinition(key, variables) ??
      (token.kind === 'node'
        ? undefined
        : getWorkflowVariableDefinition(key, workflowVariableRegistry))
    const fallbackMessage =
      token.kind === 'node'
        ? 'Variable source no longer exists'
        : 'This variable is not available in the current workflow.'
    return {
      raw: token.raw,
      key,
      token,
      definition,
      status: definition ? 'resolved' : 'broken',
      message: definition ? undefined : fallbackMessage,
    }
  })
}

export function getNodeInputVariables(node: Node) {
  const definition = getWorkflowNodeDefinition(registryIdForNode(node))
  return (definition?.inputs ?? []).map((port) =>
    portToVariable(port, node, 'input'),
  )
}

export function getNodeOutputVariables(node: Node) {
  const definition = getWorkflowNodeDefinition(registryIdForNode(node))
  return (definition?.outputs ?? []).map((port) =>
    portToVariable(port, node, 'output'),
  )
}

export function getUpstreamNodeIds(nodeId: string, edges: Edge[]) {
  const upstream = new Set<string>()
  const pending = edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => edge.source)
  while (pending.length) {
    const current = pending.shift()
    if (!current || upstream.has(current)) continue
    upstream.add(current)
    for (const edge of edges) {
      if (edge.target === current && !upstream.has(edge.source)) {
        pending.push(edge.source)
      }
    }
  }
  return upstream
}

export function isVariableAvailableToNode({
  variable,
  nodeId,
  edges,
}: {
  variable: WorkflowVariableDefinition
  nodeId: string
  edges: Edge[]
}) {
  if (!variable.sourceNodeId) return true
  if (variable.sourceNodeId === nodeId) return false
  return getUpstreamNodeIds(nodeId, edges).has(variable.sourceNodeId)
}

export function getAvailableVariablesForNode(
  node?: Node | null,
  graph?: { nodes: Node[]; edges: Edge[] },
) {
  const workspaceVariables = workflowVariableRegistry.filter(
    (variable) =>
      variable.category === 'Workspace Variables' ||
      variable.category === 'Automation' ||
      variable.key.startsWith('owner.'),
  )
  if (!node || !graph) {
    return disambiguateVariableLabels([
      ...workflowVariableRegistry,
      ...(node ? getNodeOutputVariables(node) : []),
    ])
  }
  const upstreamIds = getUpstreamNodeIds(node.id, graph.edges)
  const upstreamVariables = graph.nodes
    .filter((candidate) => upstreamIds.has(candidate.id))
    .flatMap((candidate) => getNodeOutputVariables(candidate))
  return disambiguateVariableLabels([
    ...workspaceVariables,
    ...upstreamVariables,
  ])
}

export function formatVariableReadableLabel(
  variable: WorkflowVariableDefinition,
) {
  return variable.label
}

export function formatVariableSourceLabel(
  variable: WorkflowVariableDefinition,
) {
  if (variable.sourceNodeLabel) return variable.sourceNodeLabel
  if (variable.category === 'Workspace Variables') return 'Workspace'
  if (variable.category === 'Automation') return 'Workflow'
  if (variable.category === 'CRM') return 'CRM'
  if (variable.category === 'Custom Variables') return 'Custom'
  return variable.category
}

function disambiguateVariableLabels(
  variables: WorkflowVariableDefinition[],
): WorkflowVariableDefinition[] {
  const labelCounts = variables.reduce<Record<string, number>>(
    (counts, variable) => {
      const key = variable.label.trim().toLowerCase()
      counts[key] = (counts[key] ?? 0) + 1
      return counts
    },
    {},
  )
  const sourceCountsByLabel = variables.reduce<
    Record<string, Record<string, number>>
  >((counts, variable) => {
    const labelKey = variable.label.trim().toLowerCase()
    const source = formatVariableSourceLabel(variable)
    counts[labelKey] = counts[labelKey] ?? {}
    counts[labelKey][source] = (counts[labelKey][source] ?? 0) + 1
    return counts
  }, {})
  const sourceSeenByLabel: Record<string, Record<string, number>> = {}

  return variables.map((variable) => {
    const labelKey = variable.label.trim().toLowerCase()
    if ((labelCounts[labelKey] ?? 0) <= 1) return variable

    const source = formatVariableSourceLabel(variable)
    const duplicateSourceCount = sourceCountsByLabel[labelKey]?.[source] ?? 0
    sourceSeenByLabel[labelKey] = sourceSeenByLabel[labelKey] ?? {}
    sourceSeenByLabel[labelKey][source] =
      (sourceSeenByLabel[labelKey][source] ?? 0) + 1
    const sourceLabel =
      duplicateSourceCount > 1
        ? `${source} ${sourceSeenByLabel[labelKey][source]}`
        : source

    return {
      ...variable,
      label: `${variable.label} (${sourceLabel})`,
    }
  })
}

export function resolveVariablePreviewText(
  value: unknown,
  variables: WorkflowVariableDefinition[] = workflowVariableRegistry,
) {
  if (typeof value !== 'string') return value
  return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (raw) => {
    const reference = extractVariableReferences(raw, variables)[0]
    if (!reference?.definition) return raw
    const sample =
      reference.definition.sampleValue ?? reference.definition.previewValue
    if (sample === undefined || sample === null) return raw
    if (typeof sample === 'object') return JSON.stringify(sample)
    return String(sample)
  })
}
