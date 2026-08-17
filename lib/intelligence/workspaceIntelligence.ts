import {
  getCRMKnowledgeContext,
  getCRMKnowledgeExplanation,
  getCRMKnowledgeRecommendations,
  getCRMKnowledgeSnapshot,
  type CRMKnowledgeSource,
  type CRMRecommendation,
  type CRMReference,
} from '@/lib/crm/knowledge'
import {
  getSchedulingContext,
  getSchedulingExplanation,
  getSchedulingRecommendations,
  getSchedulingSnapshot,
  schedulingKnowledgeCapabilityRegistry,
  type SchedulingKnowledgeInput,
  type SchedulingKnowledgeIntent,
  type SchedulingRecommendationCandidate,
} from '@/lib/scheduling/schedulingKnowledge'

export type WorkspaceKnowledgeDomain =
  | 'scheduling'
  | 'workflow'
  | 'crm'
  | 'workspace'
  | 'serviceRequests'
  | 'projects'
  | 'tasks'
  | 'members'
  | 'teams'
  | 'locations'
  | 'integrations'
  | 'notifications'
  | 'permissions'
  | 'commerce'
  | 'reports'
  | 'settings'
  | 'documents'
  | 'automation'
  | 'workflowBuilder'
  | 'marketing'
  | 'finance'
  | 'operations'

export type WorkspaceIntelligenceIntent =
  | 'scheduling.findBestMember'
  | 'scheduling.findBestTeam'
  | 'scheduling.findAvailableSlot'
  | 'scheduling.findRecurringSlot'
  | 'scheduling.explainConflict'
  | 'scheduling.explainAssignment'
  | 'scheduling.explainUnavailable'
  | 'scheduling.rescheduleAppointment'
  | 'scheduling.assignEvent'
  | 'scheduling.balanceWorkload'
  | 'workflow.generate'
  | 'workflow.explain'
  | 'workflow.analyzeRun'
  | 'crm.explainRecord'
  | 'crm.analyzePipeline'
  | 'crm.prioritizeLeads'
  | 'crm.analyzeFollowUps'
  | 'crm.analyzeOpportunities'
  | 'crm.recommendNextActions'
  | 'crm.analyzeDataQuality'
  | 'projects.summarize'
  | 'tasks.recommendPriorities'
  | 'commerce.explainOrder'
  | 'commerce.analyzeCustomer'
  | 'reports.explainMetric'
  | 'search.lookup'
  | 'knowledge.resolve'
  | 'workspace.investigateQuestion'
  | 'recommendation.general'
  | 'explanation.general'
  | 'summarization.general'
  | 'analysis.general'

export type WorkspaceIntelligenceCapabilityKey =
  | 'supportsContext'
  | 'supportsSnapshot'
  | 'supportsRecommendations'
  | 'supportsExplanation'
  | 'supportsSearch'
  | 'supportsSchedulingRecommendations'
  | 'supportsSchedulingAvailability'
  | 'supportsSchedulingConflicts'
  | 'supportsWorkflowGeneration'
  | 'supportsWorkflowExplanation'
  | 'supportsAutomation'
  | 'supportsCRMAnalysis'
  | 'supportsCRMOverview'
  | 'supportsLeadPrioritization'
  | 'supportsFollowUpAnalysis'
  | 'supportsOpportunityRisk'
  | 'supportsPipelineAnalysis'
  | 'supportsClientContext'
  | 'supportsCRMDataQuality'
  | 'supportsCRMRecommendations'
  | 'supportsCommerceAnalysis'
  | 'supportsReporting'
  | 'supportsProjectAnalysis'
  | 'supportsTaskAnalysis'
  | 'supportsKnowledgeReferences'
  | 'supportsWorkspaceInvestigation'

export type WorkspaceIntelligenceCapability = {
  key: WorkspaceIntelligenceCapabilityKey
  label: string
  supported: boolean
  providerId: WorkspaceKnowledgeProviderId
  sourceCapability?: string
}

export type WorkspaceKnowledgeProviderId = 'scheduling' | 'crm'

export type WorkspacePermissionBoundary = {
  strategy: 'provider-filtered'
  description: string
  requiredPermissions: string[]
}

export type WorkspaceKnowledgeReference = {
  id: string
  providerId: WorkspaceKnowledgeProviderId
  domain: WorkspaceKnowledgeDomain
  kind: 'context' | 'snapshot' | 'recommendation' | 'explanation' | 'metadata'
  label: string
  scope: 'workspace' | 'member' | 'team' | 'record' | 'provider'
  fingerprint?: string
  createdAt?: string
}

export type WorkspaceRecommendation = {
  id: string
  providerId: WorkspaceKnowledgeProviderId
  intent: WorkspaceIntelligenceIntent
  subject: {
    id: string
    type: string
    label: string
  }
  /**
   * Deterministic recommendation score on an inclusive 0-100 scale.
   * Consumers should format it directly as a percent and must not multiply it.
   */
  score: number
  confidence: 'low' | 'medium' | 'high'
  reasons: WorkspaceRecommendationReason[]
  warnings: WorkspaceRecommendationWarning[]
  references: WorkspaceKnowledgeReference[]
  metadata?: Record<string, unknown>
}

export type WorkspaceRecommendationReason = {
  code: string
  label: string
  source: string
}

export type WorkspaceRecommendationWarning = {
  code: string
  label: string
  source: string
  severity: 'info' | 'warning' | 'blocking'
}

export type NormalizedWorkspaceRecommendationSubject = {
  /**
   * Present only when the recommendation resolved a real workspace entity.
   * Display-only fallback subjects intentionally do not invent entity IDs.
   */
  id?: string
  type: string
  label: string
  authoritative: boolean
}

export type NormalizedWorkspaceRecommendation = Omit<
  WorkspaceRecommendation,
  'subject' | 'confidence' | 'reasons' | 'warnings' | 'references'
> & {
  title: string
  summary: string
  kind: string
  subject: NormalizedWorkspaceRecommendationSubject
  confidence: 'low' | 'medium' | 'high' | 'unknown'
  priority: 'low' | 'medium' | 'high' | 'unknown'
  reasons: WorkspaceRecommendationReason[]
  warnings: WorkspaceRecommendationWarning[]
  references: WorkspaceKnowledgeReference[]
  evidence: WorkspaceKnowledgeReference[]
  dependencies: string[]
  proposedAction?: unknown
  rawRecommendation?: unknown
}

