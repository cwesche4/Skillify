import type {
  WorkspaceIntelligenceActor,
  WorkspaceIntelligenceIntent,
  WorkspaceIntelligenceWorkspace,
  WorkspaceKnowledgeDomain,
} from '@/lib/intelligence/workspaceIntelligence'
import {
  buildWorkspaceConfidenceAssessment,
  createKnowledgeGap,
  createWorkspaceKnowledgeGrowthSnapshot,
  createWorkspaceKnowledgeSource,
  type WorkspaceConfidenceAssessment,
  type WorkspaceKnowledgeGap,
  type WorkspaceKnowledgeGrowthSnapshot,
} from '@/lib/intelligence/workspaceKnowledgeGrowth'

export type WorkspaceAIRoutingMode = 'AUTO_DETECT' | 'FORCE_INTENT'

export type WorkspaceAICapability =
  | 'summarize'
  | 'explain'
  | 'compare'
  | 'investigate'
  | 'identifyRisks'
  | 'identifyBottlenecks'
  | 'recommendNextActions'
  | 'forecast'
  | 'inspectRecord'
  | 'inspectRelationships'
  | 'diagnoseFailure'
  | 'planOperationalChange'

export type WorkspaceAIDomainAvailability =
  | 'available'
  | 'partial'
  | 'deferred'
  | 'unavailable'

export type WorkspaceAIIntentResolution = {
  routingMode: WorkspaceAIRoutingMode
  detectedDomains: WorkspaceKnowledgeDomain[]
  primaryDomain: WorkspaceKnowledgeDomain
  matchedIntent: WorkspaceIntelligenceIntent
  capability: WorkspaceAICapability
  confidence: 'low' | 'medium' | 'high'
  requiredContext: string[]
  availableContext: string[]
  missingContext: string[]
  clarificationRequired: boolean
  clarificationQuestion?: string
  allowedKnowledgeTools: string[]
  allowedProposalTypes: string[]
  reasonCodes: string[]
}

export type WorkspaceKnowledgeToolAvailability =
  | 'available'
  | 'partial'
  | 'deferred'
  | 'unavailable'

export type WorkspaceKnowledgeToolDefinition = {
  id: string
  domain: WorkspaceKnowledgeDomain
  description: string
  requiredPermissions: string[]
  requiredContext: string[]
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  availability: WorkspaceKnowledgeToolAvailability
  authoritativeSource: string
  dataFreshness: 'request-time' | 'snapshot' | 'future'
  costClass: 'low' | 'medium'
  supportsDateRange: boolean
  supportsSelectedRecords: boolean
  readOnly: true
}

export type WorkspaceAIAnalysisPlan = {
  id: string
  question: string
  domains: WorkspaceKnowledgeDomain[]
  requestedDomains: WorkspaceKnowledgeDomain[]
  inspectedDomains: WorkspaceKnowledgeDomain[]
  partialDomains: WorkspaceKnowledgeDomain[]
  unavailableDomains: WorkspaceKnowledgeDomain[]
  objective: string
  steps: WorkspaceAIAnalysisStep[]
  requiredTools: string[]
  optionalTools: string[]
  missingData: string[]
  known: string[]
  unknown: string[]
  knowledgeGaps: WorkspaceKnowledgeGap[]
  confidenceAssessment: WorkspaceConfidenceAssessment
  knowledgeGrowth: WorkspaceKnowledgeGrowthSnapshot
  assumptions: string[]
  safety: string[]
  status: 'valid' | 'partial' | 'requires-clarification'
}

export type WorkspaceAIAnalysisStep = {
  order: number
  purpose: string
  toolId: string
  validatedInput: Record<string, unknown>
  dependencies: string[]
  status: 'ready' | 'skipped' | 'blocked'
}

export type WorkspaceAIClaimType =
  | 'CONFIRMED'
  | 'DERIVED_METRIC'
  | 'INFERRED'
  | 'GENERAL_GUIDANCE'
  | 'UNKNOWN'
  | 'DATA_QUALITY_LIMITATION'

export type WorkspaceAIClaim = {
  id: string
  text: string
  type: WorkspaceAIClaimType
  confidence: 'low' | 'medium' | 'high'
  supportingReferenceIds: string[]
  supportingToolResultIds: string[]
  limitations: string[]
}

export type WorkspaceAIClarification = {
  question: string
  missingContext: string[]
  availableOptions: string[]
  suggestedSelections: string[]
  blocking: boolean
  references: string[]
}

