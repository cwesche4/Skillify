import { auth } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import {
  runSchedulingAIRequest,
  type SchedulingAIObjectReference,
} from '@/lib/ai/experience/schedulingAIExperience'
import {
  createWorkspaceAIExperience,
  isWorkspaceAIExperienceAssemblyError,
  type WorkspaceAIConversationRequest,
} from '@/lib/ai/experience/workspaceAIExperience'
import {
  canUseAIPlayground,
  createAIPlaygroundRuntime,
  getAIPlaygroundDomain,
  getAIPlaygroundIntent,
  getAIPlaygroundProviderOptions,
  isAIPlaygroundEnabled,
  parseAIPlaygroundRunInput,
  sanitizeAIPlaygroundOutput,
  toSchedulingAIObjectReference,
  toWorkspaceAIContextReference,
  type AIPlaygroundDomainId,
  type AIPlaygroundIntentOption,
  type AIPlaygroundProviderOption,
} from '@/lib/ai/playground/aiPlayground'
import { SCHEDULING_RECOMMENDATION_PROVENANCE } from '@/lib/ai/playground/recommendationFormatting'
import { normalizeRuntimeEvents } from '@/lib/ai/playground/runtimeEvents'
import {
  buildAIPlaygroundFailurePayload,
  buildPlaygroundOperationalInspection,
  createAIPlaygroundDiagnosticFromProviderError,
  createAIPlaygroundDiagnosticFromStage,
  createAIPlaygroundStageTracker,
  logAIPlaygroundServerError,
  traceAIPlaygroundLifecycle,
} from '@/lib/ai/playground/playgroundReliability'
import { isAIProviderException } from '@/lib/ai/providers/aiProviderLayer'
import {
  buildCRMKnowledgeSource,
  getCRMKnowledgeSnapshot,
} from '@/lib/crm/knowledge'
import { prisma } from '@/lib/db'
import {
  resolveRecommendations,
  type WorkspaceRecommendation,
} from '@/lib/intelligence/workspaceIntelligence'
import {
  getRuntimeWorkspaceKnowledgeFingerprint,
  loadPersistedWorkspaceKnowledgeSnapshot,
} from '@/lib/intelligence/workspaceKnowledgeStore'
import {
  buildWorkspaceAIAnalysisPlan,
  buildWorkspaceInvestigationClaims,
  resolveWorkspaceAIIntent,
  workspaceAIDomainCatalog,
  workspaceKnowledgeToolCatalog,
  type WorkspaceAIIntentResolution,
} from '@/lib/ai/workspaceInvestigation'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { loadSchedulingPageProps } from '@/lib/scheduling/loadSchedulingPageProps'
import { getWorkspaceDateKey } from '@/lib/scheduling/schedulingDateTime'
import {
  formatDateTime,
  formatTimeOnly,
  schedulingStatusLabels,
} from '@/lib/scheduling/schedulingFormatters'
import type { SchedulingKnowledgeInput } from '@/lib/scheduling/schedulingKnowledge'
import type { SchedulingEvent } from '@/lib/scheduling/types'

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  let playgroundRequestId = `playground-server:${crypto.randomUUID()}`
  const requestStartedAtMs = Date.now()
  const stageTracker = createAIPlaygroundStageTracker({
    requestId: playgroundRequestId,
  })
  stageTracker.enter('REQUEST_RECEIVED')
  if (!isAIPlaygroundEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  stageTracker.complete('REQUEST_RECEIVED')
  traceAIPlaygroundLifecycle({
    stage: 'PLAYGROUND_REQUEST_RECEIVED',
    requestId: playgroundRequestId,
    startedAtMs: requestStartedAtMs,
  })

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: params.workspaceId,
      members: { some: { user: { clerkId } } },
    },
    include: {
      members: {
        where: { user: { clerkId } },
        include: { user: true },
      },
    },
  })

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const membership = workspace.members[0]
  if (!membership || !canUseAIPlayground(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  stageTracker.checkpoint('AUTHORIZED')

  let parsed: ReturnType<typeof parseAIPlaygroundRunInput>
  stageTracker.enter('REQUEST_VALIDATED')
  try {
    parsed = parseAIPlaygroundRunInput(await request.json())
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid playground request', issues: error.issues },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: 'Invalid playground request' },
      { status: 400 },
    )
  }
  stageTracker.complete('REQUEST_VALIDATED')
  playgroundRequestId = parsed.clientRequestId ?? playgroundRequestId
  stageTracker.setRequestId(playgroundRequestId)
  const providerOption = getAIPlaygroundProviderOptions().find(
    (provider) => provider.id === parsed.providerId,
  )
  if (!providerOption || providerOption.status !== 'available') {
    return NextResponse.json(
      {
        error: 'Provider unavailable',
        providerId: parsed.providerId,
        reason: providerOption?.disabledReason ?? 'Provider is not available.',
      },
      { status: 400 },
    )
  }

  try {
    const capabilities = getWorkspaceCapabilities(workspace as any)
    const { runtime, llmProviderId } = createAIPlaygroundRuntime(
      parsed.providerId,
    )
    traceAIPlaygroundLifecycle({
      stage: 'RUNTIME_REQUEST_CREATED',
      requestId: playgroundRequestId,
      startedAtMs: requestStartedAtMs,
      providerName: parsed.providerId,
      model: llmProviderId,
    })
    traceAIPlaygroundLifecycle({
      stage: 'PROVIDER_SELECTED',
      requestId: playgroundRequestId,
      startedAtMs: requestStartedAtMs,
      providerName: parsed.providerId,
      model: llmProviderId,
      context: {
        providerLabel: providerOption.label,
        runtimeProviderId: providerOption.runtimeProviderId,
      },
    })
    const followUpGrounding = resolvePlaygroundFollowUpGrounding(parsed)
    const effectiveDomainId =
      followUpGrounding.inheritedDomain ?? parsed.domainId
    stageTracker.enter('ENTRY_POINT_RESOLVED')
    const domain = getAIPlaygroundDomain(effectiveDomainId)
    const forcedIntent = getAIPlaygroundIntent(effectiveDomainId, parsed.intent)
    stageTracker.complete('ENTRY_POINT_RESOLVED')
    stageTracker.enter('INTENT_RESOLVED')
    const resolution = resolveWorkspaceAIIntent({
      prompt: parsed.prompt,
      domain:
        parsed.routingMode === 'FORCE_INTENT' &&
        effectiveDomainId !== 'workspace'
          ? effectiveDomainId
          : undefined,
      routingMode: parsed.routingMode,
      forcedIntent:
        parsed.routingMode === 'FORCE_INTENT'
          ? forcedIntent.workspaceIntent
          : undefined,
      contextReferences: parsed.contextReferences,
    })
    const selectedIntent = getResolvedPlaygroundIntent(
      effectiveDomainId,
      resolution,
    )
    stageTracker.complete('INTENT_RESOLVED')
    const now = new Date()
    stageTracker.enter('CONTEXT_ASSEMBLED')
    const schedulingData = await loadSchedulingPageProps({
      workspace: workspace as any,
      capabilities: capabilities.scheduling,
    })
    const timezone = schedulingData.initialSettings.timezone
    const workspaceForAI = {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      timezone,
      businessModel: workspace.businessModel,
    }
    stageTracker.complete('CONTEXT_ASSEMBLED')
    traceAIPlaygroundLifecycle({
      stage: 'WORKSPACE_CONTEXT_ASSEMBLED',
      requestId: playgroundRequestId,
      startedAtMs: requestStartedAtMs,
      providerName: parsed.providerId,
      model: llmProviderId,
    })

    if (resolution.clarificationRequired) {
      const availableOptions = resolution.missingContext.includes('appointment')
        ? await loadClarificationEventOptions({
            workspaceId: params.workspaceId,
            timezone,
            events: schedulingData.initialEvents,
          })
        : []
      return NextResponse.json(
        sanitizeAIPlaygroundOutput(
          buildClarificationPayload({
            workspaceId: workspace.id,
            providerOption,
            selectedIntent,
            resolution,
            availableOptions,
          }),
        ),
      )
    }

    if (selectedIntent.workspaceIntent === 'workspace.investigateQuestion') {
      const actor = {
        userId: membership.userId,
        workspaceMemberId: membership.id,
        role: membership.role,
        permissions: ['workspace:read', 'scheduling:read', 'crm:read'],
      }
      stageTracker.enter('KNOWLEDGE_LOADED')
      const [members, teams, locations, crmSource] = await Promise.all([
        loadSchedulingMembers(params.workspaceId),
        loadSchedulingTeams(params.workspaceId),
        loadSchedulingLocations(params.workspaceId),
        buildCRMKnowledgeSource({
          workspace: workspaceForAI,
          actor,
          now,
          context: 'general',
        }),
      ])
      const schedulingSource = toSchedulingKnowledgeSource({
        workspace,
        timezone,
        capabilities,
        membership,
        schedulingData,
        now,
        members,
        teams,
        locations,
      })
      const workspaceAI = createWorkspaceAIExperience()
      const contextReferences = parsed.contextReferences.map((reference) =>
        toWorkspaceAIContextReference({
          reference,
          domainId: 'workspace',
          providerId:
            reference.kind === 'lead' ||
            reference.kind === 'opportunity' ||
            reference.kind === 'client'
              ? 'crm'
              : 'scheduling',
        }),
      )
      const persistedKnowledge = await loadPersistedWorkspaceKnowledgeSnapshot({
        workspaceId: workspace.id,
      })
      stageTracker.complete('KNOWLEDGE_LOADED')
      const runtimeKnowledgeFingerprint =
        getRuntimeWorkspaceKnowledgeFingerprint(
          persistedKnowledge.approvedKnowledge,
        )
      const governedKnowledge = {
        approvedKnowledge: persistedKnowledge.approvedKnowledge,
        knowledgeGaps: persistedKnowledge.knowledgeGaps,
        confidence: persistedKnowledge.confidence,
        correctionsMetadata: persistedKnowledge.corrections.map(
          (correction) => ({
            id: correction.id,
            status: correction.status,
            submittedAt: correction.submittedAt,
          }),
        ),
        recommendationHistory: persistedKnowledge.recommendationHistory,
        runtimeKnowledgeFingerprint,
        runtimeKnowledgePolicy: 'approved-active-only' as const,
      }
      const session = workspaceAI.createSession({
        id: `playground-workspace-session:${playgroundRequestId}`,
        workspace: workspaceForAI,
        actor,
        entryPointId: 'workspace',
        intent: selectedIntent.workspaceIntent,
        contextReferences,
        now,
      })
      stageTracker.enter('PROVIDER_REQUEST_BUILT')
      stageTracker.complete('PROVIDER_REQUEST_BUILT')
      traceAIPlaygroundLifecycle({
        stage: 'PROVIDER_CONFIGURATION',
        requestId: playgroundRequestId,
        startedAtMs: requestStartedAtMs,
        providerName: parsed.providerId,
        model: llmProviderId,
        responseFormat: selectedIntent.outputType,
        context: {
          domain: effectiveDomainId,
          intent: selectedIntent.workspaceIntent,
        },
      })
      stageTracker.enter('AI_EXPERIENCE_RUN')
      const workspaceAIResponse = await workspaceAI.runRequest({
        request: {
          id: `playground-workspace:${playgroundRequestId}`,
          session,
          requestedIntent: selectedIntent.workspaceIntent,
          requestedOutputType: selectedIntent.outputType,
          contextReferences,
          providerSources: {
            scheduling: schedulingSource,
            crm: crmSource,
          },
          requestText: parsed.prompt,
          conversation: toWorkspaceConversation(parsed.conversation),
          executionMode: 'modelDraft',
          llmProviderId,
          governedKnowledge,
          now,
        },
        runtime,
      })
      stageTracker.complete('AI_EXPERIENCE_RUN')
      traceAIPlaygroundLifecycle({
        stage: 'REASONING_PREPARED',
        requestId: playgroundRequestId,
        startedAtMs: requestStartedAtMs,
        providerName: parsed.providerId,
        model: llmProviderId,
        responseFormat: selectedIntent.outputType,
      })
      const plan = buildWorkspaceAIAnalysisPlan({
        question: parsed.prompt,
        resolution,
        actor,
        workspace: workspaceForAI,
        persistedKnowledge,
      })
      const claims = buildWorkspaceInvestigationClaims({ resolution, plan })
      const runtimeEvents = normalizeRuntimeEvents(
        workspaceAIResponse.runtimeResponse.events,
      )
      const aiProviderInvoked = runtimeEvents.some(
        (event) => event.type === 'AIProviderInvoked',
      )
      if (aiProviderInvoked) {
        stageTracker.checkpoint('PROVIDER_INVOKED')
      }
      stageTracker.checkpoint('PROVIDER_NORMALIZED')
      stageTracker.checkpoint('RESPONSE_VALIDATED')
      stageTracker.checkpoint('OPERATIONAL_INTELLIGENCE_BUILT')
      stageTracker.enter('DEVELOPER_INSPECTION_BUILT')
      const operationalInspection = toOperationalInspection({
        operationalIntelligence: workspaceAIResponse.operationalIntelligence,
        requestId: workspaceAIResponse.runtimeResponse.requestId,
        providerOutcome: workspaceAIResponse.runtimeResponse.providerOutcome,
      })
      stageTracker.complete('DEVELOPER_INSPECTION_BUILT')
      stageTracker.enter('RESPONSE_SERIALIZED')

      const payload = sanitizeAIPlaygroundOutput({
        ok: true,
        provider: providerOption,
        response: {
          id: `workspace-playground-response:${workspaceAIResponse.id}`,
          intent: selectedIntent.value,
          routedIntent: selectedIntent.workspaceIntent,
          responseKind: selectedIntent.outputType,
          confidence: workspaceAIResponse.confidence,
          summary: workspaceInvestigationSummary({ resolution, plan }),
          recommendations: [],
          explanations: [],
          warnings: [
            ...workspaceAIResponse.warnings,
            ...plan.missingData.map((item) => ({
              code: 'missing-data',
              message: item,
              severity: 'info',
            })),
          ],
          references: workspaceAIResponse.references,
          actionProposals: [],
          actionProposalPlans: [],
          actionProposalRequested: parsed.includeActionProposal,
          decisionProposals: [],
          followUpSuggestions: [
            'What should be fixed first?',
            'What data would improve this answer?',
            'Show confirmed facts only',
          ],
          analysisPlan: plan,
          claims,
          workspaceAIResponse,
        },
        inspection: {
          requestId: workspaceAIResponse.runtimeResponse.requestId,
          executionMode: 'modelDraft',
          providerUsage: workspaceAIResponse.providerUsage,
          runtimeEvents,
          toolUsage: workspaceAIResponse.runtimeResponse.toolUsage,
          validation: workspaceAIResponse.runtimeResponse.validation,
          routing: resolution,
          analysisPlan: plan,
          knowledgeProfile: plan.knowledgeGrowth.approvedKnowledge,
          runtimeKnowledgeFingerprint,
          runtimeKnowledgePolicy: 'approved-active-only',
          knowledgeSources: plan.knowledgeGrowth.knowledgeSources,
          knowledgeGaps: plan.knowledgeGrowth.knowledgeGaps,
          learningQueue: plan.knowledgeGrowth.pendingKnowledge,
          recommendationHistory: plan.knowledgeGrowth.recommendationHistory,
          confidenceFactors: plan.confidenceAssessment.factors,
          approvedWorkspaceKnowledge: plan.knowledgeGrowth.approvedKnowledge,
          rejectedKnowledge: plan.knowledgeGrowth.rejectedKnowledge,
          claimProvenance: claims,
          knowledgeTools: workspaceKnowledgeToolCatalog,
          domainCatalog: workspaceAIDomainCatalog,
          ...toReasoningInspection(
            workspaceAIResponse.runtimeResponse.reasoningSnapshot,
          ),
          ...operationalInspection,
          providerVerification: {
            selectedProviderId: parsed.providerId,
            selectedProviderLabel: providerOption.label,
            selectedRuntimeProviderId: providerOption.runtimeProviderId,
            invoked: aiProviderInvoked,
            invokedProviderId: workspaceAIResponse.providerUsage.llmProviderId,
            aiRole: aiProviderInvoked
              ? 'Structured explanation/response generation'
              : workspaceAIResponse.runtimeResponse.providerOutcome ===
                  'deterministicFallback'
                ? 'Deterministic fallback'
                : 'Provider fallback',
            validationStatus: workspaceAIResponse.runtimeResponse.validation
              .valid
              ? 'valid'
              : 'invalid',
          },
          responseNormalization: workspaceAIResponse.normalization,
          recommendationNormalization:
            workspaceAIResponse.recommendationNormalization,
          followUpGrounding,
          actionExecution: 'not-executed',
        },
      })
      stageTracker.complete('RESPONSE_SERIALIZED')
      stageTracker.checkpoint('RESPONSE_RETURNED')
      traceAIPlaygroundLifecycle({
        stage: 'PLAYGROUND_RESPONSE_SENT',
        requestId: playgroundRequestId,
        startedAtMs: requestStartedAtMs,
        providerName: parsed.providerId,
        model: llmProviderId,
        responseFormat: selectedIntent.outputType,
      })
      return NextResponse.json(payload)
    }

    if (parsed.domainId === 'crm') {
      const crmActor = {
        userId: membership.userId,
        workspaceMemberId: membership.id,
        role: membership.role,
        permissions: ['workspace:read', 'crm:read'],
      }
      stageTracker.enter('KNOWLEDGE_LOADED')
      const crmSource = await buildCRMKnowledgeSource({
        workspace: {
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
          timezone,
          businessModel: workspace.businessModel,
        },
        actor: crmActor,
        now,
        context: 'general',
      })
      stageTracker.complete('KNOWLEDGE_LOADED')
      const workspaceAI = createWorkspaceAIExperience()
      const contextReferences = parsed.contextReferences.map((reference) =>
        toWorkspaceAIContextReference({
          reference,
          domainId: 'crm',
          providerId: 'crm',
        }),
      )
      const session = workspaceAI.createSession({
        id: `playground-crm-session:${playgroundRequestId}`,
        workspace: {
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
          timezone,
          businessModel: workspace.businessModel,
        },
        actor: crmActor,
        entryPointId: 'crm',
        intent: selectedIntent.workspaceIntent,
        contextReferences,
        now,
      })
      stageTracker.enter('PROVIDER_REQUEST_BUILT')
      stageTracker.complete('PROVIDER_REQUEST_BUILT')
      traceAIPlaygroundLifecycle({
        stage: 'PROVIDER_CONFIGURATION',
        requestId: playgroundRequestId,
        startedAtMs: requestStartedAtMs,
        providerName: parsed.providerId,
        model: llmProviderId,
        responseFormat: selectedIntent.outputType,
        context: {
          domain: effectiveDomainId,
          intent: selectedIntent.workspaceIntent,
        },
      })
      stageTracker.enter('AI_EXPERIENCE_RUN')
      const workspaceAIResponse = await workspaceAI.runRequest({
        request: {
          id: `playground-crm:${playgroundRequestId}`,
          session,
          requestedIntent: selectedIntent.workspaceIntent,
          requestedOutputType: selectedIntent.outputType,
          contextReferences,
          providerSources: { crm: crmSource },
          requestText: parsed.prompt,
          conversation: toWorkspaceConversation(parsed.conversation),
          executionMode: 'modelDraft',
          llmProviderId,
          now,
        },
        runtime,
      })
      stageTracker.complete('AI_EXPERIENCE_RUN')
      traceAIPlaygroundLifecycle({
        stage: 'REASONING_PREPARED',
        requestId: playgroundRequestId,
        startedAtMs: requestStartedAtMs,
        providerName: parsed.providerId,
        model: llmProviderId,
        responseFormat: selectedIntent.outputType,
      })
      const snapshot = getCRMKnowledgeSnapshot(crmSource)
      const deterministicRecommendations = resolveRecommendations({
        workspace: {
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
          timezone,
          businessModel: workspace.businessModel,
        },
        actor: crmActor,
        requestedIntent: selectedIntent.workspaceIntent,
        providerSources: { crm: crmSource },
      })
      const runtimeEvents = normalizeRuntimeEvents(
        workspaceAIResponse.runtimeResponse.events,
      )
      const aiProviderInvoked = runtimeEvents.some(
        (event) => event.type === 'AIProviderInvoked',
      )
      if (aiProviderInvoked) {
        stageTracker.checkpoint('PROVIDER_INVOKED')
      }
      stageTracker.checkpoint('PROVIDER_NORMALIZED')
      stageTracker.checkpoint('RESPONSE_VALIDATED')
      stageTracker.checkpoint('OPERATIONAL_INTELLIGENCE_BUILT')
      const recommendationSource = {
        sourceEngine: domain.deterministicEngine,
        sourceProviderId: 'crm',
        deterministic: true,
        scoreScale: '0-100',
      }
      stageTracker.enter('DEVELOPER_INSPECTION_BUILT')
      const operationalInspection = toOperationalInspection({
        operationalIntelligence: workspaceAIResponse.operationalIntelligence,
        requestId: workspaceAIResponse.runtimeResponse.requestId,
        providerOutcome: workspaceAIResponse.runtimeResponse.providerOutcome,
      })
      stageTracker.complete('DEVELOPER_INSPECTION_BUILT')
      stageTracker.enter('RESPONSE_SERIALIZED')

      const payload = sanitizeAIPlaygroundOutput({
        ok: true,
        provider: providerOption,
        response: {
          id: `crm-playground-response:${workspaceAIResponse.id}`,
          intent: selectedIntent.value,
          routedIntent: selectedIntent.workspaceIntent,
          responseKind: selectedIntent.outputType,
          confidence: workspaceAIResponse.confidence,
          summary: {
            id: 'crm-playground-summary',
            title: selectedIntent.label,
            summary: crmSummaryText(snapshot),
          },
          recommendations: deterministicRecommendations.map(
            toPlaygroundRecommendation,
          ),
          warnings: [
            ...workspaceAIResponse.warnings,
            ...snapshot.warnings.map((warning) => ({
              code: warning.category,
              message: warning.explanation,
              severity: warning.severity,
            })),
          ],
          references: workspaceAIResponse.references,
          actionProposals: [],
          actionProposalRequested: parsed.includeActionProposal,
          decisionProposals: [],
          workspaceAIResponse,
        },
        inspection: {
          requestId: workspaceAIResponse.runtimeResponse.requestId,
          executionMode: 'modelDraft',
          providerUsage: workspaceAIResponse.providerUsage,
          runtimeEvents,
          toolUsage: workspaceAIResponse.runtimeResponse.toolUsage,
          validation: workspaceAIResponse.runtimeResponse.validation,
          recommendationSource,
          knowledgeProvider: {
            id: 'crm',
            label: domain.deterministicEngine,
            deterministic: true,
          },
          providerVerification: {
            selectedProviderId: parsed.providerId,
            selectedProviderLabel: providerOption.label,
            selectedRuntimeProviderId: providerOption.runtimeProviderId,
            invoked: aiProviderInvoked,
            invokedProviderId: workspaceAIResponse.providerUsage.llmProviderId,
            aiRole: aiProviderInvoked
              ? 'Structured explanation/response generation'
              : workspaceAIResponse.runtimeResponse.providerOutcome ===
                  'deterministicFallback'
                ? 'Deterministic fallback'
                : 'Provider fallback',
            recommendationSource,
            validationStatus: workspaceAIResponse.runtimeResponse.validation
              .valid
              ? 'valid'
              : 'invalid',
          },
          responseNormalization: workspaceAIResponse.normalization,
          recommendationNormalization:
            workspaceAIResponse.recommendationNormalization,
          ...toReasoningInspection(
            workspaceAIResponse.runtimeResponse.reasoningSnapshot,
          ),
          ...operationalInspection,
          followUpGrounding,
          actionExecution: 'not-executed',
        },
      })
      stageTracker.complete('RESPONSE_SERIALIZED')
      stageTracker.checkpoint('RESPONSE_RETURNED')
      traceAIPlaygroundLifecycle({
        stage: 'PLAYGROUND_RESPONSE_SENT',
        requestId: playgroundRequestId,
        startedAtMs: requestStartedAtMs,
        providerName: parsed.providerId,
        model: llmProviderId,
        responseFormat: selectedIntent.outputType,
      })
      return NextResponse.json(payload)
    }

    stageTracker.enter('KNOWLEDGE_LOADED')
    const [members, teams, locations] = await Promise.all([
      loadSchedulingMembers(params.workspaceId),
      loadSchedulingTeams(params.workspaceId),
      loadSchedulingLocations(params.workspaceId),
    ])
    stageTracker.complete('KNOWLEDGE_LOADED')
    const schedulingSource: SchedulingKnowledgeInput = {
      workspace: {
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        timezone,
      },
      settings: schedulingData.initialSettings,
      capabilities: capabilities.scheduling,
      now,
      actor: {
        role: membership.role,
        workspaceMemberId: membership.id,
        canViewAllScheduling: true,
      },
      members,
      teams,
      locations,
      events: schedulingData.initialEvents,
      recurringSeries: schedulingData.initialSeries,
      availability: schedulingData.initialAvailability,
      externalAvailability: [],
      calendarConnections: [],
    }

    const context = parsed.contextReferences.map(toSchedulingAIObjectReference)
    stageTracker.enter('PROVIDER_REQUEST_BUILT')
    stageTracker.complete('PROVIDER_REQUEST_BUILT')
    traceAIPlaygroundLifecycle({
      stage: 'PROVIDER_CONFIGURATION',
      requestId: playgroundRequestId,
      startedAtMs: requestStartedAtMs,
      providerName: parsed.providerId,
      model: llmProviderId,
      responseFormat: selectedIntent.outputType,
      context: {
        domain: effectiveDomainId,
        intent: selectedIntent.workspaceIntent,
      },
    })
    stageTracker.enter('AI_EXPERIENCE_RUN')
    const response = await runSchedulingAIRequest({
      request: {
        id: `playground:${playgroundRequestId}`,
        workspace: {
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
          timezone,
          businessModel: workspace.businessModel,
        },
        actor: {
          userId: membership.userId,
          workspaceMemberId: membership.id,
          role: membership.role,
          permissions: ['workspace:read', 'scheduling:read'],
        },
        intent: selectedIntent.value as any,
        schedulingSource,
        requestText: parsed.prompt,
        conversation: toWorkspaceConversation(parsed.conversation),
        currentEvent: firstContext(context, 'event'),
        currentTechnician: firstContext(context, 'technician'),
        currentTeam: firstContext(context, 'team'),
        currentLocation: firstContext(context, 'location'),
        currentCalendar: firstContext(context, 'calendar'),
        currentWorkspace: firstContext(context, 'workspace') ?? {
          id: workspace.id,
          kind: 'workspace',
          label: workspace.name,
          referenceId: workspace.id,
        },
        currentSelection: context.filter((item) => item.kind === 'selection'),
        dateKey: getWorkspaceDateKey(now, timezone),
        durationMinutes: 60,
        includeActionProposal: parsed.includeActionProposal,
        proposedActionType: parsed.proposedActionType,
        executionMode: 'modelDraft',
        llmProviderId,
        now,
      },
      runtime,
    })
    stageTracker.complete('AI_EXPERIENCE_RUN')
    traceAIPlaygroundLifecycle({
      stage: 'REASONING_PREPARED',
      requestId: playgroundRequestId,
      startedAtMs: requestStartedAtMs,
      providerName: parsed.providerId,
      model: llmProviderId,
      responseFormat: selectedIntent.outputType,
    })
    const runtimeEvents = normalizeRuntimeEvents(
      response.workspaceAIResponse.runtimeResponse.events,
    )
    const aiProviderInvoked = runtimeEvents.some(
      (event) => event.type === 'AIProviderInvoked',
    )
    if (aiProviderInvoked) {
      stageTracker.checkpoint('PROVIDER_INVOKED')
    }
    stageTracker.checkpoint('PROVIDER_NORMALIZED')
    stageTracker.checkpoint('RESPONSE_VALIDATED')
    stageTracker.checkpoint('OPERATIONAL_INTELLIGENCE_BUILT')
    stageTracker.enter('DEVELOPER_INSPECTION_BUILT')
    const operationalInspection = toOperationalInspection({
      operationalIntelligence:
        response.workspaceAIResponse.operationalIntelligence,
      requestId: response.workspaceAIResponse.runtimeResponse.requestId,
      providerOutcome:
        response.workspaceAIResponse.runtimeResponse.providerOutcome,
    })
    stageTracker.complete('DEVELOPER_INSPECTION_BUILT')
    stageTracker.enter('RESPONSE_SERIALIZED')

    const payload = sanitizeAIPlaygroundOutput({
      ok: true,
      provider: providerOption,
      response: {
        ...response,
        actionProposalRequested: parsed.includeActionProposal,
      },
      inspection: {
        requestId: response.workspaceAIResponse.runtimeResponse.requestId,
        executionMode: 'modelDraft',
        providerUsage: response.workspaceAIResponse.providerUsage,
        runtimeEvents,
        toolUsage: response.workspaceAIResponse.runtimeResponse.toolUsage,
        validation: response.workspaceAIResponse.runtimeResponse.validation,
        recommendationSource: SCHEDULING_RECOMMENDATION_PROVENANCE,
        providerVerification: {
          selectedProviderId: parsed.providerId,
          selectedProviderLabel: providerOption.label,
          selectedRuntimeProviderId: providerOption.runtimeProviderId,
          invoked: aiProviderInvoked,
          invokedProviderId:
            response.workspaceAIResponse.providerUsage.llmProviderId,
          aiRole: aiProviderInvoked
            ? 'Structured explanation/response generation'
            : response.workspaceAIResponse.runtimeResponse.providerOutcome ===
                'deterministicFallback'
              ? 'Deterministic fallback'
              : 'Provider fallback',
          recommendationSource: SCHEDULING_RECOMMENDATION_PROVENANCE,
          validationStatus: response.workspaceAIResponse.runtimeResponse
            .validation.valid
            ? 'valid'
            : 'invalid',
        },
        responseNormalization: response.workspaceAIResponse.normalization,
        recommendationNormalization:
          response.workspaceAIResponse.recommendationNormalization,
        routing: resolution,
        followUpGrounding,
        knowledgeTools: workspaceKnowledgeToolCatalog,
        domainCatalog: workspaceAIDomainCatalog,
        ...toReasoningInspection(
          response.workspaceAIResponse.runtimeResponse.reasoningSnapshot,
        ),
        ...operationalInspection,
        actionExecution: 'not-executed',
      },
    })
    stageTracker.complete('RESPONSE_SERIALIZED')
    stageTracker.checkpoint('RESPONSE_RETURNED')
    traceAIPlaygroundLifecycle({
      stage: 'PLAYGROUND_RESPONSE_SENT',
      requestId: playgroundRequestId,
      startedAtMs: requestStartedAtMs,
      providerName: parsed.providerId,
      model: llmProviderId,
      responseFormat: selectedIntent.outputType,
    })
    return NextResponse.json(payload)
  } catch (error) {
    const trackerSnapshot = stageTracker.snapshot()
    const responseGenerated =
      trackerSnapshot.completedStages.includes('RESPONSE_VALIDATED')
    const diagnostic = isAIProviderException(error)
      ? createAIPlaygroundDiagnosticFromProviderError({
          tracker: stageTracker,
          providerError: error.providerError,
          responseGenerated,
        })
      : createAIPlaygroundDiagnosticFromStage({
          tracker: stageTracker,
          responseGenerated,
          providerOutcome: trackerSnapshot.completedStages.includes(
            'PROVIDER_INVOKED',
          )
            ? 'unknownAfterProviderInvocation'
            : undefined,
          workspaceAIExperience:
            isWorkspaceAIExperienceAssemblyError(error) &&
            process.env.NODE_ENV === 'development'
              ? error.diagnostic
              : undefined,
        })
    logAIPlaygroundServerError({
      requestId: playgroundRequestId,
      stage: diagnostic.failureStage,
      error,
      context: {
        workspaceId: params.workspaceId,
        userId: membership.userId,
        workspaceMemberId: membership.id,
        prompt: parsed.prompt,
        domain: parsed.domainId,
        provider: parsed.providerId,
        routingMode: parsed.routingMode,
        currentStage: trackerSnapshot.currentStage,
        lastCompletedStage: diagnostic.lastCompletedStage,
        nextExpectedStage: diagnostic.nextExpectedStage,
        responseGenerated: diagnostic.responseGenerated,
        persistenceAttempted: diagnostic.persistenceAttempted,
        providerErrorCode: isAIProviderException(error)
          ? error.providerError.code
          : undefined,
        providerErrorMessage: isAIProviderException(error)
          ? error.providerError.message
          : undefined,
        providerRetryable: isAIProviderException(error)
          ? error.providerError.retryable
          : undefined,
        developerInspectionStarted: trackerSnapshot.completedStages.includes(
          'OPERATIONAL_INTELLIGENCE_BUILT',
        ),
        workspaceAIExperience: isWorkspaceAIExperienceAssemblyError(error)
          ? error.diagnostic
          : undefined,
      },
    })
    return NextResponse.json(
      sanitizeAIPlaygroundOutput(
        buildAIPlaygroundFailurePayload({
          requestId: playgroundRequestId,
          diagnostic,
        }),
      ),
      { status: 500 },
    )
  }
}

