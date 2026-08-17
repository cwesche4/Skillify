import { z } from 'zod'

import {
  WorkspaceAIRuntime,
  createAIRuntimeRegistry,
} from '@/lib/ai/runtime/workspaceAIRuntime'
import {
  createAIProviderRegistry,
  createMockAIProvider,
} from '@/lib/ai/providers/aiProviderLayer'
import {
  OPENAI_GENERATION_PROVIDER_ID,
  createOpenAIProviderRegistry,
} from '@/lib/ai/providers/openAIProvider'
import type {
  SchedulingAIActionProposalType,
  SchedulingAIIntent,
  SchedulingAIObjectReference,
} from '@/lib/ai/experience/schedulingAIExperience'
import type {
  WorkspaceAIContextReference,
  WorkspaceAIEntryPointId,
} from '@/lib/ai/experience/workspaceAIExperience'
import type { AIPlaygroundConversationContext } from '@/lib/ai/playground/conversation'
import type { WorkspaceAIRoutingMode } from '@/lib/ai/workspaceInvestigation'
import type {
  WorkspaceIntelligenceIntent,
  WorkspaceKnowledgeProviderId,
} from '@/lib/intelligence/workspaceIntelligence'

export const AI_PLAYGROUND_FEATURE_FLAG = 'AI_PLAYGROUND_ENABLED'
export const AI_PLAYGROUND_MOCK_PROVIDER_ID = 'mock-ai-provider'

export type AIPlaygroundProviderId = 'mock' | 'openai'
export type AIPlaygroundDomainId = 'scheduling' | 'crm' | 'workspace'

export type AIPlaygroundCRMIntent =
  | 'prioritizeLeads'
  | 'analyzeFollowUps'
  | 'analyzeOpportunities'
  | 'analyzePipeline'
  | 'analyzeDataQuality'
  | 'crmOverview'
  | 'explainLead'
  | 'explainOpportunityRisk'
  | 'recommendNextActions'

export type AIPlaygroundWorkspaceIntent = 'investigateWorkspace'

export type AIPlaygroundIntent =
  | SchedulingAIIntent
  | AIPlaygroundCRMIntent
  | AIPlaygroundWorkspaceIntent

export type AIPlaygroundProviderOption = {
  id: AIPlaygroundProviderId
  label: string
  description: string
  runtimeProviderId?: string
  status: 'available' | 'unavailable'
  exposure: 'internalOnly' | 'customerAvailable' | 'disabled'
  disabledReason?: string
}

export type AIPlaygroundContextKind =
  | 'event'
  | 'technician'
  | 'team'
  | 'location'
  | 'calendar'
  | 'lead'
  | 'opportunity'
  | 'client'
  | 'owner'
  | 'pipelineStage'
  | 'workspace'
  | 'selection'

export type AIPlaygroundContextReference = {
  kind: AIPlaygroundContextKind
  id: string
  label: string
  metadata?: {
    startsAt?: string
    endsAt?: string
    dateTimeLabel?: string
    assignmentLabel?: string
    teamLabel?: string
    locationLabel?: string
    customerLabel?: string
    status?: string
  }
}

export type AIPlaygroundContextOption = AIPlaygroundContextReference & {
  secondaryLabel?: string
}

export type AIPlaygroundRunInput = {
  clientRequestId?: string
  domainId: AIPlaygroundDomainId
  providerId: AIPlaygroundProviderId
  routingMode: WorkspaceAIRoutingMode
  intent: AIPlaygroundIntent
  prompt: string
  includeActionProposal: boolean
  proposedActionType?: SchedulingAIActionProposalType
  contextReferences: AIPlaygroundContextReference[]
  conversation?: AIPlaygroundConversationContext
}

export type AIPlaygroundIntentOption = {
  value: AIPlaygroundIntent
  label: string
  workspaceIntent: WorkspaceIntelligenceIntent
  outputType:
    | 'answer'
    | 'recommendations'
    | 'explanation'
    | 'summary'
    | 'analysis'
}