export const workspaceAIDomainCatalog: Array<{
  id: WorkspaceKnowledgeDomain
  label: string
  availability: WorkspaceAIDomainAvailability
  description: string
}> = [
  {
    id: 'scheduling',
    label: 'Scheduling',
    availability: 'available',
    description:
      'Scheduling events, conflicts, workload, recurrence, and availability.',
  },
  {
    id: 'crm',
    label: 'CRM',
    availability: 'available',
    description:
      'Leads, opportunities, clients, follow-ups, and CRM data quality.',
  },
  {
    id: 'serviceRequests',
    label: 'Service Requests',
    availability: 'partial',
    description:
      'Workspace-scoped service request records and related operational risks.',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    availability: 'partial',
    description:
      'Customer-facing tasks, parent records, checklist progress, and ownership.',
  },
  {
    id: 'projects',
    label: 'Projects',
    availability: 'partial',
    description:
      'Project status and health where authoritative project data exists.',
  },
  {
    id: 'automation',
    label: 'Automations',
    availability: 'partial',
    description:
      'Automation definitions, runs, validation, failures, and readiness.',
  },
  {
    id: 'workflowBuilder',
    label: 'Workflow Builder',
    availability: 'partial',
    description:
      'Workflow validation, node capabilities, branch readiness, and execution readiness.',
  },
  {
    id: 'operations',
    label: 'Operations',
    availability: 'partial',
    description:
      'Operational bottlenecks synthesized from available scheduling, task, service, and execution context.',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    availability: 'partial',
    description:
      'Provider registry, connection health, capabilities, and action-required state.',
  },
  {
    id: 'members',
    label: 'Members',
    availability: 'partial',
    description: 'Workspace members, roles, team membership, and invitations.',
  },
  {
    id: 'teams',
    label: 'Teams',
    availability: 'partial',
    description:
      'Workspace teams, memberships, locations, and scheduling readiness context.',
  },
  {
    id: 'locations',
    label: 'Business Locations',
    availability: 'partial',
    description: 'Workspace business locations and assignment context.',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    availability: 'partial',
    description:
      'Notification preferences, channel readiness, and delivery limitations.',
  },
  {
    id: 'workspace',
    label: 'Workspace Readiness',
    availability: 'partial',
    description:
      'Workspace setup, readiness, warnings, and recommended configuration actions.',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    availability: 'deferred',
    description:
      'Future campaign performance and attribution contracts. No live ingestion yet.',
  },
  {
    id: 'finance',
    label: 'Finance',
    availability: 'deferred',
    description:
      'Future revenue, margin, cash-flow, and profitability intelligence contracts.',
  },
]