function toReasoningInspection(reasoningSnapshot: unknown) {
  const snapshot =
    reasoningSnapshot && typeof reasoningSnapshot === 'object'
      ? (reasoningSnapshot as Record<string, unknown>)
      : null
  return {
    reasoningSnapshot,
    investigationGoal: snapshot?.investigationGoal,
    investigationPlan: snapshot?.investigationPlan,
    evidence: snapshot?.evidence,
    evidenceGroups: snapshot?.evidenceGroups,
    businessRules: snapshot?.businessRulesApplied,
    contradictions: snapshot?.contradictions,
    missingData: snapshot?.missingInformation,
    reasoningChain: snapshot?.reasoningChain,
    rootCauseRanking: snapshot?.rootCauseRanking,
    recommendationRanking: snapshot?.recommendationRanking,
    proposalCandidates: snapshot?.proposalCandidates,
    coverageReport: snapshot?.coverageReport,
    confidenceReport: snapshot?.confidenceReport,
    learningOpportunities: snapshot?.learningOpportunities,
  }
}

function toOperationalInspection({
  operationalIntelligence,
  requestId,
  providerOutcome,
}: {
  operationalIntelligence: unknown
  requestId: string
  providerOutcome?: string
}) {
  return buildPlaygroundOperationalInspection({
    operationalIntelligence,
    requestId,
    providerOutcome,
    onInspectionError: (error) =>
      logAIPlaygroundServerError({
        requestId,
        stage: 'developerInspection',
        error,
      }),
  })
}