export type AIPlaygroundContextGroup = {
  id: string
  label: string
  options: AIPlaygroundContextOption[]
}

export type AIPlaygroundDomainDefinition = {
  id: AIPlaygroundDomainId
  label: string
  heading: string
  description: string
  knowledgeProviderId: WorkspaceKnowledgeProviderId
  entryPointId: WorkspaceAIEntryPointId
  deterministicEngine: string
  defaultIntent: AIPlaygroundIntent
  defaultPrompt: string
  allowActionProposals: boolean
  intents: AIPlaygroundIntentOption[]
  examples: Array<{
    label: string
    intent: AIPlaygroundIntent
    prompt: string
    includeActionProposal?: boolean
    proposedActionType?: SchedulingAIActionProposalType
  }>
}

export const AI_PLAYGROUND_SCHEDULING_INTENTS = [
  'explainSchedulingConflict',
  'explainRecommendation',
  'explainTechnicianAvailability',
  'explainWorkload',
  'explainAssignment',
  'explainRecurringSchedule',
  'recommendTechnician',
  'recommendTeam',
  'recommendLocation',
  'recommendAppointmentTime',
  'recommendAlternateSchedule',
  'recommendReassignment',
  'analyzeSchedule',
  'analyzeConflicts',
  'analyzeWorkload',
  'summarizeTodaysSchedule',
  'summarizeUpcomingWork',
] as const satisfies readonly SchedulingAIIntent[]

export const AI_PLAYGROUND_CRM_INTENTS = [
  'prioritizeLeads',
  'analyzeFollowUps',
  'analyzeOpportunities',
  'analyzePipeline',
  'analyzeDataQuality',
  'crmOverview',
  'explainLead',
  'explainOpportunityRisk',
  'recommendNextActions',
] as const satisfies readonly AIPlaygroundCRMIntent[]