export type WorkspaceRecommendationNormalizationDiagnostic = {
  requestId?: string
  producer?: string
  providerId?: WorkspaceKnowledgeProviderId
  domain: WorkspaceKnowledgeDomain | 'unknown'
  recommendationId: string
  originalShape: {
    type: string
    keys: string[]
    subjectType: string
    subjectKeys: string[]
  }
  repairedFields: string[]
  defaultedFields: string[]
  subjectAuthority: 'authoritative' | 'display-only'
}

export type WorkspaceRecommendationNormalizationResult = {
  recommendations: NormalizedWorkspaceRecommendation[]
  diagnostics: WorkspaceRecommendationNormalizationDiagnostic[]
}

export type WorkspaceExplanation = {
  id: string
  providerId: WorkspaceKnowledgeProviderId
  intent: WorkspaceIntelligenceIntent
  subject: {
    id: string
    type: string
    label?: string
  }
  summary: string
  confidence: 'low' | 'medium' | 'high'
  reasons: WorkspaceRecommendationReason[]
  warnings: WorkspaceRecommendationWarning[]
  references: WorkspaceKnowledgeReference[]
  metadata?: Record<string, unknown>
}

export type WorkspaceIntelligenceWorkspace = {
  id: string
  slug?: string
  name?: string
  timezone: string
  businessModel?: string
  enabledModules?: string[]
  branding?: {
    name?: string
    primaryColor?: string
  }
  organization?: {
    industry?: string
    size?: string
  }
}

export type WorkspaceIntelligenceActor = {
  userId?: string
  workspaceMemberId?: string
  role?: string
  permissions: string[]
  language?: string
}

export type WorkspaceSystemHealth = {
  status: 'ready' | 'degraded' | 'unavailable'
  warnings: string[]
}

export type WorkspaceIntelligenceContext = {
  workspace: WorkspaceIntelligenceWorkspace
  actor: WorkspaceIntelligenceActor
  language: string
  enabledModules: string[]
  availableProviders: KnowledgeProviderMetadata[]
  capabilities: WorkspaceIntelligenceCapability[]
  systemHealth: WorkspaceSystemHealth
}

export type WorkspaceSnapshot = {
  id: string
  workspaceId: string
  createdAt: string
  providerSnapshots: WorkspaceProviderSnapshot[]
  references: WorkspaceKnowledgeReference[]
  fingerprint: string
}

export type WorkspaceProviderSnapshot = {
  providerId: WorkspaceKnowledgeProviderId
  domain: WorkspaceKnowledgeDomain
  snapshot: unknown
  reference: WorkspaceKnowledgeReference
}

export type WorkspaceState = {
  workspaceId: string
  createdAt: string
  contextReferenceIds: string[]
  snapshotReferenceIds: string[]
  note: 'deterministic-workspace-state'
}

export type WorkspaceToolMetadata = {
  id: string
  label: string
  supportedIntents: WorkspaceIntelligenceIntent[]
  requiredCapabilities: WorkspaceIntelligenceCapabilityKey[]
  requiredPermissions: string[]
  supportedProviderIds: WorkspaceKnowledgeProviderId[]
  executes: false
}

export type KnowledgeProviderMetadata = {
  id: WorkspaceKnowledgeProviderId
  label: string
  domain: WorkspaceKnowledgeDomain
  supportedIntents: WorkspaceIntelligenceIntent[]
  capabilities: WorkspaceIntelligenceCapability[]
  permissionBoundary: WorkspacePermissionBoundary
  sourceAvailability: 'source-required' | 'always-available'
  description: string
}

export type WorkspaceKnowledgeProviderInput<TSource = unknown> = {
  workspaceContext: WorkspaceIntelligenceContext
  requestedIntent: WorkspaceIntelligenceIntent
  source: TSource
}

export type WorkspaceRecommendationRequest = {
  intent: WorkspaceIntelligenceIntent
  rangeStart?: Date
  rangeEnd?: Date
  memberId?: string
  teamId?: string
  locationId?: string | null
  dateKey?: string
  durationMinutes?: number
}

export type WorkspaceExplanationRequest = {
  intent: WorkspaceIntelligenceIntent
  recommendation: WorkspaceRecommendation
}

export type KnowledgeProvider<TContext = unknown, TSnapshot = unknown> = {
  id: WorkspaceKnowledgeProviderId
  label: string
  domain: WorkspaceKnowledgeDomain
  capabilities: WorkspaceIntelligenceCapability[]
  supportedIntents: WorkspaceIntelligenceIntent[]
  permissionBoundary: WorkspacePermissionBoundary
  getMetadata: () => KnowledgeProviderMetadata
  supportsIntent: (intent: WorkspaceIntelligenceIntent) => boolean
  getContext: (input: WorkspaceKnowledgeProviderInput) => TContext
  getSnapshot: (input: WorkspaceKnowledgeProviderInput) => TSnapshot
  getRecommendations?: (
    input: WorkspaceKnowledgeProviderInput,
    request: WorkspaceRecommendationRequest,
  ) => WorkspaceRecommendation[]
  getExplanation?: (
    input: WorkspaceKnowledgeProviderInput,
    request: WorkspaceExplanationRequest,
  ) => WorkspaceExplanation | null
}

export type KnowledgeProviderRegistry = {
  list: () => KnowledgeProvider[]
  get: (providerId: WorkspaceKnowledgeProviderId) => KnowledgeProvider | null
  getMetadata: () => KnowledgeProviderMetadata[]
  getCapabilities: () => WorkspaceIntelligenceCapability[]
  providersForIntent: (
    intent: WorkspaceIntelligenceIntent,
  ) => KnowledgeProvider[]
}

export type WorkspaceContextAssemblerRequest = {
  workspace: WorkspaceIntelligenceWorkspace
  actor: WorkspaceIntelligenceActor
  requestedIntent: WorkspaceIntelligenceIntent
  providers?: KnowledgeProviderRegistry
  providerSources?: Partial<Record<WorkspaceKnowledgeProviderId, unknown>>
  language?: string
  systemHealth?: WorkspaceSystemHealth
}

export type WorkspaceContextAssemblerResult = {
  intent: WorkspaceIntelligenceIntent
  context: WorkspaceIntelligenceContext
  providerContexts: WorkspaceProviderContext[]
  providerSnapshots: WorkspaceProviderSnapshot[]
  references: WorkspaceKnowledgeReference[]
  state: WorkspaceState
  warnings: string[]
  fingerprint: string
}

export type WorkspaceProviderContext = {
  providerId: WorkspaceKnowledgeProviderId
  domain: WorkspaceKnowledgeDomain
  context: unknown
  reference: WorkspaceKnowledgeReference
}

type SchedulingProviderIntentMap = Record<
  Extract<WorkspaceKnowledgeProviderId, 'scheduling'>,
  Partial<Record<WorkspaceIntelligenceIntent, SchedulingKnowledgeIntent>>