function toWorkspaceConversation(
  conversation: ReturnType<typeof parseAIPlaygroundRunInput>['conversation'],
): WorkspaceAIConversationRequest | undefined {
  if (!conversation || conversation.priorTurns.length === 0) return undefined
  return {
    metadata: {
      conversationId: conversation.currentTurnId
        ? `playground-thread:${conversation.currentTurnId}`
        : 'playground-thread',
      turnId: conversation.currentTurnId,
      channel: 'api',
      source: 'workspace',
    },
    turns: conversation.priorTurns.map((turn) => ({
      id: turn.id,
      intent: getAIPlaygroundIntent(turn.domain, turn.intent).workspaceIntent,
      references: (turn.referenceIds ?? []).map((referenceId) => ({
        id: referenceId,
        label: referenceId,
        source: 'conversation',
      })),
      createdAt: turn.createdAt,
      requestMessage: {
        id: `${turn.id}:request`,
        role: 'user',
        createdAt: turn.createdAt,
      },
      responseMessage: turn.responseSummary
        ? {
            id: `${turn.id}:response`,
            role: 'assistant',
            createdAt: turn.createdAt,
          }
        : undefined,
    })),
  }
}

function getResolvedPlaygroundIntent(
  domainId: AIPlaygroundDomainId,
  resolution: WorkspaceAIIntentResolution,
): AIPlaygroundIntentOption {
  const domain = getAIPlaygroundDomain(domainId)
  return (
    domain.intents.find(
      (intent) => intent.workspaceIntent === resolution.matchedIntent,
    ) ?? getAIPlaygroundDomain('workspace').intents[0]
  )
}