export const AI_PLAYGROUND_DOMAINS: AIPlaygroundDomainDefinition[] = [
  {
    id: 'scheduling',
    label: 'Scheduling',
    heading: 'Scheduling AI playground',
    description:
      'Internal proposal-only testing for scheduling recommendations, explanations, conflicts, and workload.',
    knowledgeProviderId: 'scheduling',
    entryPointId: 'scheduling',
    deterministicEngine: 'Scheduling Knowledge',
    defaultIntent: 'analyzeSchedule',
    defaultPrompt: 'Summarize my schedule.',
    allowActionProposals: true,
    intents: [
      intent(
        'explainSchedulingConflict',
        'Explain current conflicts',
        'scheduling.explainConflict',
        'explanation',
      ),
      intent(
        'explainTechnicianAvailability',
        'Explain technician availability',
        'scheduling.explainUnavailable',
        'explanation',
      ),
      intent(
        'recommendTechnician',
        'Recommend technician',
        'scheduling.findBestMember',
        'recommendations',
      ),
      intent(
        'recommendTeam',
        'Recommend team',
        'scheduling.findBestTeam',
        'recommendations',
      ),
      intent(
        'recommendAppointmentTime',
        'Recommend appointment time',
        'scheduling.findAvailableSlot',
        'recommendations',
      ),
      intent(
        'recommendReassignment',
        'Recommend reassignment',
        'scheduling.assignEvent',
        'recommendations',
      ),
      intent(
        'analyzeSchedule',
        'Analyze schedule',
        'scheduling.balanceWorkload',
        'analysis',
      ),
      intent(
        'analyzeConflicts',
        'Analyze conflicts',
        'scheduling.explainConflict',
        'analysis',
      ),
      intent(
        'analyzeWorkload',
        'Analyze workload',
        'scheduling.balanceWorkload',
        'analysis',
      ),
      intent(
        'summarizeTodaysSchedule',
        "Summarize today's schedule",
        'scheduling.balanceWorkload',
        'summary',
      ),
      intent(
        'summarizeUpcomingWork',
        'Summarize upcoming work',
        'scheduling.balanceWorkload',
        'summary',
      ),
    ],
    examples: [
      {
        label: 'Explain current conflicts',
        intent: 'explainSchedulingConflict',
        prompt:
          'Explain why the selected assignment conflicts with current workspace availability.',
      },
      {
        label: 'Recommend technician',
        intent: 'recommendTechnician',
        prompt:
          'Recommend the best available technician for the selected schedule window.',
        includeActionProposal: true,
        proposedActionType: 'assignTechnician',
      },
      {
        label: 'Summarize workload',
        intent: 'analyzeWorkload',
        prompt: 'Summarize scheduling workload and note any operational risks.',
      },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    heading: 'CRM AI playground',
    description:
      'Inspect deterministic CRM knowledge, risks, recommendations, references, and provider explanations.',
    knowledgeProviderId: 'crm',
    entryPointId: 'crm',
    deterministicEngine: 'CRM Knowledge Provider',
    defaultIntent: 'prioritizeLeads',
    defaultPrompt:
      'Prioritize CRM next actions using deterministic workspace CRM knowledge.',
    allowActionProposals: false,
    intents: [
      intent(
        'prioritizeLeads',
        'Lead Prioritization',
        'crm.prioritizeLeads',
        'recommendations',
      ),
      intent(
        'analyzeFollowUps',
        'Follow-up Analysis',
        'crm.analyzeFollowUps',
        'recommendations',
      ),
      intent(
        'analyzeOpportunities',
        'Opportunity Analysis',
        'crm.analyzeOpportunities',
        'recommendations',
      ),
      intent(
        'analyzePipeline',
        'Pipeline Analysis',
        'crm.analyzePipeline',
        'analysis',
      ),
      intent(
        'analyzeDataQuality',
        'CRM Data Quality',
        'crm.analyzeDataQuality',
        'analysis',
      ),
      intent('crmOverview', 'CRM Overview', 'crm.analyzePipeline', 'summary'),
      intent(
        'explainLead',
        'Lead Explanation',
        'crm.explainRecord',
        'explanation',
      ),
      intent(
        'explainOpportunityRisk',
        'Opportunity Risk',
        'crm.analyzeOpportunities',
        'explanation',
      ),
      intent(
        'recommendNextActions',
        'CRM Next Actions',
        'crm.recommendNextActions',
        'recommendations',
      ),
    ],
    examples: [
      {
        label: 'Prioritize leads',
        intent: 'prioritizeLeads',
        prompt:
          'Prioritize the highest-impact lead follow-ups and explain the deterministic reasons.',
      },
      {
        label: 'Find overdue follow-ups',
        intent: 'analyzeFollowUps',
        prompt:
          'Find overdue CRM follow-ups and summarize what should happen next.',
      },
      {
        label: 'Explain opportunity risk',
        intent: 'explainOpportunityRisk',
        prompt: 'Explain opportunity risk using CRM knowledge provider facts.',
      },
      {
        label: 'Summarize pipeline',
        intent: 'analyzePipeline',
        prompt:
          'Summarize pipeline risk and concentration using deterministic CRM facts.',
      },
      {
        label: 'Show CRM data quality',
        intent: 'analyzeDataQuality',
        prompt:
          'Show CRM data-quality warnings and explain what should be cleaned up.',
      },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    heading: 'Workspace AI investigation playground',
    description:
      'Internal testing for broad, read-only workspace investigations across available and partial domains.',
    knowledgeProviderId: 'scheduling',
    entryPointId: 'workspace',
    deterministicEngine: 'Workspace Investigation',
    defaultIntent: 'investigateWorkspace',
    defaultPrompt: 'What should the owner focus on today?',
    allowActionProposals: false,
    intents: [
      intent(
        'investigateWorkspace',
        'Investigate workspace question',
        'workspace.investigateQuestion',
        'analysis',
      ),
    ],
    examples: [
      {
        label: 'Owner focus',
        intent: 'investigateWorkspace',
        prompt: 'What should the owner focus on today?',
      },
      {
        label: 'Operational bottleneck',
        intent: 'investigateWorkspace',
        prompt: 'What is the biggest operational bottleneck?',
      },
      {
        label: 'Service request risk',
        intent: 'investigateWorkspace',
        prompt: 'Why are service requests taking longer this week?',
      },
      {
        label: 'Automation failures',
        intent: 'investigateWorkspace',
        prompt: 'Why are my automations failing?',
      },
      {
        label: 'Marketing data gap',
        intent: 'investigateWorkspace',
        prompt: 'Which ad platform gives me the best customers?',
      },
    ],
  },
]

const schedulingAIIntentSchema = z.enum(AI_PLAYGROUND_SCHEDULING_INTENTS)
const crmAIIntentSchema = z.enum(AI_PLAYGROUND_CRM_INTENTS)
const workspaceAIIntentSchema = z.enum(['investigateWorkspace'])
const playgroundIntentSchema = z.union([
  schedulingAIIntentSchema,
  crmAIIntentSchema,
  workspaceAIIntentSchema,
])

const schedulingActionProposalSchema = z.enum([
  'assignTechnician',
  'moveAppointment',
  'changeTeam',
  'notifyCustomer',
  'createTask',
  'updateRecurringSchedule',
] as const satisfies readonly SchedulingAIActionProposalType[])

const conversationTurnSchema = z.object({
  id: z.string().trim().min(1).max(160),
  role: z.enum(['user', 'assistant']),
  domain: z.enum(['scheduling', 'crm', 'workspace']),
  intent: playgroundIntentSchema,
  prompt: z.string().trim().min(1).max(2_000),
  createdAt: z.string().trim().min(1).max(80),
  responseSummary: z.string().trim().max(1_000).optional(),
  referenceIds: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  proposedActionIds: z
    .array(z.string().trim().min(1).max(200))
    .max(20)
    .optional(),
  warningSummaries: z
    .array(z.string().trim().min(1).max(300))
    .max(10)
    .optional(),
})

const contextKindSchema = z.enum([
  'event',
  'technician',
  'team',
  'location',
  'calendar',
  'lead',
  'opportunity',
  'client',
  'owner',
  'pipelineStage',
  'workspace',
  'selection',
])

export const aiPlaygroundRunInputSchema = z.object({
  clientRequestId: z.string().trim().min(1).max(160).optional(),
  domainId: z.enum(['scheduling', 'crm', 'workspace']).default('scheduling'),
  providerId: z.enum(['mock', 'openai']).default('mock'),
  routingMode: z.enum(['AUTO_DETECT', 'FORCE_INTENT']).default('AUTO_DETECT'),
  intent: playgroundIntentSchema,
  prompt: z.string().trim().min(1).max(2_000),
  includeActionProposal: z.boolean().default(false),
  proposedActionType: schedulingActionProposalSchema.optional(),
  contextReferences: z
    .array(
      z.object({
        kind: contextKindSchema,
        id: z.string().trim().min(1).max(160),
        label: z.string().trim().min(1).max(160),
        metadata: z
          .object({
            startsAt: z.string().trim().max(120).optional(),
            endsAt: z.string().trim().max(120).optional(),
            dateTimeLabel: z.string().trim().max(160).optional(),
            assignmentLabel: z.string().trim().max(160).optional(),
            teamLabel: z.string().trim().max(160).optional(),
            locationLabel: z.string().trim().max(160).optional(),
            customerLabel: z.string().trim().max(160).optional(),
            status: z.string().trim().max(80).optional(),
          })
          .optional(),
      }),
    )
    .max(8)
    .default([]),
  conversation: z
    .object({
      currentTurnId: z.string().trim().min(1).max(160).optional(),
      priorTurns: z.array(conversationTurnSchema).max(8).default([]),
      selectedContext: z
        .array(
          z.object({
            kind: contextKindSchema,
            id: z.string().trim().min(1).max(160),
            label: z.string().trim().min(1).max(160),
            metadata: z
              .object({
                startsAt: z.string().trim().max(120).optional(),
                endsAt: z.string().trim().max(120).optional(),
                dateTimeLabel: z.string().trim().max(160).optional(),
                assignmentLabel: z.string().trim().max(160).optional(),
                teamLabel: z.string().trim().max(160).optional(),
                locationLabel: z.string().trim().max(160).optional(),
                customerLabel: z.string().trim().max(160).optional(),
                status: z.string().trim().max(80).optional(),
              })
              .optional(),
          }),
        )
        .max(8)
        .default([]),
    })
    .optional(),
})

export function parseAIPlaygroundRunInput(
  value: unknown,
): AIPlaygroundRunInput {
  const parsed = aiPlaygroundRunInputSchema.parse(value)
  const domain = getAIPlaygroundDomain(parsed.domainId)
  if (
    parsed.routingMode === 'FORCE_INTENT' &&
    !domain.intents.some((intentOption) => intentOption.value === parsed.intent)
  ) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['intent'],
        message: `Intent ${parsed.intent} is not supported by ${domain.label}.`,
      },
    ])
  }
  return parsed
}