export const workspaceKnowledgeToolCatalog: WorkspaceKnowledgeToolDefinition[] =
  [
    tool(
      'scheduling.getScheduleSummary',
      'scheduling',
      'Summarize schedule occurrences, ranges, recurrence, and readiness.',
      ['scheduling:read'],
      'available',
      true,
    ),
    tool(
      'scheduling.getConflicts',
      'scheduling',
      'Return deterministic scheduling conflict findings.',
      ['scheduling:read'],
      'available',
      true,
    ),
    tool(
      'scheduling.getMemberWorkload',
      'scheduling',
      'Return member workload and busy-minute facts.',
      ['scheduling:read'],
      'available',
      true,
    ),
    tool(
      'scheduling.getTeamWorkload',
      'scheduling',
      'Return team workload facts.',
      ['scheduling:read'],
      'available',
      true,
    ),
    tool(
      'scheduling.getUnassignedWork',
      'scheduling',
      'Return unassigned scheduling work.',
      ['scheduling:read'],
      'available',
      true,
    ),
    tool(
      'scheduling.getAvailability',
      'scheduling',
      'Return deterministic availability and unavailable intervals.',
      ['scheduling:read'],
      'available',
      true,
    ),
    tool(
      'scheduling.getRecurringScheduleSummary',
      'scheduling',
      'Summarize recurring scheduling series and occurrences.',
      ['scheduling:read'],
      'available',
      true,
    ),
    tool(
      'scheduling.explainConflict',
      'scheduling',
      'Explain a validated scheduling conflict.',
      ['scheduling:read'],
      'available',
      true,
    ),
    tool(
      'scheduling.findCandidateMembers',
      'scheduling',
      'Find assignment candidates using Scheduling Knowledge.',
      ['scheduling:read'],
      'available',
      true,
    ),
    tool(
      'crm.getOverview',
      'crm',
      'Summarize CRM pipeline, records, warnings, and recommendations.',
      ['crm:read'],
      'available',
      false,
    ),
    tool(
      'crm.getLeadMetrics',
      'crm',
      'Return lead metrics and prioritization facts.',
      ['crm:read'],
      'available',
      false,
    ),
    tool(
      'crm.getFollowUpAnalysis',
      'crm',
      'Return overdue and at-risk follow-up facts.',
      ['crm:read'],
      'available',
      false,
    ),
    tool(
      'crm.getOpportunityPipeline',
      'crm',
      'Return opportunity pipeline facts.',
      ['crm:read'],
      'available',
      false,
    ),
    tool(
      'crm.getOpportunityRisks',
      'crm',
      'Return deterministic opportunity risk findings.',
      ['crm:read'],
      'available',
      false,
    ),
    tool(
      'crm.getLeadPriorities',
      'crm',
      'Return deterministic lead-priority recommendations.',
      ['crm:read'],
      'available',
      false,
    ),
    tool(
      'crm.getDataQualityFindings',
      'crm',
      'Return CRM data-quality findings.',
      ['crm:read'],
      'available',
      false,
    ),
    tool(
      'crm.compareLeadSources',
      'crm',
      'Compare CRM lead-source quality where source data exists.',
      ['crm:read'],
      'partial',
      false,
    ),
    tool(
      'serviceRequests.getOverview',
      'serviceRequests',
      'Summarize service request status and risks from current workspace records.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'serviceRequests.getOverdue',
      'serviceRequests',
      'Find overdue service requests where due dates exist.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'tasks.getOverview',
      'tasks',
      'Summarize task status, ownership, and related records.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'tasks.findTasksBlockingCompletion',
      'tasks',
      'Find tasks that may block related work completion.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'projects.getOverview',
      'projects',
      'Summarize project facts where project records exist.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'automations.getFailedRuns',
      'automation',
      'Inspect failed automation runs and safe failure metadata.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'automations.getValidationIssues',
      'automation',
      'Inspect workflow validation issues without editing workflows.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'workflowBuilder.getValidationSummary',
      'workflowBuilder',
      'Reuse Workflow Builder validation summaries.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'integrations.getHealth',
      'integrations',
      'Inspect integration health and readiness without exposing credentials.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'workspaceMembers.getOverview',
      'members',
      'Summarize active members, roles, and pending invitations.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'teams.getOverview',
      'teams',
      'Summarize workspace team records and membership.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'locations.getOverview',
      'locations',
      'Summarize business locations and assignment context.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'notifications.getAvailableChannels',
      'notifications',
      'Explain notification channel availability and limitations.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'workspace.getReadiness',
      'workspace',
      'Explain workspace setup readiness and blockers.',
      ['workspace:read'],
      'partial',
      false,
    ),
    tool(
      'marketing.getCampaignPerformance',
      'marketing',
      'Deferred campaign-performance contract. No live data in this phase.',
      ['workspace:read'],
      'deferred',
      true,
    ),
    tool(
      'finance.getRevenue',
      'finance',
      'Deferred revenue intelligence contract. No live finance tool in this phase.',
      ['workspace:read'],
      'deferred',
      true,
    ),
  ]