function resolvePlaygroundFollowUpGrounding(
  parsed: ReturnType<typeof parseAIPlaygroundRunInput>,
) {
  const priorTurn = parsed.conversation?.priorTurns.at(-1)
  const isFollowUp = Boolean(priorTurn)
  const ambiguous = isReferentialFollowUp(parsed.prompt)
  const explicitTopicChange = hasExplicitTopicChange(parsed.prompt)
  const shouldInherit = isFollowUp && ambiguous && !explicitTopicChange
  return {
    isFollowUp,
    inheritedDomain: shouldInherit ? priorTurn?.domain : undefined,
    inheritedIntent: shouldInherit ? priorTurn?.intent : undefined,
    resolvedReferences: shouldInherit ? ['previous-answer'] : [],
    evidenceRefreshed: false,
    topicSwitchReason: explicitTopicChange
      ? 'explicit-topic-change'
      : shouldInherit
        ? 'referential-follow-up'
        : isFollowUp
          ? 'new-question-or-resolved-with-current-prompt'
          : 'new-test',
    unresolvedAmbiguity: isFollowUp && ambiguous && !shouldInherit,
  }
}

function isReferentialFollowUp(prompt: string) {
  return /\b(which one|that|the first one|why|what should i do|show me more|which is most urgent|handle first|fix first|tell me more)\b/i.test(
    prompt,
  )
}