export function getAIPlaygroundDomain(domainId: AIPlaygroundDomainId) {
  return (
    AI_PLAYGROUND_DOMAINS.find((domain) => domain.id === domainId) ??
    AI_PLAYGROUND_DOMAINS[0]
  )
}

export function getAIPlaygroundIntent(
  domainId: AIPlaygroundDomainId,
  intentValue: AIPlaygroundIntent,
) {
  const domain = getAIPlaygroundDomain(domainId)
  return (
    domain.intents.find((intentOption) => intentOption.value === intentValue) ??
    domain.intents[0]
  )
}

type AIPlaygroundEnv = Record<string, string | undefined>

export function isAIPlaygroundEnabled(env: AIPlaygroundEnv = process.env) {
  return env[AI_PLAYGROUND_FEATURE_FLAG] === 'true'
}

export function canUseAIPlayground(role: unknown) {
  const normalized = String(role ?? '').toUpperCase()
  return normalized === 'OWNER' || normalized === 'ADMIN'
}

export function isOpenAIConfigured(env: AIPlaygroundEnv = process.env) {
  return Boolean(env.OPENAI_API_KEY?.trim())
}

export function getAIPlaygroundProviderOptions(
  env: AIPlaygroundEnv = process.env,
): AIPlaygroundProviderOption[] {
  const openAIConfigured = isOpenAIConfigured(env)
  return [
    {
      id: 'mock',
      label: 'Mock',
      description: 'Deterministic structured output for internal testing.',
      runtimeProviderId: AI_PLAYGROUND_MOCK_PROVIDER_ID,
      status: 'available',
      exposure: 'internalOnly',
    },
    {
      id: 'openai',
      label: 'OpenAI',
      description:
        'Production provider path. Requires server-side OPENAI_API_KEY.',
      runtimeProviderId: OPENAI_GENERATION_PROVIDER_ID,
      status: openAIConfigured ? 'available' : 'unavailable',
      exposure: openAIConfigured ? 'customerAvailable' : 'disabled',
      disabledReason: openAIConfigured
        ? undefined
        : 'OPENAI_API_KEY is not configured on the server.',
    },
  ]
}

