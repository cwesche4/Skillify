'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import {
  AlertTriangle,
  Bot,
  ClipboardList,
  Play,
  RefreshCw,
} from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import type {
  AIPlaygroundContextGroup,
  AIPlaygroundContextOption,
  AIPlaygroundDomainDefinition,
  AIPlaygroundDomainId,
  AIPlaygroundIntent,
  AIPlaygroundProviderOption,
  AIPlaygroundProviderId,
} from '@/lib/ai/playground/aiPlayground'
import {
  buildAIPlaygroundReadableResult,
  type AIPlaygroundReadableResult,
} from '@/lib/ai/playground/readableResult'
import {
  buildAIPlaygroundConversationContext,
  type AIPlaygroundConversationTurn,
} from '@/lib/ai/playground/conversation'
import { normalizeRuntimeEvents } from '@/lib/ai/playground/runtimeEvents'
import type { AIPlaygroundDiagnostic } from '@/lib/ai/playground/playgroundReliability'
import type { SchedulingAIActionProposalType } from '@/lib/ai/experience/schedulingAIExperience'
import type { WorkspaceAIRoutingMode } from '@/lib/ai/workspaceInvestigation'

type InternalAIPlaygroundProps = {
  workspaceId: string
  workspaceSlug: string
  workspaceName: string
  domains: AIPlaygroundDomainDefinition[]
  providerOptions: AIPlaygroundProviderOption[]
  contextOptions: Record<string, AIPlaygroundContextGroup[]>
}

type PlaygroundResult = {
  ok?: boolean
  error?: string
  reason?: string
  diagnostic?: AIPlaygroundDiagnostic
  provider?: AIPlaygroundProviderOption
  response?: any
  inspection?: {
    requestId?: string
    playgroundDiagnostics?: AIPlaygroundDiagnostic[]
    executionMode?: string
    routing?: unknown
    analysisPlan?: unknown
    knowledgeProfile?: unknown
    knowledgeSources?: unknown
    knowledgeGaps?: unknown
    learningQueue?: unknown
    recommendationHistory?: unknown
    confidenceFactors?: unknown
    missingData?: unknown
    approvedWorkspaceKnowledge?: unknown
    rejectedKnowledge?: unknown
    claimProvenance?: unknown
    knowledgeTools?: unknown
    domainCatalog?: unknown
    providerUsage?: unknown
    runtimeEvents?: unknown
    toolUsage?: unknown
    validation?: unknown
    recommendationSource?: {
      sourceEngine?: string
      sourceProviderId?: string
      deterministic?: boolean
      scoreScale?: string
    }
    providerVerification?: {
      selectedProviderId?: string
      selectedProviderLabel?: string
      selectedRuntimeProviderId?: string
      invoked?: boolean
      invokedProviderId?: string
      aiRole?: string
      validationStatus?: string
      recommendationSource?: {
        sourceEngine?: string
        sourceProviderId?: string
        deterministic?: boolean
        scoreScale?: string
      }
    }
    responseNormalization?: unknown
    recommendationNormalization?: unknown
    followUpGrounding?: unknown
    actionExecution?: string
    reasoningSnapshot?: unknown
    investigationGoal?: unknown
    investigationPlan?: unknown
    evidence?: unknown
    evidenceGroups?: unknown
    businessRules?: unknown
    contradictions?: unknown
    reasoningChain?: unknown
    rootCauseRanking?: unknown
    recommendationRanking?: unknown
    proposalCandidates?: unknown
    coverageReport?: unknown
    confidenceReport?: unknown
    learningOpportunities?: unknown
    operationalIntelligence?: unknown
    operationalInsights?: unknown
    decisionExplanation?: unknown
    businessRulesApplied?: unknown
    rejectedAlternatives?: unknown
    evidenceRanking?: unknown
    knowledgeEffectiveness?: unknown
    insightGeneration?: unknown
    recommendationJustification?: unknown
    operationalHealth?: unknown
    futureDashboardSignals?: unknown
    operationalHistory?: unknown
    operationalTrends?: unknown
    insightLifecycle?: unknown
    recurringRisks?: unknown
    recommendationOutcomes?: unknown
    dashboardSignals?: unknown
    operationalTimeline?: unknown
    healthEvolution?: unknown
    trendGraphData?: unknown
    operationalConfidence?: unknown
  }
}

const actionProposalOptions: Array<{
  value: 'auto' | SchedulingAIActionProposalType
  label: string
}> = [
  { value: 'auto', label: 'Auto-select best action' },
  { value: 'assignTechnician', label: 'Assign technician' },
  { value: 'moveAppointment', label: 'Move appointment' },
  { value: 'changeTeam', label: 'Change team' },
  { value: 'notifyCustomer', label: 'Notify customer' },
  { value: 'createTask', label: 'Create task' },
  { value: 'updateRecurringSchedule', label: 'Update recurring schedule' },
]