>

type CRMProviderIntentMap = Record<
  Extract<WorkspaceKnowledgeProviderId, 'crm'>,
  Partial<Record<WorkspaceIntelligenceIntent, true>>
>

const schedulingIntentMap: SchedulingProviderIntentMap = {
  scheduling: {
    'scheduling.findBestMember': 'findBestMember',
    'scheduling.findBestTeam': 'findBestTeam',
    'scheduling.findAvailableSlot': 'findAvailableSlot',
    'scheduling.findRecurringSlot': 'findRecurringSlot',
    'scheduling.explainConflict': 'explainSchedulingConflict',
    'scheduling.explainAssignment': 'explainAssignment',
    'scheduling.explainUnavailable': 'explainUnavailable',
    'scheduling.rescheduleAppointment': 'rescheduleAppointment',
    'scheduling.assignEvent': 'assignEvent',
    'scheduling.balanceWorkload': 'balanceWorkload',
    'workspace.investigateQuestion': 'balanceWorkload',
  },
}

const crmIntentMap: CRMProviderIntentMap = {
  crm: {
    'crm.explainRecord': true,
    'crm.analyzePipeline': true,
    'crm.prioritizeLeads': true,
    'crm.analyzeFollowUps': true,
    'crm.analyzeOpportunities': true,
    'crm.recommendNextActions': true,
    'crm.analyzeDataQuality': true,
    'workspace.investigateQuestion': true,
  },
}

const schedulingCapabilities: WorkspaceIntelligenceCapability[] = [
  {
    key: 'supportsContext',
    label: 'Deterministic scheduling context',
    supported: true,
    providerId: 'scheduling',
  },
  {
    key: 'supportsSnapshot',
    label: 'Scheduling snapshots',
    supported: true,
    providerId: 'scheduling',
    sourceCapability: 'supportsSnapshots',
  },
  {
    key: 'supportsRecommendations',
    label: 'Scheduling recommendations',
    supported: true,
    providerId: 'scheduling',
    sourceCapability: 'supportsRecommendation',
  },
  {
    key: 'supportsExplanation',
    label: 'Scheduling explanations',
    supported: true,
    providerId: 'scheduling',
    sourceCapability: 'supportsExplanation',
  },
  {
    key: 'supportsSchedulingRecommendations',
    label: 'Member, team, slot, and reassignment recommendations',
    supported: true,
    providerId: 'scheduling',
  },
  {
    key: 'supportsSchedulingAvailability',
    label: 'Availability-aware scheduling intelligence',
    supported: true,
    providerId: 'scheduling',
    sourceCapability: 'supportsAvailability',
  },
  {
    key: 'supportsSchedulingConflicts',
    label: 'Conflict analysis',
    supported: true,
    providerId: 'scheduling',
    sourceCapability: 'supportsConflictAnalysis',
  },
  {
    key: 'supportsKnowledgeReferences',
    label: 'Scheduling knowledge references',
    supported: true,
    providerId: 'scheduling',
  },
  {
    key: 'supportsWorkspaceInvestigation',
    label: 'Workspace investigation support',
    supported: true,
    providerId: 'scheduling',
  },
]

const crmCapabilities: WorkspaceIntelligenceCapability[] = [
  {
    key: 'supportsContext',
    label: 'Deterministic CRM context',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsSnapshot',
    label: 'CRM snapshots',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsRecommendations',
    label: 'CRM recommendations',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsExplanation',
    label: 'CRM explanations',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsCRMAnalysis',
    label: 'CRM analysis',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsCRMOverview',
    label: 'CRM overview facts',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsLeadPrioritization',
    label: 'Lead prioritization',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsFollowUpAnalysis',
    label: 'Follow-up analysis',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsOpportunityRisk',
    label: 'Opportunity risk analysis',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsPipelineAnalysis',
    label: 'Pipeline analysis',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsClientContext',
    label: 'Client context',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsCRMDataQuality',
    label: 'CRM data quality checks',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsCRMRecommendations',
    label: 'CRM next-action recommendations',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsKnowledgeReferences',
    label: 'CRM knowledge references',
    supported: true,
    providerId: 'crm',
  },
  {
    key: 'supportsWorkspaceInvestigation',
    label: 'Workspace investigation support',
    supported: true,
    providerId: 'crm',
  },
]

export const workspaceIntelligenceToolRegistry: WorkspaceToolMetadata[] = [
  {
    id: 'workspace-intelligence.context.assemble',
    label: 'Assemble workspace context',
    supportedIntents: [
      'scheduling.findBestMember',
      'scheduling.findBestTeam',
      'scheduling.findAvailableSlot',
      'scheduling.explainConflict',
      'knowledge.resolve',
      'workspace.investigateQuestion',
      'analysis.general',
    ],
    requiredCapabilities: ['supportsContext', 'supportsKnowledgeReferences'],
    requiredPermissions: ['workspace:read'],
    supportedProviderIds: ['scheduling'],
    executes: false,
  },
  {
    id: 'workspace-intelligence.crm-context.assemble',
    label: 'Assemble CRM workspace context',
    supportedIntents: [
      'crm.explainRecord',
      'crm.analyzePipeline',
      'crm.prioritizeLeads',
      'crm.analyzeFollowUps',
      'crm.analyzeOpportunities',
      'crm.recommendNextActions',
      'crm.analyzeDataQuality',
      'workspace.investigateQuestion',
    ],
    requiredCapabilities: ['supportsContext', 'supportsKnowledgeReferences'],
    requiredPermissions: ['workspace:read'],
    supportedProviderIds: ['crm'],
    executes: false,
  },
  {
    id: 'workspace-intelligence.recommendations.resolve',
    label: 'Resolve deterministic scheduling recommendations',
    supportedIntents: [
      'scheduling.findBestMember',
      'scheduling.findBestTeam',
      'scheduling.findAvailableSlot',
      'scheduling.findRecurringSlot',
      'workspace.investigateQuestion',
    ],
    requiredCapabilities: [
      'supportsRecommendations',
      'supportsSchedulingRecommendations',
    ],
    requiredPermissions: ['workspace:read'],
    supportedProviderIds: ['scheduling'],
    executes: false,
  },
  {
    id: 'workspace-intelligence.crm-recommendations.resolve',
    label: 'Resolve deterministic CRM recommendations',
    supportedIntents: [
      'crm.prioritizeLeads',
      'crm.analyzeFollowUps',
      'crm.analyzeOpportunities',
      'crm.recommendNextActions',
      'crm.analyzeDataQuality',
      'workspace.investigateQuestion',
    ],
    requiredCapabilities: [
      'supportsRecommendations',
      'supportsCRMRecommendations',
    ],
    requiredPermissions: ['workspace:read'],
    supportedProviderIds: ['crm'],
    executes: false,
  },
  {
    id: 'workspace-intelligence.explanations.resolve',
    label: 'Resolve deterministic explanations',
    supportedIntents: [
      'scheduling.explainConflict',
      'scheduling.explainAssignment',
      'scheduling.explainUnavailable',
      'crm.explainRecord',
      'explanation.general',
    ],
    requiredCapabilities: ['supportsExplanation'],
    requiredPermissions: ['workspace:read'],
    supportedProviderIds: ['scheduling', 'crm'],
    executes: false,
  },
]