export function createAIPlaygroundRuntime(providerId: AIPlaygroundProviderId) {
  if (providerId === 'openai') {
    return {
      runtime: new WorkspaceAIRuntime(
        createAIRuntimeRegistry({
          aiProviders: createOpenAIProviderRegistry(),
        }),
      ),
      llmProviderId: OPENAI_GENERATION_PROVIDER_ID,
    }
  }

  return {
    runtime: new WorkspaceAIRuntime(
      createAIRuntimeRegistry({
        aiProviders: createAIProviderRegistry({
          providers: [
            createMockAIProvider({ id: AI_PLAYGROUND_MOCK_PROVIDER_ID }),
          ],
          defaultProviderId: AI_PLAYGROUND_MOCK_PROVIDER_ID,
        }),
      }),
    ),
    llmProviderId: AI_PLAYGROUND_MOCK_PROVIDER_ID,
  }
}

export function toSchedulingAIObjectReference(
  reference: AIPlaygroundContextReference,
): SchedulingAIObjectReference {
  return {
    id: reference.id,
    kind: toSchedulingContextKind(reference.kind),
    label: reference.label,
    referenceId: reference.id,
    metadata: reference.metadata,
  }
}

export function toWorkspaceAIContextReference({
  reference,
  domainId,
  providerId,
}: {
  reference: AIPlaygroundContextReference
  domainId: AIPlaygroundDomainId
  providerId: WorkspaceKnowledgeProviderId
}): WorkspaceAIContextReference {
  return {
    id: reference.id,
    entryPointId:
      domainId === 'crm'
        ? 'crm'
        : domainId === 'workspace'
          ? 'workspace'
          : 'scheduling',
    kind: toWorkspaceContextKind(reference.kind),
    label: reference.label,
    providerId,
    referenceId: reference.id,
    metadata: reference.metadata,
  }
}

