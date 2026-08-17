import { z } from 'zod'

import {
  WorkspaceAIRuntime,
  createAIRuntimeRegistry,
} from '@/lib/ai/runtime/workspaceAIRuntime'
import {
  OPENAI_GENERATION_PROVIDER_ID,
  createOpenAIProviderRegistry,
} from '@/lib/ai/providers/openAIProvider'
import {
  formatRecommendationScoreLabel,
  SCHEDULING_RECOMMENDATION_PROVENANCE,
} from '@/lib/ai/playground/recommendationFormatting'
import type {
  SchedulingAIIntent,
  SchedulingAIObjectReference,
  SchedulingAIResponse,
} from '@/lib/ai/experience/schedulingAIExperience'

export const SCHEDULING_AI_FEATURE_FLAG = 'SCHEDULING_AI_ENABLED'
export const SCHEDULING_AI_REQUEST_MAX_LENGTH = 2_000

export type SchedulingAIEntryPoint =
  | 'calendar'
  | 'event'
  | 'teamAvailability'
  | 'busySchedule'
  | 'section'

export type SchedulingAIContextReferenceKind =
  | 'event'
  | 'technician'
  | 'team'
  | 'location'
  | 'calendar'
  | 'workspace'
  | 'selection'

export type SchedulingAIContextReference = {
  kind: SchedulingAIContextReferenceKind
  id: string
  label: string
}

export type SchedulingAIContextPayload = {
  entryPoint: SchedulingAIEntryPoint
  label: string
  references: SchedulingAIContextReference[]
  calendar?: {
    view?: string
    dateKey?: string
    rangeStart?: string
    rangeEnd?: string
  }
  section?: string
}

export type CustomerSchedulingAIRequest = {
  prompt: string
  intent?: SchedulingAIIntent
  context: SchedulingAIContextPayload
  includeActionProposal?: boolean
  proposedActionType?:
    | 'createEvent'
    | 'createEventAndAssign'
    | 'assignTechnician'
    | 'moveAppointment'
    | 'changeTeam'
    | 'notifyCustomer'
    | 'createTask'
    | 'updateRecurringSchedule'
}

export type CustomerSchedulingAIResponse = {
  id: string
  responseKind: SchedulingAIResponse['responseKind']
  confidence: SchedulingAIResponse['confidence']
  summary?: SchedulingAIResponse['summary']
  explanations: SchedulingAIResponse['explanations']
  recommendations: Array<
    SchedulingAIResponse['recommendations'][number] & {
      scoreLabel: string
      provenanceLabel: string
    }
  >
  analysis?: SchedulingAIResponse['analysis']
  actionProposals: SchedulingAIResponse['actionProposals']
  decisionProposals: SchedulingAIResponse['decisionProposals']
  warnings: SchedulingAIResponse['warnings']
  references: SchedulingAIResponse['references']
  followUpSuggestions: string[]
  metadata: {
    recommendationSource: typeof SCHEDULING_RECOMMENDATION_PROVENANCE
    actionExecution: 'not-executed'
    providerRole: 'Structured explanation/response generation'
  }
}

type SchedulingAIEnv = Record<string, string | undefined>

const contextReferenceSchema = z.object({
  kind: z.enum([
    'event',
    'technician',
    'team',
    'location',
    'calendar',
    'workspace',
    'selection',
  ]),
  id: z.string().trim().min(1).max(160),
  label: z.string().trim().min(1).max(160),
})

const schedulingAIIntentSchema = z.enum([
  'draftEventProposal',
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
] as const)

export const customerSchedulingAIRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(SCHEDULING_AI_REQUEST_MAX_LENGTH),
  intent: schedulingAIIntentSchema.optional(),
  includeActionProposal: z.boolean().optional(),
  proposedActionType: z
    .enum([
      'createEvent',
      'createEventAndAssign',
      'assignTechnician',
      'moveAppointment',
      'changeTeam',
      'notifyCustomer',
      'createTask',
      'updateRecurringSchedule',
    ])
    .optional(),
  context: z.object({
    entryPoint: z.enum([
      'calendar',
      'event',
      'teamAvailability',
      'busySchedule',
      'section',
    ]),
    label: z.string().trim().min(1).max(160),
    references: z.array(contextReferenceSchema).max(10).default([]),
    calendar: z
      .object({
        view: z.string().trim().max(40).optional(),
        dateKey: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        rangeStart: z.string().datetime().optional(),
        rangeEnd: z.string().datetime().optional(),
      })
      .optional(),
    section: z.string().trim().max(80).optional(),
  }),
})