export function resolveWorkspaceAIIntent({
  prompt,
  domain,
  routingMode,
  forcedIntent,
  contextReferences = [],
}: {
  prompt: string
  domain?: WorkspaceKnowledgeDomain
  routingMode: WorkspaceAIRoutingMode
  forcedIntent?: WorkspaceIntelligenceIntent
  contextReferences?: Array<{ kind?: string; id: string; label?: string }>
}): WorkspaceAIIntentResolution {
  if (routingMode === 'FORCE_INTENT' && forcedIntent) {
    return buildResolution({
      prompt,
      routingMode,
      primaryDomain: domainForIntent(forcedIntent) ?? domain ?? 'workspace',
      matchedIntent: forcedIntent,
      capability: capabilityForIntent(forcedIntent),
      confidence: 'high',
      contextReferences,
      reasonCodes: ['forced-intent-testing-override'],
    })
  }

  const text = prompt.toLowerCase()
  const contextKinds = new Set(
    contextReferences.map((reference) => reference.kind),
  )
  if (domain === 'scheduling' || schedulingTerms.test(text)) {
    if (technicianTerms.test(text)) {
      return buildResolution({
        prompt,
        routingMode,
        primaryDomain: 'scheduling',
        matchedIntent: 'scheduling.findBestMember',
        capability: 'recommendNextActions',
        confidence: 'high',
        contextReferences,
        requiredContext: ['appointment'],
        missingContext: contextKinds.has('event') ? [] : ['appointment'],
        clarificationQuestion: contextKinds.has('event')
          ? undefined
          : 'Which appointment would you like me to assign a technician to?',
        allowedProposalTypes: ['assignTechnician'],
        reasonCodes: ['assignment-language-detected'],
      })
    }
    if (conflictTerms.test(text)) {
      return buildResolution({
        prompt,
        routingMode,
        primaryDomain: 'scheduling',
        matchedIntent: 'scheduling.explainConflict',
        capability: 'identifyRisks',
        confidence: 'high',
        contextReferences,
        reasonCodes: ['scheduling-conflict-language-detected'],
      })
    }
    return buildResolution({
      prompt,
      routingMode,
      primaryDomain: 'scheduling',
      matchedIntent: 'scheduling.balanceWorkload',
      capability: summarizeTerms.test(text) ? 'summarize' : 'investigate',
      confidence: 'high',
      contextReferences,
      reasonCodes: ['scheduling-summary-language-detected'],
    })
  }

  if (domain === 'crm' || crmTerms.test(text)) {
    return buildResolution({
      prompt,
      routingMode,
      primaryDomain: 'crm',
      matchedIntent: crmPipelineTerms.test(text)
        ? 'crm.analyzePipeline'
        : 'crm.recommendNextActions',
      capability: crmPipelineTerms.test(text)
        ? 'summarize'
        : 'recommendNextActions',
      confidence: 'medium',
      contextReferences,
      reasonCodes: ['crm-language-detected'],
    })
  }

  const detectedDomains = detectWorkspaceDomains(text)
  return buildResolution({
    prompt,
    routingMode,
    primaryDomain: detectedDomains[0] ?? 'workspace',
    detectedDomains,
    matchedIntent: 'workspace.investigateQuestion',
    capability: bottleneckTerms.test(text)
      ? 'identifyBottlenecks'
      : 'investigate',
    confidence: detectedDomains.length > 0 ? 'medium' : 'low',
    contextReferences,
    reasonCodes:
      detectedDomains.length > 0
        ? ['cross-domain-investigation']
        : ['workspace-investigation-fallback'],
  })
}