export function InternalAIPlayground({
  workspaceId,
  workspaceSlug,
  workspaceName,
  domains,
  providerOptions,
  contextOptions,
}: InternalAIPlaygroundProps) {
  const defaultDomain = domains[0]
  const defaultProvider =
    providerOptions.find((provider) => provider.id === 'mock') ??
    providerOptions[0]
  const [domainId, setDomainId] = useState<AIPlaygroundDomainId>(
    defaultDomain?.id ?? 'scheduling',
  )
  const [providerId, setProviderId] = useState<AIPlaygroundProviderId>(
    defaultProvider?.id ?? 'mock',
  )
  const [routingMode, setRoutingMode] =
    useState<WorkspaceAIRoutingMode>('AUTO_DETECT')
  const [intent, setIntent] = useState<AIPlaygroundIntent>(
    defaultDomain?.defaultIntent ?? 'analyzeSchedule',
  )
  const [prompt, setPrompt] = useState(
    defaultDomain?.defaultPrompt ??
      'Recommend the best scheduling next step using the current workspace context.',
  )
  const [includeActionProposal, setIncludeActionProposal] = useState(false)
  const [proposedActionType, setProposedActionType] = useState<
    'auto' | SchedulingAIActionProposalType
  >('auto')
  const [selectedContextIds, setSelectedContextIds] = useState<
    Record<string, string>
  >({})
  const [result, setResult] = useState<PlaygroundResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [showInspection, setShowInspection] = useState(false)
  const [followUpPrompt, setFollowUpPrompt] = useState('')
  const [conversationTurns, setConversationTurns] = useState<
    AIPlaygroundConversationTurn[]
  >([])
  const responseRef = useRef<HTMLDivElement>(null)
  const activeRequestRef = useRef<AbortController | null>(null)

  const selectedProvider = providerOptions.find(
    (provider) => provider.id === providerId,
  )
  const selectedDomain =
    domains.find((domain) => domain.id === domainId) ?? defaultDomain
  const domainContextGroups = useMemo(
    () => contextOptions[domainId] ?? [],
    [contextOptions, domainId],
  )
  const disabledReason = selectedProvider?.disabledReason

  const selectedContext = useMemo(() => {
    const refs: AIPlaygroundContextOption[] = [
      {
        kind: 'workspace',
        id: workspaceId,
        label: workspaceName,
      },
    ]
    for (const group of domainContextGroups) {
      addContext(refs, group.options, selectedContextIds[group.id] ?? '')
    }
    return refs
  }, [domainContextGroups, selectedContextIds, workspaceId, workspaceName])
  const clarificationMissingContext = result?.ok
    ? readStringArray((result.response as any)?.clarification?.missingContext)
    : []
  const eventContextOptions =
    domainContextGroups.find((group) => group.id === 'events')?.options ?? []
  const selectedEvent = selectedContext.find((item) => item.kind === 'event')

  function selectContextOption(option: AIPlaygroundContextOption) {
    const group = domainContextGroups.find((item) =>
      item.options.some(
        (candidate) =>
          candidate.kind === option.kind && candidate.id === option.id,
      ),
    )
    if (!group) return
    setSelectedContextIds((current) => ({
      ...current,
      [group.id]: option.id,
    }))
    setResult(null)
    setShowInspection(false)
    setFollowUpPrompt('')
  }

  function selectDomain(nextDomainId: AIPlaygroundDomainId) {
    const nextDomain = domains.find((domain) => domain.id === nextDomainId)
    if (!nextDomain) return
    setDomainId(nextDomain.id)
    setRoutingMode('AUTO_DETECT')
    setIntent(nextDomain.defaultIntent)
    setPrompt(nextDomain.defaultPrompt)
    setIncludeActionProposal(false)
    setSelectedContextIds({})
    setResult(null)
    setShowInspection(false)
    setFollowUpPrompt('')
    setConversationTurns([])
  }

  function selectProvider(nextProviderId: AIPlaygroundProviderId) {
    setProviderId(nextProviderId)
    setResult(null)
    setShowInspection(false)
    setConversationTurns([])
    setFollowUpPrompt('')
  }

  function selectIntent(nextIntent: AIPlaygroundIntent) {
    setIntent(nextIntent)
    setResult(null)
    setShowInspection(false)
    setConversationTurns([])
    setFollowUpPrompt('')
  }

  useEffect(() => {
    if (!result?.ok) return
    const responseNode = responseRef.current
    if (!responseNode) return
    try {
      responseNode.focus({ preventScroll: true })
    } catch {
      responseNode.focus()
    }
    responseNode.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }, [result])

  async function runPlayground({
    promptText = prompt,
    isFollowUp = false,
    requestIdOverride,
  }: {
    promptText?: string
    isFollowUp?: boolean
    requestIdOverride?: string
  } = {}) {
    const trimmedPrompt = promptText.trim()
    if (!trimmedPrompt) return
    if (isRunning) return
    activeRequestRef.current?.abort()
    const controller = new AbortController()
    activeRequestRef.current = controller
    const clientRequestId =
      requestIdOverride ?? createClientPlaygroundRequestId()
    setIsRunning(true)
    setResult(null)
    const currentTurnId = `playground-turn:${Date.now()}`
    const priorTurns = isFollowUp ? conversationTurns : []
    if (!isFollowUp) {
      setConversationTurns([])
    }
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/ai-playground/run`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            domainId,
            routingMode,
            intent,
            prompt: trimmedPrompt,
            includeActionProposal:
              Boolean(selectedDomain?.allowActionProposals) &&
              includeActionProposal,
            proposedActionType:
              selectedDomain?.allowActionProposals &&
              includeActionProposal &&
              proposedActionType !== 'auto'
                ? proposedActionType
                : undefined,
            contextReferences: selectedContext,
            clientRequestId,
            conversation: buildAIPlaygroundConversationContext({
              currentTurnId,
              priorTurns,
              selectedContext,
            }),
          }),
          signal: controller.signal,
        },
      )
      const body = (await parsePlaygroundJson(response)) as PlaygroundResult
      setResult(response.ok ? body : { ...body, ok: false })
      if (response.ok && body.ok) {
        const readable = buildAIPlaygroundReadableResult(body)
        const responseRecord = body.response as
          | Record<string, unknown>
          | undefined
        setConversationTurns((current) =>
          [
            ...(isFollowUp ? current : []),
            {
              id: currentTurnId,
              role: 'user' as const,
              domain: inferConversationDomain(
                responseRecord?.routedIntent,
                domainId,
              ),
              intent: inferConversationIntent(
                responseRecord?.intent,
                responseRecord?.routedIntent,
                intent,
              ),
              prompt: trimmedPrompt,
              createdAt: new Date().toISOString(),
              responseSummary: readable.summary,
              referenceIds: readReferenceIds(responseRecord?.references),
              proposedActionIds: readable.proposals.map(
                (proposal) => proposal.id,
              ),
              warningSummaries: readable.warnings.map(
                (warning) => warning.message,
              ),
            },
          ].slice(-8),
        )
        if (isFollowUp) setFollowUpPrompt('')
      }
    } catch (error) {
      if (isAbortError(error)) return
      const diagnostic: AIPlaygroundDiagnostic = {
        requestId: clientRequestId,
        failureStage: 'responseSerialization',
        safeCode: 'CLIENT_RESPONSE_PARSE_FAILED',
        safeMessage:
          'The playground request completed without a readable JSON response.',
        retryable: true,
        responseGenerated: false,
        persistenceAttempted: false,
        persistenceSucceeded: false,
        timestamp: new Date().toISOString(),
      }
      setResult({
        ok: false,
        error:
          'The internal playground request failed before a response was returned.',
        reason: diagnostic.safeMessage,
        diagnostic,
        inspection: {
          requestId: clientRequestId,
          playgroundDiagnostics: [diagnostic],
          actionExecution: 'not-executed',
        },
      })
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null
        setIsRunning(false)
      }
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card className="space-y-4 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Request config
            </p>
            <h2 className="mt-1 text-base font-semibold text-slate-50">
              {selectedDomain?.heading ?? 'AI playground'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {selectedDomain?.description ??
                'Internal proposal-only testing. Actions are never executed from this screen.'}
            </p>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium text-slate-300">Domain</span>
            <Select
              value={domainId}
              onValueChange={(value) =>
                selectDomain(value as AIPlaygroundDomainId)
              }
            >
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium text-slate-300">Provider</span>
            <Select
              value={providerId}
              onValueChange={(value) =>
                selectProvider(value as AIPlaygroundProviderId)
              }
            >
              {providerOptions.map((provider) => (
                <option
                  key={provider.id}
                  value={provider.id}
                  disabled={provider.status !== 'available'}
                >
                  {provider.label}
                  {provider.status !== 'available' ? ' (unavailable)' : ''}
                </option>
              ))}
            </Select>
            {disabledReason ? (
              <span className="flex items-center gap-1 text-xs text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                {disabledReason}
              </span>
            ) : null}
          </label>

          <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3">
            <p className="text-xs font-medium text-slate-300">Intent Routing</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
                <input
                  type="radio"
                  name="ai-playground-routing-mode"
                  checked={routingMode === 'AUTO_DETECT'}
                  onChange={() => {
                    setRoutingMode('AUTO_DETECT')
                    setResult(null)
                    setShowInspection(false)
                    setConversationTurns([])
                    setFollowUpPrompt('')
                  }}
                />
                Auto-detect intent
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
                <input
                  type="radio"
                  name="ai-playground-routing-mode"
                  checked={routingMode === 'FORCE_INTENT'}
                  onChange={() => {
                    setRoutingMode('FORCE_INTENT')
                    setResult(null)
                    setShowInspection(false)
                    setConversationTurns([])
                    setFollowUpPrompt('')
                  }}
                />
                Force intent for testing
              </label>
            </div>
            {routingMode === 'FORCE_INTENT' ? (
              <p className="mt-2 text-xs leading-5 text-amber-200">
                Developer override: forced intent bypasses natural routing and
                is not representative of customer-facing AI behavior.
              </p>
            ) : (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Skillify will route the prompt to a registered intent or
                governed workspace investigation fallback.
              </p>
            )}
          </div>

          {routingMode === 'FORCE_INTENT' ? (
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium text-slate-300">
                Forced intent
              </span>
              <Select
                value={intent}
                onValueChange={(value) =>
                  selectIntent(value as AIPlaygroundIntent)
                }
              >
                {(selectedDomain?.intents ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}

          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium text-slate-300">Request</span>
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              maxLength={2_000}
              placeholder={`Describe the ${selectedDomain?.label.toLowerCase() ?? 'AI'} scenario to test...`}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            {domainContextGroups.map((group) => (
              <ContextSelect
                key={group.id}
                label={group.label}
                value={selectedContextIds[group.id] ?? ''}
                onChange={(value) => {
                  setSelectedContextIds((current) => ({
                    ...current,
                    [group.id]: value,
                  }))
                  setResult(null)
                  setShowInspection(false)
                  setConversationTurns([])
                  setFollowUpPrompt('')
                }}
                options={group.options}
                highlighted={
                  group.id === 'events' &&
                  clarificationMissingContext.includes('appointment')
                }
              />
            ))}
          </div>

          {selectedEvent ? (
            <SelectedContextSummary context={selectedEvent} />
          ) : null}

          {selectedDomain?.allowActionProposals ? (
            <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3">
              <label className="flex items-start gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-brand-primary"
                  checked={includeActionProposal}
                  onChange={(event) =>
                    setIncludeActionProposal(event.target.checked)
                  }
                />
                <span>
                  Request an action proposal
                  <span className="mt-1 block text-xs text-slate-500">
                    Ask the runtime to prepare a concrete, approval-required
                    proposal when enough validated context is available.
                  </span>
                </span>
              </label>
              {includeActionProposal ? (
                <div className="mt-3">
                  <Select
                    value={proposedActionType}
                    onValueChange={(value) =>
                      setProposedActionType(
                        value as 'auto' | SchedulingAIActionProposalType,
                      )
                    }
                  >
                    {actionProposalOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {(selectedDomain?.examples ?? []).map((example) => (
              <Button
                key={example.label}
                type="button"
                size="xs"
                variant="outline"
                onClick={() => {
                  setRoutingMode('AUTO_DETECT')
                  setIntent(example.intent)
                  setPrompt(example.prompt)
                  setIncludeActionProposal(
                    Boolean(example.includeActionProposal),
                  )
                  setResult(null)
                  setShowInspection(false)
                  setConversationTurns([])
                  setFollowUpPrompt('')
                  if (example.proposedActionType) {
                    setProposedActionType(example.proposedActionType)
                  } else {
                    setProposedActionType('auto')
                  }
                }}
              >
                {example.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-800/70 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResult(null)
                setFollowUpPrompt('')
                setConversationTurns([])
              }}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Clear
            </Button>
            <Button
              type="button"
              onClick={() => runPlayground()}
              disabled={isRunning || selectedProvider?.status !== 'available'}
              loading={isRunning}
              leftIcon={<Play className="h-4 w-4" />}
            >
              Run test
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Runtime inspection
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-50">
                Structured response viewer
              </h2>
            </div>
            <Badge
              variant={result?.ok ? 'green' : result ? 'orange' : 'default'}
            >
              {result?.ok ? 'Completed' : result ? 'Failed' : 'Idle'}
            </Badge>
          </div>

          {!result ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-800 p-8 text-center">
              <Bot className="mx-auto h-8 w-8 text-slate-500" />
              <p className="mt-3 text-sm font-medium text-slate-200">
                Run an AI playground test
              </p>
              <p className="mt-1 text-xs text-slate-500">
                The response will show the readable answer first, with provider
                provenance and developer inspection available after the run.
              </p>
            </div>
          ) : result.ok ? (
            <PlaygroundResponse
              workspaceSlug={workspaceSlug}
              result={result}
              responseRef={responseRef}
              showInspection={showInspection}
              followUpPrompt={followUpPrompt}
              conversationTurns={conversationTurns}
              isRunning={isRunning}
              onToggleInspection={() =>
                setShowInspection((current) => !current)
              }
              onFollowUpSuggestion={setFollowUpPrompt}
              onFollowUpPromptChange={setFollowUpPrompt}
              onSendFollowUp={() =>
                runPlayground({
                  promptText: followUpPrompt,
                  isFollowUp: true,
                })
              }
              onStartNewTest={() => {
                setResult(null)
                setFollowUpPrompt('')
                setConversationTurns([])
              }}
              contextOptions={eventContextOptions}
              onSelectContextOption={selectContextOption}
            />
          ) : (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-semibold">
                {result.error ?? 'Request failed'}
              </p>
              {result.reason ? (
                <p className="mt-1 text-xs">{result.reason}</p>
              ) : null}
              {result.diagnostic ? (
                <dl className="mt-3 grid gap-2 text-xs text-amber-50/80 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-amber-50">Request</dt>
                    <dd className="break-all">{result.diagnostic.requestId}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-amber-50">
                      Failed stage
                    </dt>
                    <dd>{result.diagnostic.failureStage}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-amber-50">
                      Last completed
                    </dt>
                    <dd>{result.diagnostic.lastCompletedStage ?? 'None'}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-amber-50">
                      Next expected
                    </dt>
                    <dd>{result.diagnostic.nextExpectedStage ?? 'Unknown'}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-amber-50">Retry</dt>
                    <dd>
                      {result.diagnostic.retryable
                        ? 'Reasonable'
                        : 'Not recommended'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-amber-50">Code</dt>
                    <dd>{result.diagnostic.safeCode}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-amber-50">
                      Response generated
                    </dt>
                    <dd>
                      {result.diagnostic.responseGenerated ? 'Yes' : 'No'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-amber-50">
                      Provider outcome
                    </dt>
                    <dd>
                      {result.diagnostic.providerOutcome ?? 'Unavailable'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-amber-50">Persistence</dt>
                    <dd>
                      {result.diagnostic.persistenceAttempted
                        ? result.diagnostic.persistenceSucceeded
                          ? 'Succeeded'
                          : 'Attempted'
                        : 'Not attempted'}
                    </dd>
                  </div>
                </dl>
              ) : null}
              {result.diagnostic?.workspaceAIExperience ? (
                <div className="mt-3 rounded-lg border border-amber-300/20 bg-black/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-50">
                    Workspace AI Experience
                  </p>
                  <dl className="mt-2 grid gap-2 text-xs text-amber-50/80 sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-amber-50">
                        Failed builder
                      </dt>
                      <dd>{result.diagnostic.workspaceAIExperience.builder}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-amber-50">
                        Failed function
                      </dt>
                      <dd>
                        {result.diagnostic.workspaceAIExperience.functionName}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-amber-50">Exception</dt>
                      <dd>
                        {result.diagnostic.workspaceAIExperience.exceptionClass}
                        :{' '}
                        {
                          result.diagnostic.workspaceAIExperience
                            .exceptionMessage
                        }
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-amber-50">
                        Missing property
                      </dt>
                      <dd>
                        {result.diagnostic.workspaceAIExperience
                          .missingProperty ?? 'Unknown'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-amber-50">
                        Object keys
                      </dt>
                      <dd className="break-words">
                        {result.diagnostic.workspaceAIExperience.objectKeys.join(
                          ', ',
                        ) || 'None'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-amber-50">
                        Request ID
                      </dt>
                      <dd className="break-all">
                        {result.diagnostic.workspaceAIExperience.requestId}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-semibold text-amber-50">Location</dt>
                      <dd className="break-all">
                        {result.diagnostic.workspaceAIExperience.file}
                        {result.diagnostic.workspaceAIExperience.line
                          ? `:${result.diagnostic.workspaceAIExperience.line}`
                          : ''}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
              {result.diagnostic?.retryable ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() =>
                    runPlayground({
                      requestIdOverride: result.diagnostic?.requestId,
                    })
                  }
                  disabled={isRunning}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry test
                </Button>
              ) : null}
              {result.diagnostic?.requestId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="ml-2 mt-3"
                  onClick={() => copyText(result.diagnostic?.requestId)}
                >
                  Copy request reference
                </Button>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

async function parsePlaygroundJson(response: Response): Promise<unknown> {
  return response.json()
}

function createClientPlaygroundRequestId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `playground-client:${crypto.randomUUID()}`
  }
  return `playground-client:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

function isAbortError(error: unknown) {
  return (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError'
  )
}

function copyText(value: string | undefined) {
  if (!value) return
  if (typeof navigator === 'undefined') return
  void navigator.clipboard?.writeText(value)
}

function ContextSelect({
  label,
  value,
  onChange,
  options,
  highlighted = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: AIPlaygroundContextOption[]
  highlighted?: boolean
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-xs font-medium text-slate-300">{label}</span>
      <Select
        value={value}
        onValueChange={onChange}
        className={
          highlighted ? 'border-cyan-400/70 ring-1 ring-cyan-400/50' : undefined
        }
        aria-invalid={highlighted}
      >
        <option value="">None</option>
        {options.map((option) => (
          <option key={`${option.kind}:${option.id}`} value={option.id}>
            {option.secondaryLabel
              ? `${option.label} (${option.secondaryLabel})`
              : option.label}
          </option>
        ))}
      </Select>
      {highlighted ? (
        <span className="text-xs text-cyan-200">
          Select an appointment before Skillify can prepare an assignment
          proposal.
        </span>
      ) : null}
    </label>
  )
}

function SelectedContextSummary({
  context,
}: {
  context: AIPlaygroundContextOption
}) {
  const metadata = context.metadata ?? {}
  const items = [
    metadata.dateTimeLabel,
    metadata.assignmentLabel,
    metadata.teamLabel,
    metadata.locationLabel,
    metadata.status,
  ].filter(Boolean)
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        Selected context
      </p>
      <p className="mt-1 text-sm font-medium text-slate-100">{context.label}</p>
      {items.length ? (
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {items.join(' · ')}
        </p>
      ) : null}
    </div>
  )
}

function ClarificationOptions({
  result,
  contextOptions,
  onSelectContextOption,
}: {
  result: PlaygroundResult
  contextOptions: AIPlaygroundContextOption[]
  onSelectContextOption: (option: AIPlaygroundContextOption) => void
}) {
  const clarification = (result.response as any)?.clarification
  const missingContext = readStringArray(clarification?.missingContext)
  if (!missingContext.includes('appointment')) return null
  const optionRecords = Array.isArray(clarification?.availableOptions)
    ? clarification.availableOptions
    : []
  const options = optionRecords.length
    ? (optionRecords
        .map((item: unknown) => {
          if (!item || typeof item !== 'object') return null
          const record = item as AIPlaygroundContextOption
          return record.kind === 'event' && record.id && record.label
            ? record
            : null
        })
        .filter(Boolean) as AIPlaygroundContextOption[])
    : contextOptions.slice(0, 5)
  if (!options.length) return null
  return (
    <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3">
      <p className="text-sm font-medium text-cyan-100">Select an appointment</p>
      <p className="mt-1 text-xs leading-5 text-cyan-100/75">
        Selecting an option updates the Event field only. Run Test or Send
        Follow-Up when you are ready.
      </p>
      <div className="mt-3 space-y-2">
        {options.slice(0, 5).map((option) => (
          <button
            key={`${option.kind}:${option.id}`}
            type="button"
            className="w-full rounded-lg border border-cyan-400/20 bg-slate-950/50 px-3 py-2 text-left text-sm text-slate-100 transition-colors hover:bg-cyan-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
            onClick={() => onSelectContextOption(option)}
          >
            <span className="block font-medium">{option.label}</span>
            {option.secondaryLabel ? (
              <span className="mt-0.5 block text-xs text-slate-400">
                {option.secondaryLabel}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}

function PlaygroundResponse({
  workspaceSlug,
  result,
  responseRef,
  showInspection,
  followUpPrompt,
  conversationTurns,
  isRunning,
  onToggleInspection,
  onFollowUpSuggestion,
  onFollowUpPromptChange,
  onSendFollowUp,
  onStartNewTest,
  contextOptions,
  onSelectContextOption,
}: {
  workspaceSlug: string
  result: PlaygroundResult
  responseRef: RefObject<HTMLDivElement>
  showInspection: boolean
  followUpPrompt: string
  conversationTurns: AIPlaygroundConversationTurn[]
  isRunning: boolean
  onToggleInspection: () => void
  onFollowUpSuggestion: (suggestion: string) => void
  onFollowUpPromptChange: (value: string) => void
  onSendFollowUp: () => void
  onStartNewTest: () => void
  contextOptions: AIPlaygroundContextOption[]
  onSelectContextOption: (option: AIPlaygroundContextOption) => void
}) {
  const response = result.response
  const decisions = Array.isArray(response?.decisionProposals)
    ? response.decisionProposals
    : []
  const events = normalizeRuntimeEvents(result.inspection?.runtimeEvents)
  const readable = buildAIPlaygroundReadableResult(result)
  const knowledgeProposalPreview = buildKnowledgeProposalPreview(readable)
  const inspectionId = 'ai-playground-developer-inspection'

  return (
    <div className="mt-5 space-y-4">
      <div
        ref={responseRef}
        tabIndex={-1}
        className="space-y-4 outline-none"
        aria-label="AI response"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Metric
            label="Runtime provider"
            value={readable.provenance.runtimeProvider}
          />
          <Metric
            label="Knowledge provider"
            value={readable.provenance.knowledgeProvider}
          />
          <Metric
            label="Deterministic facts"
            value={readable.provenance.deterministicFacts ? 'Yes' : 'No'}
          />
          <Metric label="Execution" value={readable.provenance.execution} />
          <Metric
            label="Generation"
            value={readable.provenance.generationStatus}
          />
          <Metric label="Confidence" value={readable.provenance.confidence} />
        </div>

        <Section title="AI Response">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
              {readable.provenance.responseSourceLabel}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-50">
              {readable.emptyState?.title ?? readable.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {readable.emptyState?.message ?? readable.summary}
            </p>
            {knowledgeProposalPreview ? (
              <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-100/75">
                  Workspace Knowledge proposal preview
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  {knowledgeProposalPreview.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {knowledgeProposalPreview.summary}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="slate">
                    {knowledgeProposalPreview.proposalType}
                  </Badge>
                  <Badge variant="slate">
                    {knowledgeProposalPreview.category}
                  </Badge>
                  <span className="text-[11px] text-slate-500">
                    Opens governed review. It will not approve knowledge
                    automatically.
                  </span>
                </div>
                <div className="mt-3">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      window.location.href =
                        buildWorkspaceKnowledgeProposalHref({
                          workspaceSlug,
                          title: knowledgeProposalPreview.title,
                          summary: knowledgeProposalPreview.summary,
                          category: knowledgeProposalPreview.category,
                          reasoning: readable.details,
                          evidence: [
                            readable.provenance.knowledgeProvider,
                            readable.provenance.responseSourceLabel,
                            readable.provenance.deterministicFacts
                              ? 'Derived from deterministic workspace knowledge'
                              : 'Derived from AI response review',
                          ],
                          confidence: readable.provenance.confidence,
                        })
                    }}
                  >
                    Propose as Workspace Knowledge
                  </Button>
                </div>
              </div>
            ) : null}
            {readable.displayWarning ? (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {readable.displayWarning}
              </p>
            ) : null}
            <ClarificationOptions
              result={result}
              contextOptions={contextOptions}
              onSelectContextOption={onSelectContextOption}
            />
            {readable.details.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                {readable.details.map((detail) => (
                  <li key={detail} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/70" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Section>

        {readable.recommendations.length ? (
          <ReadableRecommendations recommendations={readable.recommendations} />
        ) : null}

        {readable.warnings.length ? (
          <ReadableWarnings warnings={readable.warnings} />
        ) : null}

        <FollowUpPanel
          prompt={followUpPrompt}
          suggestions={readable.followUpSuggestions}
          conversationTurns={conversationTurns}
          isRunning={isRunning}
          onPromptChange={onFollowUpPromptChange}
          onSuggestion={onFollowUpSuggestion}
          onSend={onSendFollowUp}
          onStartNew={onStartNewTest}
        />

        {readable.proposals.length ? (
          <ReadableProposals proposals={readable.proposals} />
        ) : readable.proposalUnavailable ? (
          <Section title="Action Proposals">
            <p className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-400">
              No proposal available.
            </p>
          </Section>
        ) : null}

        {readable.proposalPlans.length ? (
          <ReadableProposalPlans plans={readable.proposalPlans} />
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-900/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          aria-expanded={showInspection}
          aria-controls={inspectionId}
          onClick={onToggleInspection}
        >
          <span>Developer Inspection</span>
          <span className="text-xs font-medium text-slate-500">
            {showInspection ? 'Hide details' : 'Show runtime details'}
          </span>
        </button>
        {showInspection ? (
          <div
            id={inspectionId}
            className="space-y-4 border-t border-slate-800 p-4"
          >
            <Section title="Provider verification">
              <div className="grid gap-3 md:grid-cols-3">
                <Metric
                  label="Recommendation source"
                  value={readable.provenance.knowledgeProvider}
                />
                <Metric
                  label="AI provider"
                  value={
                    result.inspection?.providerVerification?.invoked === false
                      ? 'Not invoked'
                      : String(
                          result.inspection?.providerVerification
                            ?.invokedProviderId ??
                            result.inspection?.providerVerification
                              ?.selectedRuntimeProviderId ??
                            result.provider?.runtimeProviderId ??
                            'Not invoked',
                        )
                  }
                />
                <Metric
                  label="AI role"
                  value={
                    result.inspection?.providerVerification?.aiRole ??
                    'Structured explanation/response generation'
                  }
                />
                <Metric
                  label="Deterministic facts"
                  value={readable.provenance.deterministicFacts ? 'Yes' : 'No'}
                />
              </div>
            </Section>

            <InspectionJson
              title="Confidence rationale"
              value={buildConfidenceRationale({ result, readable })}
            />
            <InspectionJson
              title="Routing"
              value={result.inspection?.routing}
            />
            <InspectionJson
              title="Follow-up grounding"
              value={result.inspection?.followUpGrounding}
            />
            <InspectionJson
              title="Playground Diagnostics"
              value={
                result.inspection?.playgroundDiagnostics ?? result.diagnostic
              }
            />
            <InspectionJson
              title="Response Normalization"
              value={result.inspection?.responseNormalization}
            />
            <InspectionJson
              title="Recommendation Normalization"
              value={result.inspection?.recommendationNormalization}
            />
            <InspectionJson
              title="Analysis plan"
              value={result.inspection?.analysisPlan}
            />
            <InspectionJson
              title="Investigation Goal"
              value={result.inspection?.investigationGoal}
            />
            <InspectionJson
              title="Investigation Plan"
              value={result.inspection?.investigationPlan}
            />
            <InspectionJson
              title="Evidence"
              value={result.inspection?.evidence}
            />
            <InspectionJson
              title="Evidence Groups"
              value={result.inspection?.evidenceGroups}
            />
            <InspectionJson
              title="Business Rules"
              value={result.inspection?.businessRules}
            />
            <InspectionJson
              title="Contradictions"
              value={result.inspection?.contradictions}
            />
            <InspectionJson
              title="Missing Data"
              value={result.inspection?.missingData}
            />
            <InspectionJson
              title="Reasoning Chain"
              value={result.inspection?.reasoningChain}
            />
            <InspectionJson
              title="Root Cause Ranking"
              value={result.inspection?.rootCauseRanking}
            />
            <InspectionJson
              title="Recommendation Ranking"
              value={result.inspection?.recommendationRanking}
            />
            <InspectionJson
              title="Proposal Candidates"
              value={result.inspection?.proposalCandidates}
            />
            <InspectionJson
              title="Coverage Report"
              value={result.inspection?.coverageReport}
            />
            <InspectionJson
              title="Confidence Report"
              value={result.inspection?.confidenceReport}
            />
            <InspectionJson
              title="Learning Opportunities"
              value={result.inspection?.learningOpportunities}
            />
            <InspectionJson
              title="Reasoning Snapshot"
              value={result.inspection?.reasoningSnapshot}
            />
            <InspectionJson
              title="Operational Insights"
              value={result.inspection?.operationalInsights}
            />
            <InspectionJson
              title="Decision Explanation"
              value={result.inspection?.decisionExplanation}
            />
            <InspectionJson
              title="Business Rules Applied"
              value={result.inspection?.businessRulesApplied}
            />
            <InspectionJson
              title="Rejected Alternatives"
              value={result.inspection?.rejectedAlternatives}
            />
            <InspectionJson
              title="Evidence Ranking"
              value={result.inspection?.evidenceRanking}
            />
            <InspectionJson
              title="Knowledge Effectiveness"
              value={result.inspection?.knowledgeEffectiveness}
            />
            <InspectionJson
              title="Insight Generation"
              value={result.inspection?.insightGeneration}
            />
            <InspectionJson
              title="Recommendation Justification"
              value={result.inspection?.recommendationJustification}
            />
            <InspectionJson
              title="Operational Health"
              value={result.inspection?.operationalHealth}
            />
            <InspectionJson
              title="Future Dashboard Signals"
              value={result.inspection?.futureDashboardSignals}
            />
            <InspectionJson
              title="Operational History"
              value={result.inspection?.operationalHistory}
            />
            <InspectionJson
              title="Operational Trends"
              value={result.inspection?.operationalTrends}
            />
            <InspectionJson
              title="Insight Lifecycle"
              value={result.inspection?.insightLifecycle}
            />
            <InspectionJson
              title="Recurring Risks"
              value={result.inspection?.recurringRisks}
            />
            <InspectionJson
              title="Recommendation Outcomes"
              value={result.inspection?.recommendationOutcomes}
            />
            <InspectionJson
              title="Dashboard Signals"
              value={result.inspection?.dashboardSignals}
            />
            <InspectionJson
              title="Operational Timeline"
              value={result.inspection?.operationalTimeline}
            />
            <InspectionJson
              title="Health Evolution"
              value={result.inspection?.healthEvolution}
            />
            <InspectionJson
              title="Trend Graph Data"
              value={result.inspection?.trendGraphData}
            />
            <InspectionJson
              title="Operational Confidence"
              value={result.inspection?.operationalConfidence}
            />
            <InspectionJson
              title="Operational Intelligence"
              value={result.inspection?.operationalIntelligence}
            />
            <InspectionJson
              title="Knowledge Profile"
              value={result.inspection?.knowledgeProfile}
            />
            <InspectionJson
              title="Knowledge Sources"
              value={result.inspection?.knowledgeSources}
            />
            <InspectionJson
              title="Knowledge Gaps"
              value={result.inspection?.knowledgeGaps}
            />
            <InspectionJson
              title="Learning Queue"
              value={result.inspection?.learningQueue}
            />
            <InspectionJson
              title="Recommendation History"
              value={result.inspection?.recommendationHistory}
            />
            <InspectionJson
              title="Confidence Factors"
              value={result.inspection?.confidenceFactors}
            />
            <InspectionJson
              title="Approved Workspace Knowledge"
              value={result.inspection?.approvedWorkspaceKnowledge}
            />
            <InspectionJson
              title="Rejected Knowledge"
              value={result.inspection?.rejectedKnowledge}
            />
            <InspectionJson
              title="Claim provenance"
              value={result.inspection?.claimProvenance}
            />
            <InspectionJson
              title="Knowledge tools"
              value={result.inspection?.knowledgeTools}
            />

            {decisions.length ? (
              <Section title="Decision records">
                <pre className="max-h-52 overflow-auto rounded-xl bg-slate-950/70 p-3 text-xs text-slate-300">
                  {JSON.stringify(decisions, null, 2)}
                </pre>
              </Section>
            ) : null}

            <Section title="Runtime events">
              {events.length ? (
                <div className="space-y-2">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2"
                    >
                      <span className="text-sm text-slate-200">
                        {event.type}
                      </span>
                      <ClipboardList className="h-4 w-4 text-slate-500" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-400">
                  No runtime events were returned.
                </p>
              )}
            </Section>

            <InspectionJson
              title="Validation"
              value={result.inspection?.validation}
            />
            <InspectionJson title="References" value={response?.references} />
            <InspectionJson
              title="Tool usage"
              value={result.inspection?.toolUsage}
            />
            <InspectionJson
              title="Provider usage"
              value={result.inspection?.providerUsage}
            />

            <Section title="Sanitized JSON">
              <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-950/80 p-3 text-xs leading-5 text-slate-300">
                {JSON.stringify(result, null, 2)}
              </pre>
            </Section>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ReadableRecommendations({
  recommendations,
}: {
  recommendations: AIPlaygroundReadableResult['recommendations']
}) {
  return (
    <Section title="Recommendations">
      <div className="space-y-2">
        {recommendations.map((recommendation) => (
          <div
            key={recommendation.id}
            className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {recommendation.title}
                </p>
                {recommendation.targetLabel ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Target: {recommendation.targetLabel}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {recommendation.confidence ? (
                  <Badge variant="default">{recommendation.confidence}</Badge>
                ) : null}
                {recommendation.approvalRequired ? (
                  <Badge variant="orange">Approval required</Badge>
                ) : null}
              </div>
            </div>
            {recommendation.explanation ? (
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {recommendation.explanation}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              {recommendation.scoreLabel}
            </p>
            {recommendation.reasons.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {recommendation.reasons.map((reason) => (
                  <span
                    key={reason}
                    className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-300"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-[11px] text-slate-600">
              Source: {recommendation.source}
              {' · '}
              {recommendation.deterministic
                ? 'Deterministic'
                : 'Model-generated'}
            </p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function ReadableWarnings({
  warnings,
}: {
  warnings: AIPlaygroundReadableResult['warnings']
}) {
  const groups = [
    {
      title: 'Runtime Errors',
      items: warnings.filter((warning) => warning.severity === 'blocking'),
      className: 'border-red-500/30 bg-red-500/10 text-red-100',
    },
    {
      title: 'Provider Warnings',
      items: warnings.filter(
        (warning) =>
          warning.severity !== 'blocking' &&
          /provider|openai|timeout|rate-limit|fallback/i.test(
            `${warning.id} ${warning.message}`,
          ),
      ),
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    },
    {
      title: 'Data Needed',
      items: warnings.filter(
        (warning) =>
          warning.severity === 'info' &&
          /missing-data|data needed|authoritative|connect an advertising|finance|dependency/i.test(
            `${warning.id} ${warning.message}`,
          ),
      ),
      className: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
    },
    {
      title: 'Coverage Limitations',
      items: warnings.filter(
        (warning) =>
          warning.severity === 'info' &&
          /partial|coverage|limitation|not available/i.test(
            `${warning.id} ${warning.message}`,
          ),
      ),
      className: 'border-slate-600 bg-slate-900/80 text-slate-200',
    },
    {
      title: 'Validation Warnings',
      items: warnings.filter(
        (warning) =>
          warning.severity === 'warning' &&
          /invalid|validation|omitted|reference|citation/i.test(
            `${warning.id} ${warning.message}`,
          ),
      ),
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    },
  ]
  const grouped = new Set(groups.flatMap((group) => group.items))
  const other = warnings.filter((warning) => !grouped.has(warning))
  return (
    <Section title="Response Notices">
      <div className="space-y-2">
        {[
          ...groups,
          {
            title: 'Warnings',
            items: other,
            className: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
          },
        ]
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {group.title}
              </p>
              {group.items.map((warning) => (
                <p
                  key={`${warning.id}:${warning.message}`}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm',
                    group.className,
                  )}
                >
                  {warning.message}
                </p>
              ))}
            </div>
          ))}
      </div>
    </Section>
  )
}

function FollowUpPanel({
  prompt,
  suggestions,
  conversationTurns,
  isRunning,
  onPromptChange,
  onSuggestion,
  onSend,
  onStartNew,
}: {
  prompt: string
  suggestions: string[]
  conversationTurns: AIPlaygroundConversationTurn[]
  isRunning: boolean
  onPromptChange: (value: string) => void
  onSuggestion: (value: string) => void
  onSend: () => void
  onStartNew: () => void
}) {
  return (
    <Section title="Follow-Up">
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        {conversationTurns.length ? (
          <ol
            className="mb-3 space-y-2 border-b border-slate-800 pb-3"
            aria-label="Playground conversation history"
          >
            {conversationTurns.slice(-4).map((turn) => (
              <li key={turn.id} className="text-xs leading-5 text-slate-400">
                <span className="font-medium text-slate-200">
                  {turn.prompt}
                </span>
                {turn.responseSummary ? (
                  <span className="block text-slate-500">
                    {turn.responseSummary}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
        <label className="block space-y-2 text-sm">
          <span className="font-medium text-slate-200">Ask a follow-up</span>
          <Textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            rows={3}
            maxLength={2_000}
            placeholder="Ask a follow-up about this result..."
          />
        </label>
        {suggestions.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                size="xs"
                variant="outline"
                onClick={() => onSuggestion(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onStartNew}
          >
            Start new test
          </Button>
          <Button
            type="button"
            size="xs"
            onClick={onSend}
            disabled={isRunning || !prompt.trim()}
            loading={isRunning}
          >
            Send follow-up
          </Button>
        </div>
      </div>
    </Section>
  )
}

function ReadableProposals({
  proposals,
}: {
  proposals: AIPlaygroundReadableResult['proposals']
}) {
  return (
    <Section title="Action proposals">
      <div className="space-y-2">
        {proposals.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>
    </Section>
  )
}

function ProposalCard({
  proposal,
}: {
  proposal: AIPlaygroundReadableResult['proposals'][number]
}) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = `${proposal.id}:details`
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-cyan-100">{proposal.title}</p>
          {proposal.target ? (
            <p className="mt-1 text-xs text-cyan-200/70">
              Target: {proposal.target}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {proposal.approvalRequired ? (
            <Badge variant="orange">Approval required</Badge>
          ) : null}
          <Badge
            variant={proposal.validationStatus === 'valid' ? 'green' : 'orange'}
          >
            {proposal.validationStatus === 'valid'
              ? 'Valid preview'
              : 'Incomplete'}
          </Badge>
          <Badge variant="default">Not executed</Badge>
        </div>
      </div>
      <p className="mt-2 text-sm leading-6 text-cyan-100/90">
        {proposal.summary ?? proposal.explanation}
      </p>
      {proposal.proposedState ? (
        <p className="mt-2 text-xs text-cyan-200/80">
          Proposed change: {proposal.proposedState}
        </p>
      ) : null}
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="mt-3"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((current) => !current)}
      >
        Review proposal
      </Button>
      {expanded ? (
        <div
          id={detailsId}
          className="mt-3 space-y-3 rounded-lg border border-cyan-400/20 bg-slate-950/50 p-3 text-sm text-cyan-100/90"
        >
          <ProposalDetail label="Current state" value={proposal.currentState} />
          <ProposalDetail
            label="Proposed state"
            value={proposal.proposedState}
          />
          <ProposalDetail label="Why" value={proposal.explanation} />
          {proposal.expectedImpact.length ? (
            <ProposalList
              label="Expected impact"
              values={proposal.expectedImpact}
            />
          ) : null}
          {proposal.reasons.length ? (
            <ProposalList label="Reason codes" values={proposal.reasons} />
          ) : null}
          {proposal.warnings.length ? (
            <ProposalList label="Warnings" values={proposal.warnings} />
          ) : null}
          <ProposalDetail
            label="Validation"
            value={proposal.validationMessage ?? proposal.validationStatus}
          />
          <p className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
            Execution is not enabled in the Internal AI Playground.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function ProposalDetail({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <p>
      <span className="font-medium text-cyan-100">{label}: </span>
      <span>{value}</span>
    </p>
  )
}

function ProposalList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="font-medium text-cyan-100">{label}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  )
}

function ReadableProposalPlans({
  plans,
}: {
  plans: AIPlaygroundReadableResult['proposalPlans']
}) {
  return (
    <Section title="Proposal Plans">
      <div className="space-y-2">
        {plans.map((plan) => (
          <ProposalPlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    </Section>
  )
}

function ProposalPlanCard({
  plan,
}: {
  plan: AIPlaygroundReadableResult['proposalPlans'][number]
}) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = `${plan.id}:details`
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-300">
            Coordinated plan
          </p>
          <p className="mt-1 text-sm font-medium text-slate-100">
            {plan.title}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            {plan.objective}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {plan.approvalRequired ? (
            <Badge variant="orange">Approval required</Badge>
          ) : null}
          <Badge
            variant={plan.validationStatus === 'valid' ? 'green' : 'orange'}
          >
            {plan.validationStatus === 'valid' ? 'Valid plan' : 'Incomplete'}
          </Badge>
          <Badge variant="default">Not executed</Badge>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
        <span>
          {plan.steps.length} step{plan.steps.length === 1 ? '' : 's'}
        </span>
        {plan.affectedRecords.length ? (
          <span>
            {plan.affectedRecords.length} affected record
            {plan.affectedRecords.length === 1 ? '' : 's'}
          </span>
        ) : null}
        {plan.riskLevel ? <span>Risk: {plan.riskLevel}</span> : null}
      </div>
      {plan.expectedImpact.length ? (
        <p className="mt-2 text-xs text-slate-400">
          Expected outcome: {plan.expectedImpact[0]}
        </p>
      ) : null}
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="mt-3"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((current) => !current)}
      >
        Review plan
      </Button>
      {expanded ? (
        <div
          id={detailsId}
          className="mt-3 space-y-3 rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-300"
        >
          <ol className="space-y-3">
            {plan.steps.map((step) => (
              <li
                key={step.id}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
              >
                <p className="font-medium text-slate-100">
                  {step.order}. {step.actionType}
                </p>
                {step.target ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Target: {step.target}
                  </p>
                ) : null}
                <ProposalDetail
                  label="Current state"
                  value={step.currentState}
                />
                <ProposalDetail
                  label="Proposed state"
                  value={step.proposedState}
                />
                <ProposalDetail label="Reason" value={step.reason} />
                {step.dependencies.length ? (
                  <ProposalList
                    label="Dependencies"
                    values={step.dependencies}
                  />
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  Approval: {step.approvalStatus ?? 'pending'}
                  {' · '}
                  Execution: {step.executionStatus}
                </p>
              </li>
            ))}
          </ol>
          {plan.warnings.length ? (
            <ProposalList label="Warnings" values={plan.warnings} />
          ) : null}
          <ProposalDetail
            label="Validation"
            value={plan.validationMessage ?? plan.validationStatus}
          />
          <p className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
            Execution is not enabled in the Internal AI Playground.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function InspectionJson({ title, value }: { title: string; value: unknown }) {
  if (value === undefined) return null
  return (
    <Section title={title}>
      <pre className="max-h-52 overflow-auto rounded-xl bg-slate-950/70 p-3 text-xs text-slate-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    </Section>
  )
}

function buildConfidenceRationale({
  result,
  readable,
}: {
  result: PlaygroundResult
  readable: AIPlaygroundReadableResult
}) {
  const validation = result.inspection?.validation as
    | { valid?: boolean; errors?: unknown[]; warnings?: unknown[] }
    | undefined
  const reasons: string[] = []
  if (readable.provenance.deterministicFacts) {
    reasons.push('Deterministic workspace facts were available.')
  } else {
    reasons.push('Deterministic workspace facts were not confirmed.')
  }
  if (validation?.valid === false) {
    reasons.push('Provider output validation failed or was partially rejected.')
  }
  if (readable.warnings.some((warning) => warning.id === 'invalid-citation')) {
    reasons.push(
      'One or more supporting references failed citation validation.',
    )
  }
  if (
    readable.proposals.some(
      (proposal) => proposal.validationStatus === 'incomplete',
    )
  ) {
    reasons.push('At least one proposal is missing required validated context.')
  }
  if (reasons.length === 1 && validation?.valid !== false) {
    reasons.push('No blocking validation issues were returned.')
  }
  return {
    confidence: readable.provenance.confidence,
    validationStatus:
      validation?.valid === false ? 'invalid' : 'valid-or-not-reported',
    reasons,
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  )
}

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-2', className)}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

function addContext(
  refs: AIPlaygroundContextOption[],
  options: AIPlaygroundContextOption[],
  selectedId: string,
  kindOverride?: AIPlaygroundContextOption['kind'],
) {
  if (!selectedId) return
  const selected = options.find((option) => option.id === selectedId)
  if (!selected) return
  refs.push(kindOverride ? { ...selected, kind: kindOverride } : selected)
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function inferConversationDomain(
  routedIntent: unknown,
  fallback: AIPlaygroundDomainId,
): AIPlaygroundDomainId {
  if (typeof routedIntent === 'string') {
    if (routedIntent.startsWith('crm.')) return 'crm'
    if (routedIntent.startsWith('workspace.')) return 'workspace'
    if (routedIntent.startsWith('scheduling.')) return 'scheduling'
  }
  return fallback
}

function inferConversationIntent(
  responseIntent: unknown,
  routedIntent: unknown,
  fallback: AIPlaygroundIntent,
): AIPlaygroundIntent {
  if (
    typeof responseIntent === 'string' &&
    isPlaygroundIntent(responseIntent)
  ) {
    return responseIntent
  }
  if (typeof routedIntent === 'string') {
    if (routedIntent.startsWith('workspace.')) return 'investigateWorkspace'
    if (routedIntent === 'crm.prioritizeLeads') return 'prioritizeLeads'
    if (routedIntent === 'crm.analyzePipeline') return 'analyzePipeline'
    if (routedIntent === 'crm.analyzeFollowUps') return 'analyzeFollowUps'
    if (routedIntent === 'crm.analyzeOpportunities')
      return 'analyzeOpportunities'
    if (routedIntent === 'crm.analyzeDataQuality') return 'analyzeDataQuality'
    if (routedIntent === 'scheduling.findBestMember')
      return 'recommendTechnician'
    if (routedIntent === 'scheduling.findBestTeam') return 'recommendTeam'
    if (routedIntent === 'scheduling.findAvailableSlot')
      return 'recommendAppointmentTime'
    if (routedIntent === 'scheduling.explainConflict') return 'analyzeConflicts'
    if (routedIntent === 'scheduling.balanceWorkload') return 'analyzeSchedule'
  }
  return fallback
}

function isPlaygroundIntent(value: string): value is AIPlaygroundIntent {
  return [
    'explainSchedulingConflict',
    'explainTechnicianAvailability',
    'recommendTechnician',
    'recommendTeam',
    'recommendAppointmentTime',
    'recommendReassignment',
    'analyzeSchedule',
    'analyzeConflicts',
    'analyzeWorkload',
    'summarizeTodaysSchedule',
    'summarizeUpcomingWork',
    'prioritizeLeads',
    'analyzeFollowUps',
    'analyzeOpportunities',
    'analyzePipeline',
    'analyzeDataQuality',
    'crmOverview',
    'explainLead',
    'explainOpportunityRisk',
    'recommendNextActions',
    'investigateWorkspace',
  ].includes(value)
}

function readReferenceIds(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => {
          if (item && typeof item === 'object' && 'id' in item) {
            const id = (item as { id?: unknown }).id
            return typeof id === 'string' && id.trim() ? id.trim() : null
          }
          return null
        })
        .filter((id): id is string => Boolean(id))
    : []
}

type WorkspaceKnowledgeProposalPreview = {
  proposalType: 'CREATE' | 'REPLACE' | 'ARCHIVE'
  title: string
  summary: string
  category: string
}

function buildKnowledgeProposalPreview(
  readable: AIPlaygroundReadableResult,
): WorkspaceKnowledgeProposalPreview | null {
  const summary = readable.summary.trim()
  if (!summary) return null
  const combined = [readable.title, summary, ...readable.details].join(' ')
  if (isOneTimeOperationalFact(combined)) return null
  if (!hasReusableKnowledgeLanguage(combined)) return null

  const proposalType = inferKnowledgeProposalType(combined)
  const title = refineKnowledgeProposalTitle({
    title: readable.title,
    summary,
    proposalType,
  })
  return {
    proposalType,
    title,
    summary: prefixTemporaryInstructionNotice(
      summary,
      readable.provenance.deterministicFacts,
    ),
    category: inferKnowledgeProposalCategory(combined),
  }
}

function inferKnowledgeProposalType(
  text: string,
): WorkspaceKnowledgeProposalPreview['proposalType'] {
  if (/\b(archive|remove|retire|delete|stop using)\b/i.test(text))
    return 'ARCHIVE'
  if (/\b(replace|supersede|update existing|instead of)\b/i.test(text))
    return 'REPLACE'
  return 'CREATE'
}

function refineKnowledgeProposalTitle({
  title,
  summary,
  proposalType,
}: {
  title: string
  summary: string
  proposalType: WorkspaceKnowledgeProposalPreview['proposalType']
}) {
  const generic =
    /^(workspace investigation|workspace ai response|ai response)$/i.test(
      title.trim(),
    )
  const base = generic ? extractKnowledgeTitleFromText(summary) : title.trim()
  const prefix =
    proposalType === 'ARCHIVE'
      ? 'Archive knowledge'
      : proposalType === 'REPLACE'
        ? 'Replace knowledge'
        : ''
  if (prefix && !base.toLowerCase().startsWith(prefix.toLowerCase())) {
    return `${prefix}: ${base}`.slice(0, 140)
  }
  return base.slice(0, 140)
}

function extractKnowledgeTitleFromText(text: string) {
  const sentence = text
    .split(/[.!?]\s/)
    .find((item) => item.trim().length >= 12)
    ?.trim()
  if (!sentence) return 'Workspace AI proposal'
  return sentence
    .replace(
      /^(skillify should|the workspace should|you should|we should)\s+/i,
      '',
    )
    .slice(0, 140)
}

function inferKnowledgeProposalCategory(text: string) {
  if (
    /\b(schedule|scheduling|technician|dispatch|availability|appointment)\b/i.test(
      text,
    )
  ) {
    return 'Scheduling Preference'
  }
  if (/\b(lead|opportunit|client|customer|sales|crm)\b/i.test(text)) {
    return 'CRM Guideline'
  }
  if (/\b(automation|workflow|execution|trigger)\b/i.test(text)) {
    return 'Automation Guideline'
  }
  return 'AI Response Preference'
}

function isOneTimeOperationalFact(text: string) {
  if (
    /\b(conflicts?|busy events?|appointments?|records?)\b/i.test(text) &&
    /\b(found|analyzed|today|this week|this month|current|upcoming|right now)\b/i.test(
      text,
    )
  ) {
    return true
  }
  return false
}

function hasReusableKnowledgeLanguage(text: string) {
  return /\b(rule|policy|preference|guideline|always|never|prefer|should|standard|procedure|when .* then|replace|supersede|archive|remove|stop using|treat .* as|label .* as)\b/i.test(
    text,
  )
}

function prefixTemporaryInstructionNotice(
  summary: string,
  deterministicFacts: boolean,
) {
  if (deterministicFacts) return summary
  return `Temporary user instruction pending governed approval: ${summary}`
}

function buildWorkspaceKnowledgeProposalHref({
  workspaceSlug,
  title,
  summary,
  category,
  reasoning,
  evidence,
  confidence,
}: {
  workspaceSlug: string
  title: string
  summary: string
  category?: string
  reasoning: string[]
  evidence: string[]
  confidence?: string
}) {
  const params = new URLSearchParams({
    knowledgeStatement: title.slice(0, 1_000),
    knowledgeSummary: summary.slice(0, 1_000),
    knowledgeCategory: category ?? 'AI Response Preference',
    knowledgeScope: 'entireWorkspace',
    knowledgeSource: 'AI Proposal',
  })
  const reasoningText = reasoning.filter(Boolean).slice(0, 6).join('\n')
  const evidenceText = evidence.filter(Boolean).slice(0, 6).join('\n')
  if (reasoningText) {
    params.set('knowledgeReasoning', reasoningText.slice(0, 1_000))
  }
  if (evidenceText) {
    params.set('knowledgeEvidence', evidenceText.slice(0, 1_000))
  }
  if (confidence?.trim()) {
    params.set(
      'knowledgeConfidence',
      confidence.toLowerCase().includes('high')
        ? 'high'
        : confidence.toLowerCase().includes('low')
          ? 'low'
          : 'medium',
    )
  }
  return `/dashboard/${workspaceSlug}/settings/workspace-knowledge?${params.toString()}`
}
