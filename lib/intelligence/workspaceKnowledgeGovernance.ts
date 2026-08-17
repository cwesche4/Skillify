export type WorkspaceKnowledgeStructuredProposal = {
  title: string
  summary: string
  reasoning: string[]
  evidence: string[]
  confidence: 'low' | 'medium' | 'high'
  sourceLabel: string
}

export type WorkspaceKnowledgeConflict = {
  existingId: string
  existingPolicy: string
  proposedPolicy: string
  potentialImpact: string
}

export type WorkspaceKnowledgeQuality = {
  confidence: string
  evidenceCount: number
  conflictCount: number
  dependencies: string[]
  runtimeUsage: string[]
}

export type WorkspaceKnowledgeLike = {
  id: string
  category: string
  title: string
  description?: string | null
  structuredValue?: unknown
  confidence?: string | null
  approvalStatus?: string
  isArchived?: boolean
  tags?: string[]
  source?: { label?: string | null; type?: string | null } | null
}

export const EXPANDED_WORKSPACE_KNOWLEDGE_CATEGORIES = [
  'Business Fact',
  'Scheduling Preference',
  'Operating Guideline',
  'Customer Policy',
  'Internal Policy',
  'Dispatch Rule',
  'AI Response Preference',
  'Automation Guideline',
  'Sales Guideline',
  'CRM Guideline',
  'Marketing Guideline',
  'Finance Guideline',
  'Inventory Guideline',
  'Communication Guideline',
  'Business Rule',
  'Exception',
  'Temporary Override',
  'Assignment Rule',
  'Escalation Rule',
  'Service Rule',
  'Compliance Requirement',
  'Other',
]

export const GOVERNED_KNOWLEDGE_SOURCE_LABELS = [
  'Owner',
  'Manager',
  'Workspace Setup',
  'Workspace AI Settings',
  'AI Proposal',
  'Manual Entry',
  'Correction',
  'Integration',
  'Import',
  'API',
  'Audit',
  'Other',
]

const runtimeUsageByCategory: Record<string, string[]> = {
  'Scheduling Preference': ['Scheduling', 'Assignments', 'AI Coach'],
  'Dispatch Rule': ['Scheduling', 'Assignments', 'Operational Intelligence'],
  'Assignment Rule': ['Scheduling', 'Assignments', 'Automations'],
  'Customer Policy': ['CRM', 'Clients', 'AI Coach'],
  'Communication Guideline': ['CRM', 'Workspace AI', 'AI Coach'],
  'Automation Guideline': ['Automations', 'Workflow Builder', 'AI Coach'],
  'AI Response Preference': ['Workspace AI', 'AI Coach'],
  'Sales Guideline': ['Sales Pipeline', 'Opportunities', 'CRM'],
  'CRM Guideline': ['CRM', 'Leads', 'Opportunities'],
  'Inventory Guideline': ['Inventory', 'Commerce'],
  'Finance Guideline': ['Reports and Analytics', 'Commerce'],
  'Operating Guideline': ['Team Operations', 'Workspace AI'],
}

export function buildStructuredKnowledgeProposal(input: {
  title?: string
  summary?: string
  reasoning?: unknown
  evidence?: unknown
  confidence?: unknown
  sourceLabel?: string
}): WorkspaceKnowledgeStructuredProposal {
  const summary =
    cleanText(input.summary) ||
    cleanText(input.title) ||
    'Review this proposed business guidance.'
  return {
    title: cleanTitle(input.title || summary),
    summary,
    reasoning: normalizeList(input.reasoning).slice(0, 8),
    evidence: normalizeList(input.evidence).slice(0, 8),
    confidence: normalizeConfidence(input.confidence),
    sourceLabel: cleanText(input.sourceLabel) || 'AI Proposal',
  }
}