export function createKnowledgeProviderRegistry(
  providers: KnowledgeProvider[] = [
    schedulingKnowledgeProvider,
    crmKnowledgeProvider,
  ],
): KnowledgeProviderRegistry {
  const providerMap = new Map(
    providers.map((provider) => [provider.id, provider]),
  )
  return {
    list: () => [...providerMap.values()],
    get: (providerId) => providerMap.get(providerId) ?? null,
    getMetadata: () =>
      [...providerMap.values()].map((provider) => provider.getMetadata()),
    getCapabilities: () =>
      [...providerMap.values()].flatMap((provider) => provider.capabilities),
    providersForIntent: (intent) =>
      [...providerMap.values()].filter((provider) =>
        provider.supportsIntent(intent),
      ),
  }
}

export const schedulingKnowledgeProvider: KnowledgeProvider<
  ReturnType<typeof getSchedulingContext>,
  ReturnType<typeof getSchedulingSnapshot>
> = {
  id: 'scheduling',
  label: 'Scheduling Knowledge',
  domain: 'scheduling',
  capabilities: schedulingCapabilities,
  supportedIntents: Object.keys(
    schedulingIntentMap.scheduling,
  ) as WorkspaceIntelligenceIntent[],
  permissionBoundary: {
    strategy: 'provider-filtered',
    description:
      'Scheduling filters members, teams, locations, events, availability, and external signals before context reaches the assembler.',
    requiredPermissions: ['scheduling:read'],
  },
  getMetadata() {
    return {
      id: this.id,
      label: this.label,
      domain: this.domain,
      supportedIntents: this.supportedIntents,
      capabilities: this.capabilities,
      permissionBoundary: this.permissionBoundary,
      sourceAvailability: 'source-required',
      description:
        'Deterministic scheduling context, snapshots, availability, conflicts, provider health, and recommendations.',
    }
  },
  supportsIntent(intent) {
    return intent in schedulingIntentMap.scheduling
  },
  getContext(input) {
    return getSchedulingContext(asSchedulingSource(input.source))
  },
  getSnapshot(input) {
    return getSchedulingSnapshot(asSchedulingSource(input.source))
  },
  getRecommendations(input, request) {
    const schedulingIntent = schedulingIntentMap.scheduling[request.intent]
    if (!isSchedulingRecommendationIntent(schedulingIntent)) return []
    const recommendations = getSchedulingRecommendations(
      asSchedulingSource(input.source),
      {
        intent: schedulingIntent,
        rangeStart: request.rangeStart,
        rangeEnd: request.rangeEnd,
        memberId: request.memberId,
        teamId: request.teamId,
        locationId: request.locationId,
        dateKey: request.dateKey,
        durationMinutes: request.durationMinutes,
      },
    )
    return recommendations.map((candidate) =>
      toWorkspaceRecommendation({
        candidate,
        intent: request.intent,
        providerId: 'scheduling',
        reference: schedulingRecommendationReference(candidate),
      }),
    )
  },
  getExplanation(_input, request) {
    const candidate = toSchedulingCandidate(request.recommendation)
    const explanation = getSchedulingExplanation(candidate)
    return {
      id: `explanation:scheduling:${request.recommendation.subject.id}:${request.intent}`,
      providerId: 'scheduling',
      intent: request.intent,
      subject: request.recommendation.subject,
      summary:
        explanation.warnings.length > 0
          ? 'The recommendation includes deterministic scheduling warnings.'
          : 'The recommendation is supported by deterministic scheduling context.',
      confidence: explanation.confidence,
      reasons: explanation.reasons,
      warnings: explanation.warnings,
      references: [
        ...request.recommendation.references,
        {
          id: `explanation:scheduling:${request.recommendation.subject.id}`,
          providerId: 'scheduling',
          domain: 'scheduling',
          kind: 'explanation',
          label:
            request.recommendation.subject.label ?? 'Scheduling explanation',
          scope: 'record',
        },
      ],
      metadata: {
        score: explanation.score,
        candidateType: explanation.candidateType,
      },
    }
  },
}

export const crmKnowledgeProvider: KnowledgeProvider<
  ReturnType<typeof getCRMKnowledgeContext>,
  ReturnType<typeof getCRMKnowledgeSnapshot>
> = {
  id: 'crm',
  label: 'CRM Knowledge',
  domain: 'crm',
  capabilities: crmCapabilities,
  supportedIntents: Object.keys(
    crmIntentMap.crm,
  ) as WorkspaceIntelligenceIntent[],
  permissionBoundary: {
    strategy: 'provider-filtered',
    description:
      'CRM filters leads, opportunities, clients, follow-ups, tasks, and activity by workspace and actor permissions before context reaches the assembler.',
    requiredPermissions: ['crm:read'],
  },
  getMetadata() {
    return {
      id: this.id,
      label: this.label,
      domain: this.domain,
      supportedIntents: this.supportedIntents,
      capabilities: this.capabilities,
      permissionBoundary: this.permissionBoundary,
      sourceAvailability: 'source-required',
      description:
        'Deterministic CRM facts, pipeline snapshots, risks, data-quality findings, and next-action recommendations.',
    }
  },
  supportsIntent(intent) {
    return intent in crmIntentMap.crm
  },
  getContext(input) {
    return getCRMKnowledgeContext(asCRMSource(input.source))
  },
  getSnapshot(input) {
    return getCRMKnowledgeSnapshot(asCRMSource(input.source))
  },
  getRecommendations(input, request) {
    if (!(request.intent in crmIntentMap.crm)) return []
    return getCRMKnowledgeRecommendations(asCRMSource(input.source))
      .filter((recommendation) =>
        crmRecommendationMatchesIntent(recommendation, request.intent),
      )
      .map((recommendation) =>
        toWorkspaceCRMRecommendation({
          recommendation,
          intent: request.intent,
        }),
      )
  },
  getExplanation(_input, request) {
    const crmRecommendation = request.recommendation.metadata?.crmRecommendation
    if (!isCRMRecommendation(crmRecommendation)) return null
    const explanation = getCRMKnowledgeExplanation(crmRecommendation)
    return {
      id: explanation.id,
      providerId: 'crm',
      intent: request.intent,
      subject: request.recommendation.subject,
      summary: explanation.summary,
      confidence: explanation.confidence,
      reasons: explanation.reasons,
      warnings: explanation.warnings.map((warning) => ({
        code: warning.category,
        label: warning.explanation,
        source: 'crm-knowledge-provider',
        severity: warning.severity,
      })),
      references: [
        ...request.recommendation.references,
        {
          id: `explanation:crm:${request.recommendation.subject.id}`,
          providerId: 'crm',
          domain: 'crm',
          kind: 'explanation',
          label: request.recommendation.subject.label ?? 'CRM explanation',
          scope: 'record',
        },
      ],
      metadata: explanation.metadata,
    }
  },
}