function hasExplicitTopicChange(prompt: string) {
  return /\b(now|switch to|instead)\b.*\b(schedule|scheduling|crm|lead|opportunit|task|service request|automation|workflow|marketing|finance)\b/i.test(
    prompt,
  )
}

function buildClarificationPayload({
  workspaceId,
  providerOption,
  selectedIntent,
  resolution,
  availableOptions,
}: {
  workspaceId: string
  providerOption: AIPlaygroundProviderOption
  selectedIntent: AIPlaygroundIntentOption
  resolution: WorkspaceAIIntentResolution
  availableOptions?: Array<ReturnType<typeof toClarificationEventOption>>
}) {
  return {
    ok: true,
    provider: providerOption,
    response: {
      id: `clarification-playground-response:${workspaceId}`,
      intent: selectedIntent.value,
      routedIntent: resolution.matchedIntent,
      responseKind: 'clarification',
      confidence: resolution.confidence,
      summary: {
        id: 'workspace-ai-clarification',
        title: 'Clarification needed',
        summary:
          resolution.clarificationQuestion ??
          'Skillify needs more context before preparing a safe response.',
      },
      warnings: [
        {
          code: 'missing-context',
          message: 'Required context is missing for this request.',
          severity: 'info',
        },
      ],
      clarification: {
        question: resolution.clarificationQuestion,
        missingContext: resolution.missingContext,
        availableOptions: availableOptions ?? resolution.availableContext,
        suggestedSelections: availableOptions ?? [],
        blocking: true,
        references: [],
      },
      recommendations: [],
      explanations: [],
      references: [],
      actionProposals: [],
      actionProposalPlans: [],
      decisionProposals: [],
      followUpSuggestions: [
        'Show me the appointment options',
        'Select an appointment',
        'Compare available technicians',
        'Explain assignment requirements',
      ],
    },
    inspection: {
      requestId: `clarification:${workspaceId}`,
      executionMode: 'prepareOnly',
      runtimeEvents: [],
      routing: resolution,
      analysisPlan: null,
      claimProvenance: [],
      knowledgeTools: workspaceKnowledgeToolCatalog,
      domainCatalog: workspaceAIDomainCatalog,
      validation: {
        valid: true,
        warnings: [
          {
            code: 'clarification-required',
            message: resolution.clarificationQuestion,
            severity: 'info',
          },
        ],
      },
      actionExecution: 'not-executed',
    },
  }
}