export function translateWorkspaceAISettingToKnowledge(input: {
  field: string
  value: unknown
}) {
  switch (input.field) {
    case 'businessSummary':
      return textProposal({
        category: 'Business Fact',
        title: 'Workspace business context',
        summary: input.value,
        relatedModule: 'Workspace AI',
      })
    case 'productsAndServices':
      return textProposal({
        category: 'Business Rule',
        title: 'Products and services offered',
        summary: input.value,
        relatedModule: 'Service Requests',
      })
    case 'operatingGuidelines':
      return textProposal({
        category: 'Operating Guideline',
        title: 'Operating guideline from Workspace AI settings',
        summary: input.value,
        relatedModule: 'Team Operations',
      })
    case 'brandVoice':
      return textProposal({
        category: 'Communication Guideline',
        title: 'Communication style preference',
        summary: input.value,
        relatedModule: 'Workspace AI',
      })
    case 'customerPolicies':
      return textProposal({
        category: 'Customer Policy',
        title: 'Customer policy from Workspace AI settings',
        summary: input.value,
        relatedModule: 'Clients',
      })
    case 'automationGuardrails':
      const automationPolicy = formatAutomationGuardrails(input.value)
      return {
        category: 'Automation Guideline',
        title: `Workspace AI automation permissions: ${automationPolicyFingerprint(input.value)}`,
        summary: automationPolicy,
        relatedModule: 'Automations',
        value: {
          settingField: input.field,
          readablePolicy: automationPolicy,
          rawSetting: input.value,
        },
      }
    default:
      return null
  }
}

export function formatAutomationGuardrails(value: unknown) {
  const record = isRecord(value) ? value : {}
  const lines = [
    booleanPolicyLine(
      record.allowAdvice,
      'Workspace AI may provide advice.',
      'Workspace AI may not provide advice.',
    ),
    booleanPolicyLine(
      record.allowDrafting,
      'Workspace AI may draft automations.',
      'Workspace AI may not draft automations.',
    ),
    booleanPolicyLine(
      record.allowActionProposals,
      'Workspace AI may recommend actions.',
      'Workspace AI may not recommend actions.',
    ),
    booleanPolicyLine(
      record.requireApprovalForActions !== false,
      'Approval is required before execution.',
      'Approval is not required before execution.',
    ),
    'Workspace AI may not execute autonomous actions.',
  ]
  return lines.join('\n')
}

export function detectWorkspaceKnowledgeConflicts({
  proposed,
  approved,
}: {
  proposed: Pick<
    WorkspaceKnowledgeLike,
    'id' | 'title' | 'category' | 'structuredValue'
  >
  approved: WorkspaceKnowledgeLike[]
}): WorkspaceKnowledgeConflict[] {
  const proposedText = knowledgeText(proposed)
  const proposedTokens = policyTokens(proposedText)
  const absolute = /\b(always|never|only|must|required)\b/i.test(proposedText)
  const conflicts: WorkspaceKnowledgeConflict[] = []

  for (const existing of approved) {
    if (existing.approvalStatus !== 'APPROVED' || existing.isArchived) continue
    if (
      existing.category !== proposed.category &&
      !relatedCategories(existing.category, proposed.category)
    )
      continue
    const existingText = knowledgeText(existing)
    const existingTokens = policyTokens(existingText)
    const overlap = [...proposedTokens].filter((token) =>
      existingTokens.has(token),
    ).length
    const oppositeIntent = hasOppositeIntent(existingText, proposedText)
    if (oppositeIntent || (absolute && overlap >= 1) || overlap >= 3) {
      conflicts.push({
        existingId: existing.id,
        existingPolicy: existing.title,
        proposedPolicy: proposed.title,
        potentialImpact: inferConflictImpact(existingText, proposedText),
      })
    }
  }

  return conflicts.slice(0, 5)
}