export function parseCustomerSchedulingAIRequest(
  value: unknown,
): CustomerSchedulingAIRequest {
  return customerSchedulingAIRequestSchema.parse(value)
}

export function isSchedulingAIEnabled(env: SchedulingAIEnv = process.env) {
  return env[SCHEDULING_AI_FEATURE_FLAG] === 'true'
}

export function isSchedulingAIProviderConfigured(
  env: SchedulingAIEnv = process.env,
) {
  return Boolean(env.OPENAI_API_KEY?.trim())
}

export function createCustomerSchedulingAIRuntime() {
  return {
    runtime: new WorkspaceAIRuntime(
      createAIRuntimeRegistry({
        aiProviders: createOpenAIProviderRegistry(),
      }),
    ),
    llmProviderId: OPENAI_GENERATION_PROVIDER_ID,
  }
}

export function inferSchedulingAIIntent({
  prompt,
  context,
}: {
  prompt: string
  context: SchedulingAIContextPayload
}): SchedulingAIIntent {
  const normalized = prompt.toLowerCase()
  if (
    /\b(create|book|schedule|set up)\b/.test(normalized) &&
    /\b(event|appointment|service|meeting|job|visit|call)\b/.test(normalized)
  ) {
    return 'draftEventProposal'
  }
  if (normalized.includes('reassign')) return 'recommendReassignment'
  if (
    normalized.includes('best available') ||
    normalized.includes('recommend a member') ||
    normalized.includes('recommend member') ||
    normalized.includes('recommend technician') ||
    normalized.includes('who should')
  ) {
    return 'recommendTechnician'
  }
  if (
    normalized.includes('better time') ||
    normalized.includes('time slot') ||
    normalized.includes('another time')
  ) {
    return 'recommendAppointmentTime'
  }
  if (normalized.includes('team')) return 'recommendTeam'
  if (normalized.includes('conflict') || normalized.includes('blocked')) {
    return context.entryPoint === 'event'
      ? 'explainSchedulingConflict'
      : 'analyzeConflicts'
  }
  if (
    normalized.includes('overload') ||
    normalized.includes('workload') ||
    normalized.includes('underutil')
  ) {
    return 'analyzeWorkload'
  }
  if (normalized.includes('why')) return 'explainRecommendation'
  if (normalized.includes('summarize today')) return 'summarizeTodaysSchedule'
  if (normalized.includes('summarize') || normalized.includes('summary')) {
    return context.entryPoint === 'calendar'
      ? 'summarizeUpcomingWork'
      : 'analyzeSchedule'
  }
  if (normalized.includes('risk') || normalized.includes('analyze')) {
    return 'analyzeSchedule'
  }
  return context.entryPoint === 'calendar'
    ? 'summarizeUpcomingWork'
    : 'explainRecommendation'
}

export function toSchedulingAIObjectReference(
  reference: SchedulingAIContextReference,
): SchedulingAIObjectReference {
  return {
    id: reference.id,
    kind: reference.kind,
    label: reference.label,
    referenceId: reference.id,
  }
}

export function toCustomerSchedulingAIResponse(
  response: SchedulingAIResponse,
): CustomerSchedulingAIResponse {
  return {
    id: response.id,
    responseKind: response.responseKind,
    confidence: response.confidence,
    summary: response.summary,
    explanations: response.explanations,
    recommendations: response.recommendations.map((recommendation) => ({
      ...recommendation,
      scoreLabel: formatRecommendationScoreLabel(recommendation.score),
      provenanceLabel: 'Recommended using Skillify Scheduling data',
    })),
    analysis: response.analysis,
    actionProposals: response.actionProposals,
    decisionProposals: response.decisionProposals,
    warnings: response.warnings,
    references: response.references,
    followUpSuggestions: response.workspaceAIResponse.followUpSuggestions,
    metadata: {
      recommendationSource: SCHEDULING_RECOMMENDATION_PROVENANCE,
      actionExecution: 'not-executed',
      providerRole: 'Structured explanation/response generation',
    },
  }
}