function asSchedulingSource(source: unknown): SchedulingKnowledgeInput {
  return source as SchedulingKnowledgeInput
}

function asCRMSource(source: unknown): CRMKnowledgeSource {
  return source as CRMKnowledgeSource
}

export const workspaceKnowledgeProviderRegistry =
  createKnowledgeProviderRegistry()

export function assembleContext({
  workspace,
  actor,
  requestedIntent,
  providers = workspaceKnowledgeProviderRegistry,
  providerSources = {},
  language,
  systemHealth,
}: WorkspaceContextAssemblerRequest): WorkspaceContextAssemblerResult {
  const context = createWorkspaceContext({
    workspace,
    actor,
    providers,
    language,
    systemHealth,
  })
  const matchingProviders = providers.providersForIntent(requestedIntent)
  const warnings: string[] = []
  const providerContexts: WorkspaceProviderContext[] = []
  const providerSnapshots: WorkspaceProviderSnapshot[] = []

  for (const provider of matchingProviders) {
    const source = providerSources[provider.id]
    if (!source) {
      warnings.push(
        `Provider ${provider.id} was selected but no source data was supplied.`,
      )
      continue
    }
    const providerInput = {
      workspaceContext: context,
      requestedIntent,
      source,
    }
    const providerContext = provider.getContext(providerInput)
    const contextReference = makeReference({
      providerId: provider.id,
      domain: provider.domain,
      kind: 'context',
      label: `${provider.label} context`,
      scope: 'provider',
      value: providerContext,
    })
    providerContexts.push({
      providerId: provider.id,
      domain: provider.domain,
      context: providerContext,
      reference: contextReference,
    })

    const snapshot = provider.getSnapshot(providerInput)
    const snapshotReference = makeReference({
      providerId: provider.id,
      domain: provider.domain,
      kind: 'snapshot',
      label: `${provider.label} snapshot`,
      scope: 'provider',
      value: snapshot,
    })
    providerSnapshots.push({
      providerId: provider.id,
      domain: provider.domain,
      snapshot,
      reference: snapshotReference,
    })
  }

  if (matchingProviders.length === 0) {
    warnings.push(
      `No registered knowledge provider supports intent ${requestedIntent}.`,
    )
  }

  const references = [
    ...providerContexts.map((item) => item.reference),
    ...providerSnapshots.map((item) => item.reference),
  ]
  const createdAt = referenceTimestamp(references)
  const state: WorkspaceState = {
    workspaceId: workspace.id,
    createdAt,
    contextReferenceIds: providerContexts.map((item) => item.reference.id),
    snapshotReferenceIds: providerSnapshots.map((item) => item.reference.id),
    note: 'deterministic-workspace-state',
  }

  return {
    intent: requestedIntent,
    context,
    providerContexts,
    providerSnapshots,
    references,
    state,
    warnings,
    fingerprint: stableFingerprint({
      intent: requestedIntent,
      workspaceId: workspace.id,
      actor: actor.workspaceMemberId ?? actor.userId ?? 'anonymous',
      providerReferences: references.map((reference) => [
        reference.id,
        reference.fingerprint,
      ]),
      warnings,
    }),
  }
}

export function resolveIntent(input: {
  intent?: WorkspaceIntelligenceIntent
  domain?: WorkspaceKnowledgeDomain
  action?: string
}): WorkspaceIntelligenceIntent {
  if (input.intent) return input.intent
  if (input.domain === 'scheduling' && input.action === 'recommend-member') {
    return 'scheduling.findBestMember'
  }
  if (input.domain === 'scheduling' && input.action === 'find-slot') {
    return 'scheduling.findAvailableSlot'
  }
  if (input.domain === 'workflow' && input.action === 'explain') {
    return 'workflow.explain'
  }
  if (input.domain === 'crm' && input.action === 'explain') {
    return 'crm.explainRecord'
  }
  if (input.domain === 'crm' && input.action === 'analyze-pipeline') {
    return 'crm.analyzePipeline'
  }
  if (input.domain === 'crm' && input.action === 'prioritize-leads') {
    return 'crm.prioritizeLeads'
  }
  if (input.domain === 'crm' && input.action === 'recommend-next-actions') {
    return 'crm.recommendNextActions'
  }
  return 'workspace.investigateQuestion'
}

export function resolveKnowledge(
  request: WorkspaceContextAssemblerRequest,
): WorkspaceContextAssemblerResult {
  return assembleContext(request)
}

export function resolveSnapshot(
  request: WorkspaceContextAssemblerRequest,
): WorkspaceSnapshot {
  const assembled = assembleContext(request)
  const createdAt = referenceTimestamp(assembled.references)
  return {
    id: `workspace-snapshot:${request.workspace.id}:${assembled.fingerprint.length}`,
    workspaceId: request.workspace.id,
    createdAt,
    providerSnapshots: assembled.providerSnapshots,
    references: assembled.providerSnapshots.map((item) => item.reference),
    fingerprint: stableFingerprint({
      workspaceId: request.workspace.id,
      intent: request.requestedIntent,
      snapshots: assembled.providerSnapshots.map((item) => [
        item.providerId,
        item.reference.fingerprint,
      ]),
    }),
  }
}

export function resolveRecommendations(
  request: WorkspaceContextAssemblerRequest & {
    recommendationRequest?: Partial<WorkspaceRecommendationRequest>
  },
): WorkspaceRecommendation[] {
  const providers = request.providers ?? workspaceKnowledgeProviderRegistry
  const matchingProviders = providers.providersForIntent(
    request.requestedIntent,
  )
  const context = createWorkspaceContext({
    workspace: request.workspace,
    actor: request.actor,
    providers,
    language: request.language,
    systemHealth: request.systemHealth,
  })
  return matchingProviders.flatMap((provider) => {
    const source = request.providerSources?.[provider.id]
    if (!source || !provider.getRecommendations) return []
    return provider.getRecommendations(
      {
        workspaceContext: context,
        requestedIntent: request.requestedIntent,
        source,
      },
      {
        intent: request.requestedIntent,
        ...request.recommendationRequest,
      },
    )
  })
}