export function buildWorkspaceKnowledgeQuality({
  item,
  approvedItems,
}: {
  item: WorkspaceKnowledgeLike
  approvedItems: WorkspaceKnowledgeLike[]
}): WorkspaceKnowledgeQuality {
  const value = isRecord(item.structuredValue) ? item.structuredValue : {}
  const proposal = getStructuredProposal(item.structuredValue)
  const evidence = proposal?.evidence ?? normalizeList(value.evidence)
  const dependencies = getWorkspaceKnowledgeDependencies(item)
  const conflicts = detectWorkspaceKnowledgeConflicts({
    proposed: item,
    approved: approvedItems.filter((candidate) => candidate.id !== item.id),
  })
  return {
    confidence: proposal?.confidence ?? item.confidence ?? 'medium',
    evidenceCount: evidence.length,
    conflictCount: conflicts.length,
    dependencies,
    runtimeUsage: getRuntimeUsageForKnowledge(item),
  }
}

export function getWorkspaceKnowledgeDependencies(
  item: WorkspaceKnowledgeLike,
) {
  const value = isRecord(item.structuredValue) ? item.structuredValue : {}
  const explicit = normalizeList(value.dependencies)
  if (explicit.length) return explicit
  const category = item.category
  if (
    category === 'Scheduling Preference' ||
    category === 'Dispatch Rule' ||
    category === 'Assignment Rule'
  ) {
    return ['Business Locations', 'Team availability', 'Dispatch rules']
  }
  if (category === 'Automation Guideline')
    return ['Approval rules', 'Workflow Builder']
  if (category === 'Customer Policy')
    return ['Customer records', 'Communication preferences']
  return []
}

export function getRuntimeUsageForKnowledge(item: WorkspaceKnowledgeLike) {
  const value = isRecord(item.structuredValue) ? item.structuredValue : {}
  const explicit = normalizeList(value.runtimeUsage)
  if (explicit.length) return explicit
  return runtimeUsageByCategory[item.category] ?? ['Workspace AI']
}

export function getStructuredProposal(
  value: unknown,
): WorkspaceKnowledgeStructuredProposal | null {
  if (!isRecord(value)) return null
  const proposal = isRecord(value.proposal) ? value.proposal : value
  if (
    typeof proposal.title !== 'string' &&
    typeof proposal.summary !== 'string'
  )
    return null
  return buildStructuredKnowledgeProposal({
    title: typeof proposal.title === 'string' ? proposal.title : undefined,
    summary:
      typeof proposal.summary === 'string' ? proposal.summary : undefined,
    reasoning: proposal.reasoning,
    evidence: proposal.evidence,
    confidence: proposal.confidence,
    sourceLabel:
      typeof proposal.sourceLabel === 'string'
        ? proposal.sourceLabel
        : undefined,
  })
}

export function buildGovernedLearningRecommendations(
  items: WorkspaceKnowledgeLike[],
) {
  const approved = items.filter(
    (item) => item.approvalStatus === 'APPROVED' && !item.isArchived,
  )
  const recommendations: Array<{
    id: string
    title: string
    description: string
  }> = []
  const byStatement = new Map<string, WorkspaceKnowledgeLike[]>()
  for (const item of approved) {
    const key = cleanText(item.title).toLowerCase()
    byStatement.set(key, [...(byStatement.get(key) ?? []), item])
  }
  for (const duplicates of byStatement.values()) {
    if (duplicates.length > 1) {
      recommendations.push({
        id: `merge:${duplicates[0].id}`,
        title: 'Consider merging duplicate policies',
        description: `${duplicates.length} approved policies use the same business wording.`,
      })
    }
  }
  for (const item of approved) {
    const usage = getRuntimeUsageForKnowledge(item)
    if (usage.length <= 1) {
      recommendations.push({
        id: `review-unused:${item.id}`,
        title: 'Review low-usage knowledge',
        description: `${item.title} has limited runtime usage signals.`,
      })
    }
  }
  return recommendations.slice(0, 6)
}

function textProposal({
  category,
  title,
  summary,
  relatedModule,
}: {
  category: string
  title: string
  summary: unknown
  relatedModule: string
}) {
  const text = stringifyBusinessValue(summary)
  if (!text) return null
  return {
    category,
    title: cleanTitle(text) || title,
    summary: text,
    relatedModule,
    value: {
      readablePolicy: text,
    },
  }
}

