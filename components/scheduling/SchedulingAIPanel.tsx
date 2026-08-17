'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Lightbulb,
  Send,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import type {
  CustomerSchedulingAIResponse,
  SchedulingAIContextPayload,
} from '@/lib/ai/scheduling/customerSchedulingAI'

type SchedulingAIPanelProps = {
  workspaceId: string
  open: boolean
  context: SchedulingAIContextPayload | null
  onClose: () => void
  onOpenEvent?: (eventId: string) => void
}

type SchedulingAIResult = {
  ok?: boolean
  response?: CustomerSchedulingAIResponse
  message?: string
  code?: string
}

export function SchedulingAIPanel({
  workspaceId,
  open,
  context,
  onClose,
  onOpenEvent,
}: SchedulingAIPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<SchedulingAIResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const suggestions = useMemo(
    () => getSchedulingAISuggestions(context),
    [context],
  )

  useEffect(() => {
    if (!open) return
    setPrompt('')
    setResult(null)
    window.setTimeout(() => panelRef.current?.focus(), 0)
  }, [open, context?.entryPoint, context?.label])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open || !context) return null

  async function submit(nextPrompt = prompt) {
    const trimmed = nextPrompt.trim()
    if (!trimmed || isRunning || !context) return
    setIsRunning(true)
    setResult(null)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/scheduling/ai`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: trimmed,
            context,
            includeActionProposal:
              /reassign|move|assign|notify|follow[- ]?up|task/i.test(trimmed),
            proposedActionType: /reassign|assign/i.test(trimmed)
              ? 'assignTechnician'
              : /move|time/i.test(trimmed)
                ? 'moveAppointment'
                : /notify/i.test(trimmed)
                  ? 'notifyCustomer'
                  : /task|follow[- ]?up/i.test(trimmed)
                    ? 'createTask'
                    : undefined,
          }),
        },
      )
      const body = (await response.json()) as SchedulingAIResult
      setResult(response.ok ? body : { ...body, ok: false })
    } catch {
      setResult({
        ok: false,
        message: 'Scheduling AI could not be reached. Try again.',
      })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90]" aria-hidden={false}>
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scheduling-ai-title"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-800 bg-slate-950 shadow-2xl sm:w-[34rem]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="border-b border-slate-800 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
                <Bot className="h-4 w-4" />
                Scheduling AI
              </p>
              <h2
                id="scheduling-ai-title"
                className="mt-1 text-lg font-semibold text-neutral-50"
              >
                Ask Scheduling AI
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {context.label}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-text-secondary rounded-xl p-2 hover:bg-white/[0.06] hover:text-white"
              aria-label="Close Scheduling AI"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {context.references.map((reference) => (
              <Badge key={`${reference.kind}:${reference.id}`} variant="blue">
                {reference.label}
              </Badge>
            ))}
            {context.calendar?.view ? (
              <Badge variant="slate">{context.calendar.view} view</Badge>
            ) : null}
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="text-sm font-semibold text-neutral-100">
              Suggested questions
            </h3>
            <div className="mt-2 grid gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setPrompt(suggestion)
                    void submit(suggestion)
                  }}
                  disabled={isRunning}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-left text-sm text-neutral-200 transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </section>

          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-neutral-100">
                Ask a scheduling question
              </span>
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                maxLength={2_000}
                rows={4}
                placeholder="Ask about conflicts, availability, workload, or recommendations..."
              />
            </label>
            <Button
              type="submit"
              size="sm"
              loading={isRunning}
              disabled={!prompt.trim()}
              leftIcon={<Send className="h-4 w-4" />}
            >
              Ask Scheduling AI
            </Button>
          </form>

          {isRunning ? (
            <div
              role="status"
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-4 text-sm text-cyan-100"
            >
              Checking Scheduling data and generating a validated response...
            </div>
          ) : null}

          {result?.ok && result.response ? (
            <SchedulingAIResponseCards
              response={result.response}
              onOpenEvent={onOpenEvent}
            />
          ) : result && !result.ok ? (
            <div
              role="alert"
              className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4 text-sm text-amber-100"
            >
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Scheduling AI unavailable
              </p>
              <p className="mt-1 text-xs text-amber-100/80">
                {result.message ??
                  'Scheduling AI could not complete this request.'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-400">
              No AI response yet. Choose a suggestion or ask a scheduling
              question.
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

function SchedulingAIResponseCards({
  response,
  onOpenEvent,
}: {
  response: CustomerSchedulingAIResponse
  onOpenEvent?: (eventId: string) => void
}) {
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<
    string | null
  >(response.recommendations[0]?.id ?? null)
  const selectedRecommendation =
    response.recommendations.find(
      (recommendation) => recommendation.id === selectedRecommendationId,
    ) ?? response.recommendations[0]

  return (
    <div className="space-y-4">
      {response.summary ? (
        <AISection title={response.summary.title}>
          <p className="text-sm leading-6 text-neutral-200">
            {response.summary.summary}
          </p>
          {response.summary.items.length ? (
            <ul className="mt-3 space-y-2">
              {response.summary.items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl bg-slate-900/45 px-3 py-2 text-sm text-neutral-300"
                >
                  {item.label}
                </li>
              ))}
            </ul>
          ) : null}
        </AISection>
      ) : null}

      {response.explanations.map((explanation) => (
        <AISection key={explanation.id} title={explanation.title}>
          <p className="text-sm leading-6 text-neutral-200">
            {explanation.summary}
          </p>
          <ReasonList
            reasons={explanation.reasons}
            warnings={explanation.warnings}
          />
        </AISection>
      ))}

      {response.recommendations.length ? (
        <AISection title="Recommendations">
          <div className="space-y-2">
            {response.recommendations.map((recommendation) => (
              <button
                key={recommendation.id}
                type="button"
                onClick={() => setSelectedRecommendationId(recommendation.id)}
                aria-pressed={selectedRecommendationId === recommendation.id}
                className={`w-full rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 ${
                  selectedRecommendationId === recommendation.id
                    ? 'border-cyan-300/45 bg-cyan-300/[0.07]'
                    : 'border-slate-800 bg-slate-950/40 hover:border-cyan-300/25'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-neutral-100">
                    {recommendation.label}
                  </p>
                  <Badge variant="default">{recommendation.confidence}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {recommendation.scoreLabel}
                </p>
                <p className="mt-1 text-xs text-cyan-100/70">
                  {recommendation.provenanceLabel}
                </p>
                <ReasonList
                  reasons={recommendation.reasons}
                  warnings={recommendation.warnings}
                />
              </button>
            ))}
          </div>
          {selectedRecommendation ? (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100/75">
                  Selected candidate
                </p>
                <Badge variant="blue">
                  {selectedRecommendation.scoreLabel}
                </Badge>
              </div>
              <p className="mt-2 text-sm font-medium text-neutral-100">
                {selectedRecommendation.label}
              </p>
              <ReasonList
                reasons={selectedRecommendation.reasons}
                warnings={selectedRecommendation.warnings}
              />
              {response.recommendations.length > 1 ? (
                <p className="mt-3 text-xs text-slate-400">
                  Compare candidates by selecting another card. Scores are
                  deterministic and based on available evidence.
                </p>
              ) : null}
            </div>
          ) : null}
        </AISection>
      ) : response.responseKind === 'recommendation' ? (
        <AISection title="Recommendations">
          <p className="text-sm text-slate-400">
            No eligible members were found for this recommendation.
          </p>
        </AISection>
      ) : null}

      {response.analysis ? (
        <AISection title={response.analysis.title}>
          <p className="text-sm leading-6 text-neutral-200">
            {response.analysis.summary}
          </p>
          {response.analysis.conflictDetails?.length ? (
            <div className="mt-3 space-y-3">
              {response.analysis.conflictDetails.map((conflict) => (
                <div
                  key={conflict.id}
                  className="rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-amber-50">
                        {conflict.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-amber-100/80">
                        {[
                          conflict.affectedAssigneeLabel ??
                            conflict.affectedTeamLabel,
                          conflict.timeRangeLabel,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <Badge
                      variant={
                        conflict.severity === 'blocking' ? 'orange' : 'slate'
                      }
                    >
                      {conflict.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-neutral-300">
                    {conflict.overlapLabel ?? conflict.sourceLabel}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {conflict.whyItMatters}
                  </p>
                  <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/45 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100/75">
                      Recommended next action
                    </p>
                    <p className="mt-1 text-sm text-cyan-50">
                      {conflict.recommendedActionLabel}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-cyan-100/70">
                      {conflict.recommendationReason}
                    </p>
                  </div>
                  {conflict.sourceEventId && onOpenEvent ? (
                    <div className="mt-3">
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        onClick={() =>
                          onOpenEvent(conflict.sourceEventId as string)
                        }
                      >
                        Open event
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : response.analysis.conflicts.length ? (
            <p className="mt-2 text-xs text-amber-200">
              {response.analysis.conflicts.length} conflict
              {response.analysis.conflicts.length === 1 ? '' : 's'} found.
            </p>
          ) : null}
          {response.analysis.workload.length ? (
            <div className="mt-3 space-y-2">
              {response.analysis.workload.slice(0, 4).map((item) => (
                <div
                  key={item.assigneeId}
                  className="rounded-xl bg-slate-900/45 px-3 py-2 text-xs text-neutral-300"
                >
                  {item.label} · {item.eventCount} assignment
                  {item.eventCount === 1 ? '' : 's'}
                </div>
              ))}
            </div>
          ) : null}
        </AISection>
      ) : null}

      {response.actionProposals.length || response.decisionProposals.length ? (
        <AISection title="Proposals">
          <div className="space-y-2">
            {response.actionProposals.map((proposal) => (
              <div
                key={proposal.id}
                className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] p-3"
              >
                <p className="text-sm font-medium text-cyan-100">
                  {proposal.label}
                </p>
                <p className="mt-1 flex items-center gap-2 text-xs text-cyan-100/75">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Proposed · approval required · not executed
                </p>
                {proposal.proposedState ? (
                  <p className="mt-2 whitespace-pre-line text-xs leading-5 text-cyan-50/80">
                    {proposal.proposedState}
                  </p>
                ) : null}
                {proposal.validation?.status === 'incomplete' ? (
                  <p className="mt-2 text-xs text-amber-200">
                    {proposal.validation.message ??
                      'Complete the missing fields before approval.'}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="xs" variant="secondary">
                    Review draft
                  </Button>
                  <Button type="button" size="xs" variant="ghost">
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </AISection>
      ) : null}

      {response.warnings.length ? (
        <AISection title="Warnings">
          <div className="space-y-2">
            {response.warnings.map((warning) => (
              <p
                key={`${warning.code}:${warning.message}`}
                className="rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2 text-sm text-amber-100"
              >
                {warning.message}
              </p>
            ))}
          </div>
        </AISection>
      ) : null}

      {response.followUpSuggestions.length ? (
        <AISection title="Follow-up ideas">
          <div className="flex flex-wrap gap-2">
            {response.followUpSuggestions.map((suggestion) => (
              <Badge key={suggestion} variant="slate">
                {suggestion}
              </Badge>
            ))}
          </div>
        </AISection>
      ) : null}
    </div>
  )
}

function AISection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
        <Lightbulb className="h-4 w-4 text-cyan-200" />
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function ReasonList({
  reasons,
  warnings,
}: {
  reasons: Array<{ code: string; label: string }>
  warnings: Array<{ code: string; label: string; severity?: string }>
}) {
  if (!reasons.length && !warnings.length) return null
  return (
    <div className="mt-3 space-y-1">
      {reasons.map((reason) => (
        <p
          key={`reason:${reason.code}:${reason.label}`}
          className="text-xs text-slate-400"
        >
          {reason.label}
        </p>
      ))}
      {warnings.map((warning) => (
        <p
          key={`warning:${warning.code}:${warning.label}`}
          className="text-xs text-amber-200"
        >
          {warning.label}
        </p>
      ))}
    </div>
  )
}

function getSchedulingAISuggestions(
  context: SchedulingAIContextPayload | null,
) {
  if (!context) return []
  if (context.entryPoint === 'event') {
    return [
      'Who is the best available member?',
      'Explain this conflict',
      'Suggest another time',
      'Recommend a reassignment',
    ]
  }
  if (
    context.entryPoint === 'teamAvailability' ||
    context.entryPoint === 'busySchedule'
  ) {
    return [
      'Summarize team availability',
      'What is blocking this time slot?',
      'Who is available during this time?',
      'Show current conflicts',
    ]
  }
  return [
    "Summarize today's schedule",
    'Show current conflicts',
    'Identify overloaded members',
    'Find unassigned appointments',
  ]
}