export function resolveExplanation(
  request: WorkspaceContextAssemblerRequest & {
    recommendation: WorkspaceRecommendation
  },
): WorkspaceExplanation | null {
  const providers = request.providers ?? workspaceKnowledgeProviderRegistry
  const provider = providers.get(request.recommendation.providerId)
  const source = request.providerSources?.[request.recommendation.providerId]
  if (!provider?.getExplanation || !source) return null
  const context = createWorkspaceContext({
    workspace: request.workspace,
    actor: request.actor,
    providers,
    language: request.language,
    systemHealth: request.systemHealth,
  })
  return provider.getExplanation(
    {
      workspaceContext: context,
      requestedIntent: request.requestedIntent,
      source,
    },
    {
      intent: request.requestedIntent,
      recommendation: request.recommendation,
    },
  )
}

/**
 * Canonical recommendation boundary.
 *
 * Required after normalization: id, providerId, intent, display subject, score,
 * confidence, priority, title, summary, reasons, warnings, references, evidence,
 * and dependencies. `subject.authoritative` is the guardrail: false means the
 * subject exists only so UI and Operational Intelligence can describe the
 * recommendation without pretending a lead, event, member, client, opportunity,
 * or service request was resolved.
 */
export function normalizeWorkspaceRecommendations({
  recommendations,
  requestId,
  producer,
  fallbackIntent,
  fallbackProviderId,
}: {
  recommendations: unknown
  requestId?: string
  producer?: string
  fallbackIntent: WorkspaceIntelligenceIntent
  fallbackProviderId?: WorkspaceKnowledgeProviderId
}): WorkspaceRecommendationNormalizationResult {
  const source = Array.isArray(recommendations) ? recommendations : []
  const diagnostics: WorkspaceRecommendationNormalizationDiagnostic[] = []
  const normalized = source.map((item, index) => {
    const record = asRecommendationRecord(item)
    const subjectRecord = asRecommendationRecord(record.subject)
    const metadata = asRecommendationRecord(record.metadata)
    const crmRecommendation = asRecommendationRecord(metadata.crmRecommendation)
    const providerId = normalizeWorkspaceProviderId(
      record.providerId,
      fallbackProviderId,
    )
    const intent =
      typeof record.intent === 'string'
        ? (record.intent as WorkspaceIntelligenceIntent)
        : fallbackIntent
    const id =
      readNonEmptyString(record.id) ??
      `recommendation:${providerId}:${intent}:${index + 1}`
    const title =
      readNonEmptyString(record.title) ??
      readNonEmptyString(record.label) ??
      readNonEmptyString(crmRecommendation.title) ??
      readNonEmptyString(subjectRecord.label) ??
      fallbackRecommendationTitle({ providerId, intent })
    const summary =
      readNonEmptyString(record.summary) ??
      readNonEmptyString(record.explanation) ??
      readNonEmptyString(crmRecommendation.summary) ??
      title
    const subjectLabel =
      readNonEmptyString(subjectRecord.label) ??
      readNonEmptyString(record.targetLabel) ??
      readNonEmptyString(crmRecommendation.targetLabel) ??
      title
    const subjectId =
      readNonEmptyString(subjectRecord.id) ??
      readNonEmptyString(record.targetRecordId) ??
      readNonEmptyString(crmRecommendation.targetRecordId)
    const subjectType =
      readNonEmptyString(subjectRecord.type) ??
      readNonEmptyString(record.targetRecordType) ??
      readNonEmptyString(crmRecommendation.targetRecordType) ??
      fallbackRecommendationSubjectType(providerId)
    const authoritativeSubject = Boolean(
      subjectId && readNonEmptyString(subjectRecord.label),
    )
    const repairedFields: string[] = []
    const defaultedFields: string[] = []

    if (
      !record.subject ||
      typeof record.subject !== 'object' ||
      Array.isArray(record.subject)
    ) {
      repairedFields.push('subject')
    }
    if (!authoritativeSubject) {
      defaultedFields.push('subject.display')
    }
    if (!readNonEmptyString(record.id)) defaultedFields.push('id')
    if (
      !readNonEmptyString(record.title) &&
      !readNonEmptyString(record.label)
    ) {
      defaultedFields.push('title')
    }
    if (
      !readNonEmptyString(record.summary) &&
      !readNonEmptyString(record.explanation)
    ) {
      defaultedFields.push('summary')
    }
    if (!Array.isArray(record.reasons)) defaultedFields.push('reasons')
    if (!Array.isArray(record.warnings)) defaultedFields.push('warnings')
    if (!Array.isArray(record.references)) defaultedFields.push('references')
    if (!Array.isArray(record.dependencies))
      defaultedFields.push('dependencies')
    if (!isWorkspaceRecommendationConfidence(record.confidence)) {
      defaultedFields.push('confidence')
    }
    if (!isWorkspaceRecommendationPriority(record.priority)) {
      defaultedFields.push('priority')
    }

    const references = normalizeWorkspaceRecommendationReferences(
      record.references,
    )
    const normalizedRecommendation: NormalizedWorkspaceRecommendation = {
      ...(record as Partial<WorkspaceRecommendation>),
      id,
      providerId,
      intent,
      title,
      summary,
      kind:
        readNonEmptyString(record.kind) ??
        readNonEmptyString(record.type) ??
        'workspaceRecommendation',
      subject: {
        ...(subjectId ? { id: subjectId } : {}),
        type: subjectType,
        label: subjectLabel,
        authoritative: authoritativeSubject,
      },
      score: normalizeWorkspaceRecommendationScore(record.score),
      confidence: isWorkspaceRecommendationConfidence(record.confidence)
        ? record.confidence
        : 'unknown',
      priority: isWorkspaceRecommendationPriority(record.priority)
        ? record.priority
        : deriveRecommendationPriority(record.score),
      reasons: normalizeWorkspaceRecommendationReasons(record.reasons),
      warnings: normalizeWorkspaceRecommendationWarnings(record.warnings),
      references,
      evidence: normalizeWorkspaceRecommendationReferences(
        record.evidence,
        references,
      ),
      dependencies: normalizeWorkspaceRecommendationDependencies(
        record.dependencies,
      ),
      proposedAction: record.proposedAction ?? record.suggestedAction,
      metadata: Object.keys(metadata).length ? metadata : undefined,
      rawRecommendation:
        process.env.NODE_ENV === 'development' ? item : undefined,
    }

    if (repairedFields.length || defaultedFields.length) {
      diagnostics.push({
        requestId,
        producer,
        providerId,
        domain: recommendationDomain(providerId),
        recommendationId: id,
        originalShape: {
          type: diagnosticValueType(item),
          keys: Object.keys(record).sort(),
          subjectType: diagnosticValueType(record.subject),
          subjectKeys: Object.keys(subjectRecord).sort(),
        },
        repairedFields,
        defaultedFields,
        subjectAuthority: authoritativeSubject
          ? 'authoritative'
          : 'display-only',
      })
    }

    return normalizedRecommendation
  })

  return { recommendations: normalized, diagnostics }
}