async function loadClarificationEventOptions({
  workspaceId,
  timezone,
  events,
}: {
  workspaceId: string
  timezone: string
  events: SchedulingEvent[]
}) {
  const [members, teams] = await Promise.all([
    loadSchedulingMembers(workspaceId),
    loadSchedulingTeams(workspaceId),
  ])
  const memberLabels = new Map(
    members.map((member) => [member.id, member.label]),
  )
  const teamLabels = new Map(teams.map((team) => [team.id, team.label]))
  return [...events]
    .sort((first, second) => {
      const now = Date.now()
      const firstPast = new Date(first.endsAt).getTime() < now
      const secondPast = new Date(second.endsAt).getTime() < now
      if (firstPast !== secondPast) return firstPast ? 1 : -1
      const diff =
        new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()
      if (diff !== 0) return firstPast ? -diff : diff
      return first.id.localeCompare(second.id)
    })
    .slice(0, 5)
    .map((event) =>
      toClarificationEventOption({ event, timezone, memberLabels, teamLabels }),
    )
}

function toClarificationEventOption({
  event,
  timezone,
  memberLabels,
  teamLabels,
}: {
  event: SchedulingEvent
  timezone: string
  memberLabels: Map<string, string>
  teamLabels: Map<string, string>
}) {
  const dateTimeLabel = formatDateTime(event.startsAt, timezone)
  const assignmentLabel = event.assignedMemberIds.length
    ? event.assignedMemberIds
        .map((id) => memberLabels.get(id) ?? teamLabels.get(id))
        .filter(Boolean)
        .join(', ') || 'Assigned'
    : 'Unassigned'
  const customerLabel =
    event.linkedRecord?.label ??
    event.locationLabel ??
    event.location ??
    'No customer/location'
  return {
    kind: 'event' as const,
    id: event.id,
    label: [event.title, customerLabel, dateTimeLabel, assignmentLabel]
      .filter(Boolean)
      .join(' — ')
      .slice(0, 160),
    secondaryLabel: [
      schedulingStatusLabels[event.status],
      event.locationLabel ?? event.location,
      event.allDay
        ? 'All day'
        : `${formatTimeOnly(event.startsAt, timezone)}-${formatTimeOnly(event.endsAt, timezone)}`,
    ]
      .filter(Boolean)
      .join(' · '),
    metadata: {
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      dateTimeLabel,
      assignmentLabel,
      locationLabel: event.locationLabel ?? event.location,
      customerLabel,
      status: schedulingStatusLabels[event.status],
    },
  }
}