function intent(
  value: AIPlaygroundIntent,
  label: string,
  workspaceIntent: WorkspaceIntelligenceIntent,
  outputType: AIPlaygroundIntentOption['outputType'],
): AIPlaygroundIntentOption {
  return {
    value,
    label,
    workspaceIntent,
    outputType,
  }
}

function toWorkspaceContextKind(
  kind: AIPlaygroundContextKind,
): WorkspaceAIContextReference['kind'] {
  if (kind === 'technician' || kind === 'owner') return 'member'
  if (kind === 'lead' || kind === 'opportunity' || kind === 'client')
    return 'record'
  if (kind === 'pipelineStage') return 'pipeline'
  if (kind === 'team' || kind === 'location' || kind === 'selection')
    return 'record'
  return kind
}

function toSchedulingContextKind(
  kind: AIPlaygroundContextKind,
): SchedulingAIObjectReference['kind'] {
  if (
    kind === 'event' ||
    kind === 'technician' ||
    kind === 'team' ||
    kind === 'location' ||
    kind === 'calendar' ||
    kind === 'workspace' ||
    kind === 'selection'
  ) {
    return kind
  }
  return 'selection'
}

const secretKeyPattern =
  /(secret|api[_-]?key|apikey|token|authorization|cookie|password|credential|webhook|private[_-]?key)/i

const secretValuePatterns = [
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /\bsk-[A-Za-z0-9._-]{12,}\b/,
  /\bpk_(?:live|test)_[A-Za-z0-9._-]{8,}\b/,
  /\bwhsec_[A-Za-z0-9._-]{8,}\b/,
  /\bsvix_[A-Za-z0-9._-]{8,}\b/i,
]

export function sanitizeAIPlaygroundOutput<T>(value: T): T {
  return sanitizeValue(value, new WeakSet()) as T
}

function sanitizeValue(value: unknown, ancestors: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string') {
    return secretValuePatterns.some((pattern) => pattern.test(value))
      ? '[redacted]'
      : value
  }
  if (typeof value !== 'object') return value

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }
  if (value instanceof Error) {
    return {
      name: value.name || 'Error',
      message: value.message || 'Unknown error',
    }
  }
  if (ancestors.has(value)) return '[circular]'
  ancestors.add(value)

  try {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item, ancestors))
    }
    if (value instanceof Map) {
      return Array.from(value.entries()).map(([key, item]) => ({
        key: sanitizeValue(key, ancestors),
        value: sanitizeValue(item, ancestors),
      }))
    }
    if (value instanceof Set) {
      return Array.from(value.values()).map((item) =>
        sanitizeValue(item, ancestors),
      )
    }

    const candidate = value as { toJSON?: () => unknown }
    if (typeof candidate.toJSON === 'function') {
      const jsonValue = candidate.toJSON()
      if (jsonValue !== value) return sanitizeValue(jsonValue, ancestors)
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [
          key,
          secretKeyPattern.test(key)
            ? '[redacted]'
            : sanitizeValue(item, ancestors),
        ]),
    )
  } finally {
    ancestors.delete(value)
  }
}