export function createWorkspaceContext({
  workspace,
  actor,
  providers,
  language,
  systemHealth,
}: {
  workspace: WorkspaceIntelligenceWorkspace
  actor: WorkspaceIntelligenceActor
  providers: KnowledgeProviderRegistry
  language?: string
  systemHealth?: WorkspaceSystemHealth
}): WorkspaceIntelligenceContext {
  const metadata = providers.getMetadata()
  return {
    workspace: {
      ...workspace,
      timezone: workspace.timezone || 'UTC',
    },
    actor: {
      ...actor,
      permissions: [...actor.permissions].sort(),
    },
    language: language ?? actor.language ?? 'en',
    enabledModules: [...(workspace.enabledModules ?? [])].sort(),
    availableProviders: metadata,
    capabilities: providers
      .getCapabilities()
      .sort((first, second) =>
        `${first.providerId}:${first.key}`.localeCompare(
          `${second.providerId}:${second.key}`,
        ),
      ),
    systemHealth: systemHealth ?? { status: 'ready', warnings: [] },
  }
}

function isSchedulingRecommendationIntent(
  intent?: SchedulingKnowledgeIntent,
): intent is Extract<
  SchedulingKnowledgeIntent,
  | 'findBestMember'
  | 'findBestTeam'
  | 'findAvailableSlot'
  | 'findRecurringSlot'
  | 'balanceWorkload'
> {
  return (
    intent === 'findBestMember' ||
    intent === 'findBestTeam' ||
    intent === 'findAvailableSlot' ||
    intent === 'findRecurringSlot' ||
    intent === 'balanceWorkload'
  )
}

function asRecommendationRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeWorkspaceProviderId(
  value: unknown,
  fallbackProviderId?: WorkspaceKnowledgeProviderId,
): WorkspaceKnowledgeProviderId {
  if (value === 'scheduling' || value === 'crm') return value
  return fallbackProviderId ?? 'scheduling'
}

function recommendationDomain(
  providerId: WorkspaceKnowledgeProviderId,
): WorkspaceKnowledgeDomain {
  return providerId === 'crm' ? 'crm' : 'scheduling'
}

function fallbackRecommendationTitle({
  providerId,
  intent,
}: {
  providerId: WorkspaceKnowledgeProviderId
  intent: WorkspaceIntelligenceIntent
}) {
  if (providerId === 'crm') return 'CRM recommendation'
  if (intent.startsWith('workspace.')) return 'Workspace recommendation'
  if (providerId === 'scheduling') return 'Scheduling recommendation'
  return 'Operational recommendation'
}

function fallbackRecommendationSubjectType(
  providerId: WorkspaceKnowledgeProviderId,
) {
  return providerId === 'crm'
    ? 'crm-recommendation'
    : 'scheduling-recommendation'
}

function normalizeWorkspaceRecommendationScore(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)))
  }
  return 0
}

function isWorkspaceRecommendationConfidence(
  value: unknown,
): value is NormalizedWorkspaceRecommendation['confidence'] {
  return (
    value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'unknown'
  )
}

function isWorkspaceRecommendationPriority(
  value: unknown,
): value is NormalizedWorkspaceRecommendation['priority'] {
  return (
    value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'unknown'
  )
}

function deriveRecommendationPriority(
  score: unknown,
): NormalizedWorkspaceRecommendation['priority'] {
  const normalizedScore = normalizeWorkspaceRecommendationScore(score)
  if (normalizedScore >= 80) return 'high'
  if (normalizedScore >= 50) return 'medium'
  if (normalizedScore > 0) return 'low'
  return 'unknown'
}

function normalizeWorkspaceRecommendationReasons(
  value: unknown,
): WorkspaceRecommendationReason[] {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => {
    const record = asRecommendationRecord(item)
    return {
      code: readNonEmptyString(record.code) ?? `reason-${index + 1}`,
      label:
        readNonEmptyString(record.label) ??
        readNonEmptyString(record.message) ??
        readNonEmptyString(record.summary) ??
        'Supporting reason unavailable.',
      source: readNonEmptyString(record.source) ?? 'workspace-ai',
    }
  })
}

function normalizeWorkspaceRecommendationWarnings(
  value: unknown,
): WorkspaceRecommendationWarning[] {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => {
    const record = asRecommendationRecord(item)
    const severity =
      record.severity === 'warning' ||
      record.severity === 'blocking' ||
      record.severity === 'info'
        ? record.severity
        : 'info'
    return {
      code: readNonEmptyString(record.code) ?? `warning-${index + 1}`,
      label:
        readNonEmptyString(record.label) ??
        readNonEmptyString(record.message) ??
        'Recommendation warning unavailable.',
      source: readNonEmptyString(record.source) ?? 'workspace-ai',
      severity,
    }
  })
}

function normalizeWorkspaceRecommendationReferences(
  value: unknown,
  fallback: WorkspaceKnowledgeReference[] = [],
): WorkspaceKnowledgeReference[] {
  if (!Array.isArray(value)) return fallback
  return value.flatMap((item) => {
    const record = asRecommendationRecord(item)
    const id = readNonEmptyString(record.id)
    const label = readNonEmptyString(record.label)
    if (!id || !label) return []
    const providerId = normalizeWorkspaceProviderId(
      record.providerId,
      'scheduling',
    )
    return [
      {
        id,
        providerId,
        domain:
          (readNonEmptyString(record.domain) as WorkspaceKnowledgeDomain) ||
          recommendationDomain(providerId),
        kind:
          record.kind === 'context' ||
          record.kind === 'snapshot' ||
          record.kind === 'recommendation' ||
          record.kind === 'explanation' ||
          record.kind === 'metadata'
            ? record.kind
            : 'recommendation',
        label,
        scope:
          record.scope === 'workspace' ||
          record.scope === 'member' ||
          record.scope === 'team' ||
          record.scope === 'record' ||
          record.scope === 'provider'
            ? record.scope
            : 'provider',
        fingerprint: readNonEmptyString(record.fingerprint),
        createdAt: readNonEmptyString(record.createdAt),
      } satisfies WorkspaceKnowledgeReference,
    ]
  })
}