export function buildWorkspaceAIAnalysisPlan({
  question,
  resolution,
  actor,
  workspace,
  persistedKnowledge,
}: {
  question: string
  resolution: WorkspaceAIIntentResolution
  actor: WorkspaceIntelligenceActor
  workspace: WorkspaceIntelligenceWorkspace
  persistedKnowledge?: Partial<WorkspaceKnowledgeGrowthSnapshot>
}): WorkspaceAIAnalysisPlan {
  const actorPermissions = new Set(actor.permissions)
  const requestedDomains = resolution.detectedDomains
  const eligibleTools = workspaceKnowledgeToolCatalog
    .filter((toolDefinition) =>
      resolution.allowedKnowledgeTools.includes(toolDefinition.id),
    )
    .filter((toolDefinition) =>
      toolDefinition.requiredPermissions.every(
        (permission) =>
          actorPermissions.has(permission) ||
          actorPermissions.has('workspace:read'),
      ),
    )
    .filter((toolDefinition) => toolDefinition.availability !== 'deferred')
  const usableTools = selectWorkspaceKnowledgeTools({
    tools: eligibleTools,
    requestedDomains,
    limit: 6,
  })

  const inspectedDomains = [...new Set(usableTools.map((tool) => tool.domain))]
  const partialDomains = requestedDomains.filter(
    (domainId) =>
      workspaceAIDomainCatalog.find((domain) => domain.id === domainId)
        ?.availability === 'partial',
  )
  const unavailableDomains = requestedDomains.filter((domainId) => {
    const availability = workspaceAIDomainCatalog.find(
      (domain) => domain.id === domainId,
    )?.availability
    return availability === 'deferred' || availability === 'unavailable'
  })

  const missingData = missingDataForResolution(resolution)
  const assumptions = [
    'Only registered read-only tools may be used.',
    'Prior AI prose is conversational context, not authoritative workspace state.',
    'Unapproved corrections and pending learning-queue items are not business truth.',
  ]
  const knowledgeSources = usableTools.map((toolDefinition) =>
    createWorkspaceKnowledgeSource({
      workspaceId: workspace.id,
      type:
        toolDefinition.availability === 'partial'
          ? 'futureConnector'
          : 'connectedProvider',
      label: toolDefinition.authoritativeSource,
      domain: toolDefinition.domain,
      recordType: 'knowledgeTool',
      recordId: toolDefinition.id,
      inspectedAt: 'request-time',
    }),
  )
  const requestTimeKnowledgeGaps = missingData.map((item) =>
    createKnowledgeGap({
      workspaceId: workspace.id,
      category: categoryForMissingData(item),
      title: item,
      description: `Skillify needs ${item} before this workspace fact can be treated as authoritative.`,
      severity: severityForMissingData(item),
      seenAt: 'request-time',
      affectedDomains: domainsForMissingData(item, resolution.detectedDomains),
      possibleIntegrations: integrationsForMissingData(item),
      recommendedConfiguration: configurationForMissingData(item),
    }),
  )
  const approvedKnowledge = persistedKnowledge?.approvedKnowledge ?? []
  const pendingKnowledge = persistedKnowledge?.pendingKnowledge ?? []
  const rejectedKnowledge = persistedKnowledge?.rejectedKnowledge ?? []
  const persistedSources = persistedKnowledge?.knowledgeSources ?? []
  const knowledgeGaps = [
    ...(persistedKnowledge?.knowledgeGaps ?? []),
    ...requestTimeKnowledgeGaps,
  ]
  const recommendationHistory = persistedKnowledge?.recommendationHistory ?? []
  const confidenceAssessment = buildWorkspaceConfidenceAssessment({
    approvedKnowledge,
    knowledgeGaps,
    missingData,
    partialDomains,
    unavailableDomains,
    assumptions,
  })
  const knowledgeGrowth = createWorkspaceKnowledgeGrowthSnapshot({
    workspaceId: workspace.id,
    createdAt: 'request-time',
    approvedKnowledge,
    pendingKnowledge,
    rejectedKnowledge,
    knowledgeSources: [...persistedSources, ...knowledgeSources],
    knowledgeGaps,
    recommendationHistory,
    confidence: confidenceAssessment,
  })

  return {
    id: `workspace-analysis-plan:${workspace.id}:${stableKey(question)}`,
    question,
    domains: resolution.detectedDomains,
    requestedDomains,
    inspectedDomains,
    partialDomains,
    unavailableDomains,
    objective: objectiveForResolution(resolution),
    steps: usableTools.map((toolDefinition, index) => ({
      order: index + 1,
      purpose: toolDefinition.description,
      toolId: toolDefinition.id,
      validatedInput: {
        workspaceId: workspace.id,
        timezone: workspace.timezone,
      },
      dependencies: [],
      status: 'ready',
    })),
    requiredTools: usableTools
      .slice(0, 4)
      .map((toolDefinition) => toolDefinition.id),
    optionalTools: usableTools
      .slice(4)
      .map((toolDefinition) => toolDefinition.id),
    missingData,
    known: confidenceAssessment.known,
    unknown: confidenceAssessment.unknown,
    knowledgeGaps,
    confidenceAssessment,
    knowledgeGrowth,
    assumptions,
    safety: [
      'No business records are mutated.',
      'No provider credentials or secrets are exposed.',
      'Claims must remain tied to deterministic evidence or explicit uncertainty.',
      'AI may only use approved workspace knowledge, authoritative data, connected integrations, or verified deterministic rules.',
    ],
    status: resolution.clarificationRequired
      ? 'requires-clarification'
      : 'valid',
  }
}

function selectWorkspaceKnowledgeTools({
  tools,
  requestedDomains,
  limit,
}: {
  tools: WorkspaceKnowledgeToolDefinition[]
  requestedDomains: WorkspaceKnowledgeDomain[]
  limit: number
}) {
  if (requestedDomains.length <= 1) {
    return tools.slice(0, limit)
  }

  const selected: WorkspaceKnowledgeToolDefinition[] = []
  const selectedIds = new Set<string>()
  for (const domain of requestedDomains) {
    const domainTool = tools.find(
      (toolDefinition) =>
        toolDefinition.domain === domain && !selectedIds.has(toolDefinition.id),
    )
    if (!domainTool) continue
    selected.push(domainTool)
    selectedIds.add(domainTool.id)
    if (selected.length >= limit) return selected
  }

  for (const toolDefinition of tools) {
    if (selectedIds.has(toolDefinition.id)) continue
    selected.push(toolDefinition)
    selectedIds.add(toolDefinition.id)
    if (selected.length >= limit) break
  }
  return selected
}