function automationPolicyFingerprint(value: unknown) {
  const record = isRecord(value) ? value : {}
  const enabled = [
    record.allowAdvice !== false ? 'advice' : null,
    record.allowDrafting !== false ? 'drafting' : null,
    record.allowActionProposals !== false ? 'recommendations' : null,
    record.requireApprovalForActions !== false
      ? 'approval required'
      : 'approval optional',
  ].filter(Boolean)
  return enabled.join(', ')
}

function stringifyBusinessValue(value: unknown) {
  if (typeof value === 'string') return cleanText(value)
  if (Array.isArray(value))
    return value
      .map((entry) => cleanText(String(entry)))
      .filter(Boolean)
      .join('\n')
  if (!isRecord(value)) return ''
  return Object.entries(value)
    .map(
      ([key, entry]) =>
        `${humanizeKey(key)}: ${typeof entry === 'boolean' ? (entry ? 'Yes' : 'No') : String(entry)}`,
    )
    .join('\n')
}

function cleanTitle(value: string) {
  return (
    cleanText(value)
      .replace(/[.!?]+$/, '')
      .slice(0, 120) || 'Workspace knowledge proposal'
  )
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(String(item))).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|•|;/)
      .map((item) => cleanText(item))
      .filter(Boolean)
  }
  return []
}

function normalizeConfidence(value: unknown): 'low' | 'medium' | 'high' {
  const normalized = typeof value === 'string' ? value.toLowerCase() : ''
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low')
    return normalized
  return 'medium'
}

function knowledgeText(
  item: Pick<WorkspaceKnowledgeLike, 'title' | 'structuredValue'>,
) {
  const proposal = getStructuredProposal(item.structuredValue)
  return [item.title, proposal?.summary, ...(proposal?.reasoning ?? [])]
    .filter(Boolean)
    .join(' ')
}

function policyTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(
        (token) =>
          token.length > 3 &&
          ![
            'should',
            'would',
            'could',
            'prefer',
            'always',
            'never',
            'only',
            'when',
            'with',
            'from',
            'that',
            'this',
          ].includes(token),
      ),
  )
}

function relatedCategories(a: string, b: string) {
  const scheduling = new Set([
    'Scheduling Preference',
    'Dispatch Rule',
    'Assignment Rule',
    'Operating Guideline',
  ])
  const customer = new Set([
    'Customer Policy',
    'Communication Guideline',
    'CRM Guideline',
    'Sales Guideline',
  ])
  return (
    (scheduling.has(a) && scheduling.has(b)) ||
    (customer.has(a) && customer.has(b))
  )
}

function hasOppositeIntent(existing: string, proposed: string) {
  const lowerExisting = existing.toLowerCase()
  const lowerProposed = proposed.toLowerCase()
  return (
    (lowerExisting.includes('closest') &&
      lowerProposed.includes('always assign')) ||
    (lowerExisting.includes('same business location') &&
      lowerProposed.includes('always assign')) ||
    (lowerExisting.includes('never') && lowerProposed.includes('always')) ||
    (lowerExisting.includes('always') && lowerProposed.includes('never'))
  )
}

function inferConflictImpact(existing: string, proposed: string) {
  const combined = `${existing} ${proposed}`.toLowerCase()
  if (
    combined.includes('technician') ||
    combined.includes('dispatch') ||
    combined.includes('assign')
  ) {
    return 'May affect travel time, workload balance, or assignment quality.'
  }
  if (combined.includes('customer') || combined.includes('vip')) {
    return 'May affect customer handling or service expectations.'
  }
  if (combined.includes('automation')) {
    return 'May affect automation recommendations or approval expectations.'
  }
  return 'May change how Skillify interprets business policy.'
}

function booleanPolicyLine(value: unknown, yes: string, no: string) {
  return value === false ? no : yes
}

function humanizeKey(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
