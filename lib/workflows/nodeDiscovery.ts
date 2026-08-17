import type {
  WorkflowDiscoveryNodeDomain,
  WorkflowDiscoveryNodeType,
  WorkflowNodeAvailability,
  WorkflowNodeDefinition,
} from '@/lib/workflows/types'

export const WORKFLOW_DISCOVERY_TYPES: Array<{
  id: WorkflowDiscoveryNodeType | 'all'
  label: string
}> = [
  { id: 'all', label: 'All' },
  { id: 'trigger', label: 'Triggers' },
  { id: 'action', label: 'Actions' },
  { id: 'condition', label: 'Conditions' },
  { id: 'communication', label: 'Communication' },
  { id: 'ai', label: 'AI' },
  { id: 'integration', label: 'Integrations' },
  { id: 'utility', label: 'Utilities' },
]

export const WORKFLOW_DISCOVERY_DOMAIN_LABELS: Record<
  WorkflowDiscoveryNodeDomain,
  string
> = {
  scheduling: 'Scheduling',
  crm: 'Business / CRM',
  commerce: 'Commerce',
  projects: 'Projects',
  tasks: 'Tasks',
  clients: 'Clients',
  team: 'Team',
  inventory: 'Inventory',
  finance: 'Finance',
  reports: 'Reports',
  organization: 'Organization',
  general: 'General',
}

const TYPE_ORDER = new Map(
  WORKFLOW_DISCOVERY_TYPES.map((item, index) => [item.id, index]),
)
const DOMAIN_ORDER: WorkflowDiscoveryNodeDomain[] = [
  'scheduling',
  'crm',
  'commerce',
  'tasks',
  'clients',
  'team',
  'projects',
  'inventory',
  'finance',
  'reports',
  'organization',
  'general',
]

const SECRET_PATTERN =
  /(token|secret|password|credential|authorization|private[_-]?key)/i
const GROUP_ORDER = [
  'Favorites',
  'Recent',
  'Event Triggers',
  'CRM Triggers',
  'Task Triggers',
  'Service Request Triggers',
  'Recurrence Triggers',
  'Availability Triggers',
  'Provider Triggers',
  'Conflict Triggers',
  'Notification Triggers',
  'Worker Triggers',
  'Event Actions',
  'CRM Actions',
  'Task Actions',
  'Client Actions',
  'Availability',
  'Conflicts',
  'Recurring Events',
  'Calendar Providers',
  'Notifications & Reminders',
  'Time Off & Exceptions',
  'Messages',
  'Branches & Conditions',
  'AI',
  'Webhooks',
  'Timing',
  'Utilities',
  'Organization',
]
const GROUP_ORDER_INDEX = new Map(
  GROUP_ORDER.map((group, index) => [group, index]),
)
const CONCEPT_GROUP_ORDER = [
  'Events',
  'Assignments',
  'Availability',
  'Providers',
  'Conflicts',
  'Notifications',
  'Recurrence',
  'Workers',
  'Recurring Events',
  'Time Off & Exceptions',
  'Calendar Providers',
  'Notifications & Reminders',
  'Event State',
  'Messages',
  'Branches & Conditions',
  'AI',
  'Webhooks',
  'Timing',
  'Utilities',
  'Organization',
]
const CONCEPT_GROUP_ORDER_INDEX = new Map(
  CONCEPT_GROUP_ORDER.map((group, index) => [group, index]),
)

export type WorkflowNodeSearchScore = {
  score: number
  matchReasons: string[]
}

export type WorkflowNodeSearchIndex = {
  nodeId: string
  normalizedTitle: string
  titleTokens: string[]
  aliases: string[]
  tags: string[]
  keywords: string[]
  group: string
  type: WorkflowDiscoveryNodeType
  domain: WorkflowDiscoveryNodeDomain
  description: string
  searchable: string
}

export type WorkflowNodeDiscoveryResult = {
  node: WorkflowNodeDefinition
  score: WorkflowNodeSearchScore
  isFavorite: boolean
  recentRank?: number
}

export type WorkflowNodeDiscoveryFilters = {
  type?: WorkflowDiscoveryNodeType | 'all'
  domain?: WorkflowDiscoveryNodeDomain | 'all'
  query?: string
  favoriteIds?: string[]
  recentIds?: string[]
  includeUnavailable?: boolean
}