function normalizeWorkspaceRecommendationDependencies(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => readNonEmptyString(item))
    .filter((item): item is string => Boolean(item))
}

function diagnosticValueType(value: unknown): string {
  if (Array.isArray(value)) return `array(${value.length})`
  if (value === null) return 'null'
  if (value instanceof Date) return 'Date'
  return typeof value
}

function toWorkspaceRecommendation({
  candidate,
  intent,
  providerId,
  reference,
}: {
  candidate: SchedulingRecommendationCandidate
  intent: WorkspaceIntelligenceIntent
  providerId: WorkspaceKnowledgeProviderId
  reference: WorkspaceKnowledgeReference
}): WorkspaceRecommendation {
  return {
    id: `recommendation:${providerId}:${candidate.candidateType}:${candidate.candidateId}`,
    providerId,
    intent,
    subject: {
      id: candidate.candidateId,
      type: candidate.candidateType,
      label: candidate.label,
    },
    score: candidate.score,
    confidence: candidate.confidence,
    reasons: candidate.reasons,
    warnings: candidate.warnings,
    references: [reference],
    metadata: candidate.metadata,
  }
}

function toWorkspaceCRMRecommendation({
  recommendation,
  intent,
}: {
  recommendation: CRMRecommendation
  intent: WorkspaceIntelligenceIntent
}): WorkspaceRecommendation {
  return {
    id: recommendation.id,
    providerId: 'crm',
    intent,
    subject: {
      id: recommendation.targetRecordId,
      type: recommendation.targetRecordType,
      label: recommendation.targetLabel,
    },
    score: recommendation.score,
    confidence: recommendation.confidence,
    reasons: recommendation.reasonCodes.map((code, index) => ({
      code,
      label: recommendation.supportingFacts[index] ?? code,
      source: 'crm-knowledge-provider',
    })),
    warnings: recommendation.warnings.map((warning) => ({
      code: warning.category,
      label: warning.explanation,
      source: 'crm-knowledge-provider',
      severity: warning.severity,
    })),
    references: recommendation.references.map(toWorkspaceCRMReference),
    metadata: {
      crmRecommendation: recommendation,
      urgency: recommendation.urgency,
      deterministic: recommendation.deterministic,
      suggestedAction: recommendation.suggestedAction,
      scoreScale: recommendation.source.scoreScale,
    },
  }
}

function toWorkspaceCRMReference(
  reference: CRMReference,
): WorkspaceKnowledgeReference {
  return {
    id: reference.id,
    providerId: 'crm',
    domain: 'crm',
    kind: 'recommendation',
    label: reference.label,
    scope: 'record',
    fingerprint: stableFingerprint(reference),
    createdAt: reference.timestamp,
  }
}

function isCRMRecommendation(value: unknown): value is CRMRecommendation {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'source' in value &&
    (value as { source?: { provider?: unknown } }).source?.provider === 'crm' &&
    'targetRecordId' in value,
  )
}

function crmRecommendationMatchesIntent(
  recommendation: CRMRecommendation,
  intent: WorkspaceIntelligenceIntent,
) {
  if (intent === 'crm.prioritizeLeads') {
    return recommendation.targetRecordType === 'lead'
  }
  if (intent === 'crm.analyzeFollowUps') {
    return recommendation.type === 'crm.followUpLead'
  }
  if (
    intent === 'crm.analyzeOpportunities' ||
    intent === 'crm.analyzePipeline'
  ) {
    return recommendation.targetRecordType === 'opportunity'
  }
  if (intent === 'crm.analyzeDataQuality') {
    return recommendation.warnings.length > 0
  }
  return intent in crmIntentMap.crm
}

function toSchedulingCandidate(
  recommendation: WorkspaceRecommendation,
): SchedulingRecommendationCandidate {
  return {
    candidateId: recommendation.subject.id,
    candidateType: recommendation.subject
      .type as SchedulingRecommendationCandidate['candidateType'],
    label: recommendation.subject.label,
    score: recommendation.score,
    confidence: recommendation.confidence,
    reasons: recommendation.reasons.map((reason) => ({
      code: reason.code as SchedulingRecommendationCandidate['reasons'][number]['code'],
      label: reason.label,
      source:
        reason.source as SchedulingRecommendationCandidate['reasons'][number]['source'],
    })),
    warnings: recommendation.warnings.map((warning) => ({
      code: warning.code as SchedulingRecommendationCandidate['warnings'][number]['code'],
      label: warning.label,
      source:
        warning.source as SchedulingRecommendationCandidate['warnings'][number]['source'],
      severity: warning.severity,
    })),
    metadata: recommendation.metadata,
  }
}

function schedulingRecommendationReference(
  candidate: SchedulingRecommendationCandidate,
): WorkspaceKnowledgeReference {
  return {
    id: `reference:scheduling:recommendation:${candidate.candidateType}:${candidate.candidateId}`,
    providerId: 'scheduling',
    domain: 'scheduling',
    kind: 'recommendation',
    label: candidate.label,
    scope: 'record',
    fingerprint: stableFingerprint(candidate),
  }
}

function makeReference({
  providerId,
  domain,
  kind,
  label,
  scope,
  value,
}: {
  providerId: WorkspaceKnowledgeProviderId
  domain: WorkspaceKnowledgeDomain
  kind: WorkspaceKnowledgeReference['kind']
  label: string
  scope: WorkspaceKnowledgeReference['scope']
  value: unknown
}): WorkspaceKnowledgeReference {
  const fingerprint = stableFingerprint(value)
  return {
    id: `reference:${providerId}:${kind}:${fingerprint.length}`,
    providerId,
    domain,
    kind,
    label,
    scope,
    fingerprint,
    createdAt: createdAtFromValue(value),
  }
}

function createdAtFromValue(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'createdAt' in value &&
    typeof (value as { createdAt?: unknown }).createdAt === 'string'
  ) {
    return (value as { createdAt: string }).createdAt
  }
  return undefined
}

function referenceTimestamp(references: WorkspaceKnowledgeReference[]) {
  return (
    references.find((reference) => reference.createdAt)?.createdAt ??
    new Date(0).toISOString()
  )
}

function stableFingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, child) => {
    if (!child || typeof child !== 'object' || Array.isArray(child))
      return child
    return Object.keys(child as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((next, key) => {
        next[key] = (child as Record<string, unknown>)[key]
        return next
      }, {})
  })
}