function workspaceInvestigationSummary({
  resolution,
  plan,
}: {
  resolution: WorkspaceAIIntentResolution
  plan: ReturnType<typeof buildWorkspaceAIAnalysisPlan>
}) {
  const availableDomains =
    resolution.detectedDomains
      .filter(
        (domainId) =>
          workspaceAIDomainCatalog.find((domain) => domain.id === domainId)
            ?.availability !== 'deferred',
      )
      .join(', ') || 'workspace'
  const missing = plan.missingData.length
    ? ` Missing data: ${plan.missingData.join(', ')}.`
    : ''
  const coverage =
    plan.partialDomains.length || plan.unavailableDomains.length
      ? ` Scope is limited to inspected domains: ${plan.inspectedDomains.join(', ') || 'registered available tools'}.`
      : ''
  return {
    id: plan.id,
    title: 'Workspace Investigation',
    summary:
      `Skillify prepared a read-only investigation plan for ${availableDomains}. ` +
      `The answer should distinguish confirmed facts, derived metrics, inferences, general guidance, unknowns, and data-quality limitations.${coverage}${missing}`,
    items: plan.steps.map((step) => ({
      id: `${plan.id}:step:${step.order}`,
      label: step.purpose,
      status: step.status,
      toolId: step.toolId,
    })),
  }
}