export type WorkflowNodeCardContextOptions = {
  node: WorkflowNodeDefinition
  selectedType?: WorkflowDiscoveryNodeType | 'all'
  selectedDomain?: WorkflowDiscoveryNodeDomain | 'all'
  effectiveGroup?: string
}

export type WorkflowNodeDiscoverySubgroup<
  T extends WorkflowNodeDiscoveryResult,
> = {
  id: string
  label: string
  items: T[]
}

export type WorkflowNodeDiscoveryGroup<T extends WorkflowNodeDiscoveryResult> =
  {
    id: string
    group: string
    items: T[]
    subgroups: WorkflowNodeDiscoverySubgroup<T>[]
  }

export function normalizeWorkflowSearchText(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
    .split(' ')
    .map((token) => singularizeToken(token))
    .join(' ')
}

function singularizeToken(token: string) {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`
  if (token.length > 3 && token.endsWith('es')) return token.slice(0, -2)
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1)
  return token
}

function normalizedList(values?: string[]) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => normalizeWorkflowSearchText(value))
        .filter(Boolean),
    ),
  )
}

export function buildWorkflowNodeSearchIndex(
  node: WorkflowNodeDefinition,
): WorkflowNodeSearchIndex {
  const discovery = node.discovery
  const aliases = normalizedList(discovery?.aliases)
  const tags = normalizedList(discovery?.tags)
  const keywords = normalizedList(discovery?.keywords)
  const optionText = node.configFields.flatMap((field) =>
    (field.options ?? []).flatMap((option) => [option.label, option.value]),
  )
  const fieldText = node.configFields.flatMap((field) => [
    field.id,
    field.key,
    field.label,
    field.group,
    field.placeholder,
    field.helpText,
    field.optionSource,
    field.workspaceOptionCategory,
    ...(field.suggestions ?? []),
    ...(field.options ?? []).flatMap((option) => [option.label, option.value]),
  ])
  const rawSearchText = [
    node.id,
    node.type,
    node.label,
    node.description,
    node.category,
    node.iconKey,
    node.aiDescription,
    node.documentation,
    node.ui?.builderNodeType,
    discovery?.type,
    discovery?.domain,
    discovery?.group,
    ...aliases,
    ...tags,
    ...keywords,
    ...fieldText,
    ...optionText,
  ]
    .filter(
      (value): value is string =>
        typeof value === 'string' && !SECRET_PATTERN.test(value),
    )
    .join(' ')

  return {
    nodeId: node.id,
    normalizedTitle: normalizeWorkflowSearchText(node.label),
    titleTokens: normalizeWorkflowSearchText(node.label)
      .split(' ')
      .filter(Boolean),
    aliases,
    tags,
    keywords,
    group: normalizeWorkflowSearchText(discovery?.group ?? ''),
    type: discovery?.type ?? 'action',
    domain: discovery?.domain ?? 'general',
    description: normalizeWorkflowSearchText(node.description),
    searchable: normalizeWorkflowSearchText(rawSearchText),
  }
}

export function scoreWorkflowNodeSearch(
  node: WorkflowNodeDefinition,
  index: WorkflowNodeSearchIndex,
  query: string,
  options: {
    favoriteIds?: Set<string>
    recentRankById?: Map<string, number>
  } = {},
): WorkflowNodeSearchScore {
  const q = normalizeWorkflowSearchText(query)
  const reasons = new Set<string>()
  let score = 0

  if (!q) {
    score += node.discovery?.searchPriority ?? 0
  } else {
    const qTokens = q.split(' ').filter(Boolean)
    const titleExact = index.normalizedTitle === q
    const titlePrefix = index.normalizedTitle.startsWith(q)
    const titleToken = qTokens.every((token) =>
      index.titleTokens.some((titleToken) => titleToken.startsWith(token)),
    )
    const aliasExact = index.aliases.some((alias) => alias === q)
    const aliasPrefix = index.aliases.some(
      (alias) =>
        alias.startsWith(q) || qTokens.every((token) => alias.includes(token)),
    )
    const keywordMatch = [...index.keywords, ...index.tags].some((value) =>
      qTokens.every((token) => value.includes(token)),
    )
    const groupMatch = index.group.includes(q)
    const descriptionMatch = index.description.includes(q)
    const domainTypeMatch = [index.domain, index.type].some((value) =>
      normalizeWorkflowSearchText(value).includes(q),
    )
    const fullTextMatch = qTokens.every((token) =>
      index.searchable.includes(token),
    )

    if (titleExact) {
      score += 1000
      reasons.add('Title')
    }
    if (titlePrefix) {
      score += 750
      reasons.add('Title prefix')
    }
    if (titleToken) {
      score += 520
      reasons.add('Title token')
    }
    if (aliasExact) {
      score += 430
      reasons.add('Alias')
    }
    if (aliasPrefix) {
      score += 360
      reasons.add('Alias')
    }
    if (keywordMatch) {
      score += 260
      reasons.add('Keyword')
    }
    if (groupMatch) {
      score += 170
      reasons.add('Group')
    }
    if (descriptionMatch) {
      score += 110
      reasons.add('Description')
    }
    if (domainTypeMatch) {
      score += 60
      reasons.add('Type or domain')
    }
    if (fullTextMatch) {
      score += 40
      reasons.add('Metadata')
    }
    if (score === 0) return { score: 0, matchReasons: [] }
  }

  if (options.favoriteIds?.has(node.id)) score += 25
  const recentRank = options.recentRankById?.get(node.id)
  if (recentRank !== undefined) score += Math.max(1, 20 - recentRank)
  score += node.discovery?.searchPriority ?? 0

  return { score, matchReasons: Array.from(reasons) }
}

export function isWorkflowNodeSelectable(node: WorkflowNodeDefinition) {
  const availability = node.availability
  if (!availability) return true
  if (availability.selectable !== undefined) return availability.selectable
  return ![
    'comingSoon',
    'unavailableForWorkspace',
    'unavailableForPlan',
  ].includes(availability.state)
}

export function workflowNodeAvailabilityLabel(
  availability?: WorkflowNodeAvailability,
) {
  if (!availability || availability.state === 'available') return null
  return (
    availability.label ??
    {
      requiresConfiguration: 'Needs setup',
      requiresAuthentication: 'Requires auth',
      comingSoon: 'Coming soon',
      unavailableForWorkspace: 'Unavailable',
      unavailableForPlan: 'Plan',
    }[availability.state]
  )
}

export function discoverWorkflowNodes(
  nodes: WorkflowNodeDefinition[],
  filters: WorkflowNodeDiscoveryFilters = {},
): WorkflowNodeDiscoveryResult[] {
  const query = filters.query ?? ''
  const type = filters.type ?? 'all'
  const domain = filters.domain ?? 'all'
  const favoriteIds = new Set(filters.favoriteIds ?? [])
  const recentRankById = new Map(
    (filters.recentIds ?? []).map((id, index) => [id, index]),
  )

  return nodes
    .filter((node) => {
      if (!filters.includeUnavailable && !isWorkflowNodeSelectable(node))
        return false
      if (type !== 'all' && node.discovery?.type !== type) return false
      if (domain !== 'all' && node.discovery?.domain !== domain) return false
      return true
    })
    .map((node) => {
      const index = buildWorkflowNodeSearchIndex(node)
      return {
        node,
        score: scoreWorkflowNodeSearch(node, index, query, {
          favoriteIds,
          recentRankById,
        }),
        isFavorite: favoriteIds.has(node.id),
        recentRank: recentRankById.get(node.id),
      }
    })
    .filter((result) => !query.trim() || result.score.score > 0)
    .sort((a, b) => {
      const scoreDelta = b.score.score - a.score.score
      if (scoreDelta !== 0) return scoreDelta
      const priorityDelta =
        (b.node.discovery?.searchPriority ?? 0) -
        (a.node.discovery?.searchPriority ?? 0)
      if (priorityDelta !== 0) return priorityDelta
      const typeDelta =
        (TYPE_ORDER.get(a.node.discovery?.type ?? 'action') ?? 99) -
        (TYPE_ORDER.get(b.node.discovery?.type ?? 'action') ?? 99)
      if (typeDelta !== 0) return typeDelta
      return a.node.label.localeCompare(b.node.label)
    })
}

function workflowTypeLabel(type: WorkflowDiscoveryNodeType) {
  return (
    WORKFLOW_DISCOVERY_TYPES.find((item) => item.id === type)?.label ?? type
  )
}

function workflowTypeNoun(type: WorkflowDiscoveryNodeType) {
  return {
    trigger: 'Trigger',
    action: 'Action',
    condition: 'Condition',
    communication: 'Communication',
    ai: 'AI',
    integration: 'Integration',
    utility: 'Utility',
  }[type]
}

function singularizeConceptLabel(label: string) {
  if (label === 'Events') return 'Event'
  if (label === 'Providers') return 'Provider'
  if (label === 'Conflicts') return 'Conflict'
  if (label === 'Notifications') return 'Notification'
  if (label === 'Workers') return 'Worker'
  if (label === 'Utilities') return 'Utility'
  return label
}

function normalizeDiscoveryConceptLabel(
  group: string,
  type?: WorkflowDiscoveryNodeType | 'all',
) {
  const trimmed = group.trim() || 'Other'
  const withoutType = trimmed
    .replace(/\s+Triggers$/i, '')
    .replace(/\s+Actions$/i, '')
    .replace(/\s+Conditions$/i, '')

  const normalized = withoutType
    .replace(/^Event$/i, 'Events')
    .replace(/^Provider$/i, 'Providers')
    .replace(/^Conflict$/i, 'Conflicts')
    .replace(/^Notification$/i, 'Notifications')
    .replace(/^Worker$/i, 'Workers')

  if (type === 'condition') {
    if (normalized === 'Calendar Providers') return 'Providers'
    if (normalized === 'Recurring Events') return 'Recurrence'
    if (normalized === 'Utilities') return 'Event State'
  }

  return normalized
}

export function getWorkflowNodeCardContextLabel({
  node,
  selectedType = 'all',
  selectedDomain = 'all',
  effectiveGroup,
}: WorkflowNodeCardContextOptions) {
  const discovery = node.discovery
  const nodeType = discovery?.type
  const nodeDomain = discovery?.domain
  if (!nodeType || !nodeDomain) return null

  const parts: string[] = []
  if (selectedDomain === 'all') {
    parts.push(WORKFLOW_DISCOVERY_DOMAIN_LABELS[nodeDomain])
  }
  if (selectedType === 'all') {
    parts.push(workflowTypeNoun(nodeType))
  }

  if (parts.length > 0) return parts.join(' · ')

  const concept = normalizeDiscoveryConceptLabel(
    effectiveGroup ?? discovery.group ?? '',
    selectedType,
  )
  const typeNoun = workflowTypeNoun(nodeType).toLowerCase()
  if (!concept || concept === 'Other') return workflowTypeNoun(nodeType)
  return `${singularizeConceptLabel(concept)} ${typeNoun}`
}

function groupOrderIndex(label: string) {
  return (
    CONCEPT_GROUP_ORDER_INDEX.get(label) ??
    GROUP_ORDER_INDEX.get(label) ??
    GROUP_ORDER_INDEX.get(`${label} Triggers`) ??
    999
  )
}

function sortDiscoveryItems<T extends WorkflowNodeDiscoveryResult>(items: T[]) {
  return [...items].sort((a, b) => {
    const priorityDelta =
      (b.node.discovery?.searchPriority ?? 0) -
      (a.node.discovery?.searchPriority ?? 0)
    if (priorityDelta !== 0) return priorityDelta
    return a.node.label.localeCompare(b.node.label)
  })
}

function entriesToDiscoveryGroups<T extends WorkflowNodeDiscoveryResult>(
  groups: Map<string, T[]>,
  options: {
    idPrefix: string
    type?: WorkflowDiscoveryNodeType | 'all'
    subgroupBy?: 'domain' | 'concept'
  },
): WorkflowNodeDiscoveryGroup<T>[] {
  return Array.from(groups.entries())
    .map(([group, items]) => {
      const sortedItems = sortDiscoveryItems(items)
      const subgroups = new Map<string, T[]>()
      if (options.subgroupBy) {
        for (const item of sortedItems) {
          const label =
            options.subgroupBy === 'domain'
              ? WORKFLOW_DISCOVERY_DOMAIN_LABELS[
                  item.node.discovery?.domain ?? 'general'
                ]
              : normalizeDiscoveryConceptLabel(
                  item.node.discovery?.group ?? 'Other',
                  options.type,
                )
          subgroups.set(label, [...(subgroups.get(label) ?? []), item])
        }
      }
      const subgroupEntries = Array.from(subgroups.entries())
        .map(([label, subgroupItems]) => ({
          id: `${options.idPrefix}:${normalizeWorkflowSearchText(group)}:${normalizeWorkflowSearchText(label)}`,
          label,
          items: sortDiscoveryItems(subgroupItems),
        }))
        .sort((a, b) => {
          const orderDelta = groupOrderIndex(a.label) - groupOrderIndex(b.label)
          if (orderDelta !== 0) return orderDelta
          return a.label.localeCompare(b.label)
        })
      return {
        id: `${options.idPrefix}:${normalizeWorkflowSearchText(group) || 'other'}`,
        group,
        items: sortedItems,
        subgroups: subgroupEntries,
      }
    })
    .filter((group) => group.items.length > 0)
    .sort((a, b) => {
      const typeA = WORKFLOW_DISCOVERY_TYPES.find(
        (item) => item.label === a.group,
      )
      const typeB = WORKFLOW_DISCOVERY_TYPES.find(
        (item) => item.label === b.group,
      )
      if (typeA && typeB) {
        return (
          (TYPE_ORDER.get(typeA.id) ?? 99) - (TYPE_ORDER.get(typeB.id) ?? 99)
        )
      }
      const orderDelta = groupOrderIndex(a.group) - groupOrderIndex(b.group)
      if (orderDelta !== 0) return orderDelta
      return a.group.localeCompare(b.group)
    })
}

export function groupWorkflowNodeResults<T extends WorkflowNodeDiscoveryResult>(
  results: T[],
  filters: Pick<WorkflowNodeDiscoveryFilters, 'type' | 'domain'> = {},
) {
  const type = filters.type ?? 'all'
  const domain = filters.domain ?? 'all'
  if (type === 'all') {
    const typeGroups = new Map<string, T[]>()
    for (const result of results) {
      const discoveryType = result.node.discovery?.type ?? 'action'
      const label = workflowTypeLabel(discoveryType)
      typeGroups.set(label, [...(typeGroups.get(label) ?? []), result])
    }
    return entriesToDiscoveryGroups(typeGroups, {
      idPrefix: 'type',
      type,
      subgroupBy: domain === 'all' ? 'domain' : 'concept',
    })
  }

  const groups = new Map<string, T[]>()
  for (const result of results) {
    const group = normalizeDiscoveryConceptLabel(
      result.node.discovery?.group ?? 'Other',
      type,
    )
    groups.set(group, [...(groups.get(group) ?? []), result])
  }
  return entriesToDiscoveryGroups(groups, {
    idPrefix: `concept:${type}`,
    type,
  })
}

export function getWorkflowDiscoveryDomains(nodes: WorkflowNodeDefinition[]) {
  const seen = new Set<WorkflowDiscoveryNodeDomain>()
  for (const node of nodes) {
    if (node.discovery?.domain) seen.add(node.discovery.domain)
  }
  return Array.from(seen).sort((a, b) => {
    const orderDelta = DOMAIN_ORDER.indexOf(a) - DOMAIN_ORDER.indexOf(b)
    if (orderDelta !== 0) return orderDelta
    return WORKFLOW_DISCOVERY_DOMAIN_LABELS[a].localeCompare(
      WORKFLOW_DISCOVERY_DOMAIN_LABELS[b],
    )
  })
}

export function validateWorkflowNodeDiscoveryMetadata(
  nodes: WorkflowNodeDefinition[],
) {
  const issues: string[] = []
  const ids = new Set<string>()
  const validTypes = new Set(
    WORKFLOW_DISCOVERY_TYPES.map((item) => item.id).filter(
      (item) => item !== 'all',
    ),
  )
  const validDomains = new Set(Object.keys(WORKFLOW_DISCOVERY_DOMAIN_LABELS))

  for (const node of nodes) {
    if (ids.has(node.id)) issues.push(`Duplicate workflow node ID: ${node.id}`)
    ids.add(node.id)
    if (!node.discovery?.type || !validTypes.has(node.discovery.type)) {
      issues.push(`${node.id} is missing a valid discovery type.`)
    }
    if (!node.discovery?.domain || !validDomains.has(node.discovery.domain)) {
      issues.push(`${node.id} is missing a valid discovery domain.`)
    }
    if (!node.discovery?.group?.trim()) {
      issues.push(`${node.id} is missing a discovery group.`)
    }
    for (const value of [
      ...(node.discovery?.aliases ?? []),
      ...(node.discovery?.tags ?? []),
      ...(node.discovery?.keywords ?? []),
    ]) {
      if (value && SECRET_PATTERN.test(value)) {
        issues.push(
          `${node.id} discovery metadata contains a restricted secret-like term.`,
        )
      }
    }
    if (
      node.availability?.state === 'comingSoon' &&
      node.availability.selectable !== false
    ) {
      issues.push(`${node.id} is coming soon but is still selectable.`)
    }
  }

  return issues
}