export function buildWorkspaceInvestigationClaims({
  resolution,
  plan,
}: {
  resolution: WorkspaceAIIntentResolution
  plan: WorkspaceAIAnalysisPlan
}): WorkspaceAIClaim[] {
  return [
    {
      id: `${plan.id}:claim:confirmed-routing`,
      text: `Skillify routed this as ${resolution.capability} across ${resolution.detectedDomains.join(', ')}.`,
      type: 'CONFIRMED',
      confidence: resolution.confidence,
      supportingReferenceIds: [],
      supportingToolResultIds: plan.steps.map((step) => step.toolId),
      limitations: [],
    },
    ...(plan.steps.length > 0
      ? [
          {
            id: `${plan.id}:claim:coverage`,
            text:
              plan.partialDomains.length || plan.unavailableDomains.length
                ? `Largest findings are limited to currently available data from ${plan.inspectedDomains.join(', ') || 'registered tools'}.`
                : `Registered tools inspected ${plan.inspectedDomains.join(', ') || 'workspace'} data for this question.`,
            type: 'DATA_QUALITY_LIMITATION' as const,
            confidence:
              plan.partialDomains.length || plan.unavailableDomains.length
                ? ('medium' as const)
                : ('high' as const),
            supportingReferenceIds: [],
            supportingToolResultIds: plan.steps.map((step) => step.toolId),
            limitations: [
              ...plan.partialDomains.map(
                (domain) => `${domain} intelligence is partial`,
              ),
              ...plan.unavailableDomains.map(
                (domain) => `${domain} data is unavailable`,
              ),
            ],
          },
        ]
      : []),
    {
      id: `${plan.id}:claim:limitations`,
      text: plan.missingData.length
        ? `Some data is unavailable: ${plan.missingData.join(', ')}.`
        : 'Available registered tools can inspect this question without live execution.',
      type: plan.missingData.length ? 'UNKNOWN' : 'CONFIRMED',
      confidence: plan.missingData.length ? 'medium' : 'high',
      supportingReferenceIds: [],
      supportingToolResultIds: [],
      limitations: plan.missingData,
    },
  ]
}

function buildResolution({
  prompt,
  routingMode,
  primaryDomain,
  detectedDomains = [primaryDomain],
  matchedIntent,
  capability,
  confidence,
  contextReferences,
  requiredContext = [],
  missingContext = [],
  clarificationQuestion,
  allowedProposalTypes = [],
  reasonCodes,
}: {
  prompt: string
  routingMode: WorkspaceAIRoutingMode
  primaryDomain: WorkspaceKnowledgeDomain
  detectedDomains?: WorkspaceKnowledgeDomain[]
  matchedIntent: WorkspaceIntelligenceIntent
  capability: WorkspaceAICapability
  confidence: 'low' | 'medium' | 'high'
  contextReferences: Array<{ kind?: string; id: string; label?: string }>
  requiredContext?: string[]
  missingContext?: string[]
  clarificationQuestion?: string
  allowedProposalTypes?: string[]
  reasonCodes: string[]
}): WorkspaceAIIntentResolution {
  const allowedKnowledgeTools = toolsForDomains(detectedDomains, prompt)
  return {
    routingMode,
    detectedDomains: [...new Set(detectedDomains)],
    primaryDomain,
    matchedIntent,
    capability,
    confidence,
    requiredContext,
    availableContext: contextReferences.map(
      (reference) => `${reference.kind ?? 'context'}:${reference.id}`,
    ),
    missingContext,
    clarificationRequired: missingContext.length > 0,
    clarificationQuestion,
    allowedKnowledgeTools,
    allowedProposalTypes,
    reasonCodes,
  }
}

function toolsForDomains(domains: WorkspaceKnowledgeDomain[], prompt: string) {
  const normalized = prompt.toLowerCase()
  const expanded = new Set(domains)
  if (normalized.includes('growth') || normalized.includes('customer')) {
    expanded.add('crm')
    expanded.add('serviceRequests')
    expanded.add('tasks')
    expanded.add('marketing')
  }
  if (normalized.includes('automation') || normalized.includes('workflow')) {
    expanded.add('automation')
    expanded.add('workflowBuilder')
    expanded.add('integrations')
  }
  if (normalized.includes('ready') || normalized.includes('setup')) {
    expanded.add('workspace')
    expanded.add('integrations')
  }
  return workspaceKnowledgeToolCatalog
    .filter((toolDefinition) => expanded.has(toolDefinition.domain))
    .map((toolDefinition) => toolDefinition.id)
}