function toSchedulingKnowledgeSource({
  workspace,
  timezone,
  capabilities,
  membership,
  schedulingData,
  now,
  members,
  teams,
  locations,
}: {
  workspace: {
    id: string
    slug: string
    name: string
  }
  timezone: string
  capabilities: ReturnType<typeof getWorkspaceCapabilities>
  membership: {
    id: string
    role: string
  }
  schedulingData: Awaited<ReturnType<typeof loadSchedulingPageProps>>
  now: Date
  members: Awaited<ReturnType<typeof loadSchedulingMembers>>
  teams: Awaited<ReturnType<typeof loadSchedulingTeams>>
  locations: Awaited<ReturnType<typeof loadSchedulingLocations>>
}): SchedulingKnowledgeInput {
  return {
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      timezone,
    },
    settings: schedulingData.initialSettings,
    capabilities: capabilities.scheduling,
    now,
    actor: {
      role: membership.role,
      workspaceMemberId: membership.id,
      canViewAllScheduling: true,
    },
    members,
    teams,
    locations,
    events: schedulingData.initialEvents,
    recurringSeries: schedulingData.initialSeries,
    availability: schedulingData.initialAvailability,
    externalAvailability: [],
    calendarConnections: [],
  }
}

function toPlaygroundRecommendation(recommendation: WorkspaceRecommendation) {
  return {
    ...recommendation,
    label: recommendation.subject.label,
    provenance: {
      sourceEngine:
        typeof recommendation.metadata?.crmRecommendation === 'object'
          ? 'CRM Knowledge Provider'
          : 'CRM Knowledge Provider',
      sourceProviderId: recommendation.providerId,
      deterministic: true,
      scoreScale: String(recommendation.metadata?.scoreScale ?? '0-100'),
      aiProviderGeneratedExplanation: false,
    },
  }
}

function crmSummaryText(snapshot: ReturnType<typeof getCRMKnowledgeSnapshot>) {
  return [
    snapshot.summaries.leadPipelineSummary,
    snapshot.summaries.opportunityPipelineSummary,
    `${snapshot.recommendations.length} deterministic CRM recommendation${snapshot.recommendations.length === 1 ? '' : 's'} available.`,
    `${snapshot.dataQuality.length} CRM data-quality finding${snapshot.dataQuality.length === 1 ? '' : 's'} found.`,
  ].join(' ')
}

function firstContext(
  references: SchedulingAIObjectReference[],
  kind: SchedulingAIObjectReference['kind'],
) {
  return references.find((reference) => reference.kind === kind)
}

async function loadSchedulingMembers(workspaceId: string) {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: true,
      teamMemberships: { select: { teamId: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return members.map((member) => ({
    id: member.id,
    label: member.user.fullName || member.user.email || 'Workspace member',
    status: 'active' as const,
    teamIds: member.teamMemberships.map((item) => item.teamId),
  }))
}

async function loadSchedulingTeams(workspaceId: string) {
  const teams = await prisma.workspaceTeam.findMany({
    where: { workspaceId, isActive: true, archivedAt: null },
    include: { members: { select: { workspaceMemberId: true } } },
    orderBy: { name: 'asc' },
  })
  return teams.map((team) => ({
    id: team.id,
    label: team.name,
    status: 'active' as const,
    memberIds: team.members.map((item) => item.workspaceMemberId),
  }))
}

async function loadSchedulingLocations(workspaceId: string) {
  const locations = await prisma.workspaceLocation.findMany({
    where: { workspaceId, isActive: true, archivedAt: null },
    orderBy: { name: 'asc' },
  })
  return locations.map((location) => ({
    id: location.id,
    label: location.name,
    status: 'active' as const,
  }))
}