function detectWorkspaceDomains(text: string): WorkspaceKnowledgeDomain[] {
  const domains: WorkspaceKnowledgeDomain[] = []
  if (serviceRequestTerms.test(text)) domains.push('serviceRequests')
  if (taskTerms.test(text)) domains.push('tasks')
  if (projectTerms.test(text)) domains.push('projects')
  if (automationTerms.test(text)) domains.push('automation', 'workflowBuilder')
  if (integrationTerms.test(text)) domains.push('integrations')
  if (memberTerms.test(text)) domains.push('members', 'teams')
  if (readinessTerms.test(text)) domains.push('workspace')
  if (growthTerms.test(text)) domains.push('crm', 'marketing', 'finance')
  if (bottleneckTerms.test(text))
    domains.push('operations', 'tasks', 'scheduling')
  return [...new Set(domains)]
}

function domainForIntent(
  intent: WorkspaceIntelligenceIntent,
): WorkspaceKnowledgeDomain | null {
  if (intent.startsWith('scheduling.')) return 'scheduling'
  if (intent.startsWith('crm.')) return 'crm'
  if (intent.startsWith('workflow.')) return 'workflowBuilder'
  if (intent.startsWith('tasks.')) return 'tasks'
  if (intent.startsWith('projects.')) return 'projects'
  if (intent.startsWith('commerce.')) return 'commerce'
  if (intent === 'workspace.investigateQuestion') return 'workspace'
  return null
}

function capabilityForIntent(
  intent: WorkspaceIntelligenceIntent,
): WorkspaceAICapability {
  if (intent.includes('find') || intent.includes('recommend'))
    return 'recommendNextActions'
  if (intent.includes('explain')) return 'explain'
  if (intent.includes('summar') || intent.includes('balanceWorkload'))
    return 'summarize'
  if (intent.includes('analyze')) return 'investigate'
  return 'investigate'
}

function objectiveForResolution(resolution: WorkspaceAIIntentResolution) {
  if (resolution.capability === 'identifyBottlenecks') {
    return 'Identify the operational bottleneck using registered read-only workspace tools.'
  }
  if (resolution.capability === 'recommendNextActions') {
    return 'Prepare evidence-backed next-action guidance without executing changes.'
  }
  return 'Investigate the workspace question using deterministic evidence and explicit limitations.'
}

function missingDataForResolution(resolution: WorkspaceAIIntentResolution) {
  const missing = [...resolution.missingContext]
  if (resolution.detectedDomains.includes('serviceRequests')) {
    missing.push(
      'authoritative Service Request priority, SLA, and request-status data',
    )
  }
  if (resolution.detectedDomains.includes('tasks')) {
    missing.push('authoritative task dependency/blocker links')
  }
  if (resolution.detectedDomains.includes('automation')) {
    missing.push(
      'authoritative automation failure logs and normalized run-error categories',
    )
  }
  if (resolution.detectedDomains.includes('marketing')) {
    missing.push('connected advertising spend and attribution data')
  }
  if (resolution.detectedDomains.includes('finance')) {
    missing.push('authoritative finance and margin data')
  }
  return [...new Set(missing)]
}

function categoryForMissingData(item: string) {
  const normalized = item.toLowerCase()
  if (
    normalized.includes('advertising') ||
    normalized.includes('attribution')
  ) {
    return 'marketingPreferences' as const
  }
  if (normalized.includes('finance') || normalized.includes('margin')) {
    return 'financialAssumptions' as const
  }
  if (normalized.includes('sla') || normalized.includes('priority')) {
    return 'priorityRules' as const
  }
  if (normalized.includes('task dependency')) {
    return 'operatingGuidelines' as const
  }
  if (normalized.includes('automation')) {
    return 'automationPreferences' as const
  }
  return 'dataQuality' as const
}

function severityForMissingData(item: string) {
  const normalized = item.toLowerCase()
  if (
    normalized.includes('finance') ||
    normalized.includes('margin') ||
    normalized.includes('sla')
  ) {
    return 'high' as const
  }
  if (normalized.includes('advertising') || normalized.includes('automation')) {
    return 'medium' as const
  }
  return 'low' as const
}

function domainsForMissingData(
  item: string,
  fallbackDomains: WorkspaceKnowledgeDomain[],
): WorkspaceKnowledgeDomain[] {
  const normalized = item.toLowerCase()
  if (
    normalized.includes('advertising') ||
    normalized.includes('attribution')
  ) {
    return ['marketing']
  }
  if (normalized.includes('finance') || normalized.includes('margin')) {
    return ['finance']
  }
  if (normalized.includes('service request') || normalized.includes('sla')) {
    return ['serviceRequests']
  }
  if (normalized.includes('task')) {
    return ['tasks']
  }
  if (normalized.includes('automation')) {
    return ['automation', 'workflowBuilder']
  }
  return fallbackDomains.length ? fallbackDomains : ['workspace']
}

function integrationsForMissingData(item: string): string[] {
  const normalized = item.toLowerCase()
  if (
    normalized.includes('advertising') ||
    normalized.includes('attribution')
  ) {
    return ['Ad platform integration', 'Marketing attribution integration']
  }
  if (normalized.includes('finance') || normalized.includes('margin')) {
    return ['Accounting integration', 'Revenue and margin integration']
  }
  if (normalized.includes('sla') || normalized.includes('service request')) {
    return ['Service request system', 'SLA policy configuration']
  }
  if (normalized.includes('automation')) {
    return ['Automation run history']
  }
  return []
}

function configurationForMissingData(item: string): string[] {
  const normalized = item.toLowerCase()
  if (normalized.includes('assignment') || normalized.includes('staffing')) {
    return ['Define workspace assignment preferences']
  }
  if (normalized.includes('sla') || normalized.includes('priority')) {
    return ['Configure service priority and SLA rules']
  }
  if (normalized.includes('task dependency')) {
    return ['Connect task dependency and blocker relationships']
  }
  if (normalized.includes('automation')) {
    return ['Enable normalized automation failure categories']
  }
  return ['Connect or configure the authoritative source for this data']
}

function tool(
  id: string,
  domain: WorkspaceKnowledgeDomain,
  description: string,
  requiredPermissions: string[],
  availability: WorkspaceKnowledgeToolAvailability,
  supportsDateRange: boolean,
): WorkspaceKnowledgeToolDefinition {
  return {
    id,
    domain,
    description,
    requiredPermissions,
    requiredContext: ['workspaceId'],
    inputSchema: { type: 'object', required: ['workspaceId'] },
    outputSchema: { type: 'object' },
    availability,
    authoritativeSource:
      availability === 'deferred'
        ? 'future-provider-contract'
        : `${domain}-authoritative-source`,
    dataFreshness: availability === 'deferred' ? 'future' : 'request-time',
    costClass: 'low',
    supportsDateRange,
    supportsSelectedRecords: true,
    readOnly: true,
  }
}

function stableKey(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'question'
  )
}

const schedulingTerms =
  /\b(schedule|scheduling|appointment|calendar|technician|dispatch|availability|workload)\b/
const technicianTerms =
  /\b(assign|technician|member|who should|best tech|take this appointment)\b/
const conflictTerms =
  /\b(conflict|overlap|unavailable|double[- ]book|time off)\b/
const summarizeTerms = /\b(summarize|summary|overview|what.*schedule)\b/
const crmTerms = /\b(crm|lead|opportunit|pipeline|client|follow[- ]?up|sales)\b/
const crmPipelineTerms = /\b(pipeline|opportunit|sales)\b/
const serviceRequestTerms =
  /\b(service requests?|requests?|customers? waiting|waiting longer)\b/
const taskTerms = /\b(task|checklist|blocked|blocking)\b/
const projectTerms = /\b(project|milestone|budget)\b/
const automationTerms = /\b(automation|workflow|run failed|failing)\b/
const integrationTerms =
  /\b(integration|provider|connection|calendar unavailable|sms|email)\b/
const memberTerms = /\b(member|team|technician|overloaded|department)\b/
const readinessTerms =
  /\b(readiness|ready|setup|configure|blocking scheduling)\b/
const growthTerms =
  /\b(growth|growing|revenue|profit|ad source|campaign|customers|sales are not)\b/
const bottleneckTerms =
  /\b(bottleneck|hurting|behind|overloaded|focus|what should.*focus)\b/
