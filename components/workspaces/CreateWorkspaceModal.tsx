'use client'

import {
  default as React,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Check, HelpCircle, PartyPopper, Plus, Sparkles, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BusinessModelPreview } from '@/components/workspaces/BusinessModelPreview'
import {
  listWorkspaceBusinessModels,
  type WorkspaceBusinessModelDefinition,
} from '@/lib/workspaces/businessModelRegistry'
import {
  recommendBusinessModel,
  type BusinessModelQuestionnaireAnswers,
  type BusinessModelRecommendation,
} from '@/lib/workspaces/recommendBusinessModel'
import { getIndustryLayoutHint } from '@/lib/workspaces/getIndustryLayoutHint'
import { cn } from '@/lib/utils'

type CreatedWorkspace = {
  id: string
  name: string
  slug: string
}

type Props = {
  triggerClassName?: string
  triggerLabel?: string
  onCreated?: (workspace: CreatedWorkspace) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  restoreFocusRef?: RefObject<HTMLElement>
}

const MODELS = listWorkspaceBusinessModels()

type StepTwoView = 'cards' | 'questionnaire'
type QuestionnaireAnswers = Partial<BusinessModelQuestionnaireAnswers>
type QuestionnaireField = keyof BusinessModelQuestionnaireAnswers

const QUESTIONNAIRE: Array<{
  key: QuestionnaireField
  question: string
  options: Array<{
    label: string
    value: BusinessModelQuestionnaireAnswers[QuestionnaireField]
  }>
}> = [
  {
    key: 'prePurchaseContact',
    question: 'Do customers usually contact your business before purchasing?',
    options: [
      { label: 'Usually', value: 'USUALLY' },
      { label: 'Sometimes', value: 'SOMETIMES' },
      { label: 'Rarely or never', value: 'RARELY' },
    ],
  },
  {
    key: 'consultativeProcess',
    question:
      'Does your sales process commonly include consultations, discovery calls, site visits, needs analysis, or scoping?',
    options: [
      { label: 'Often', value: 'OFTEN' },
      { label: 'Sometimes', value: 'SOMETIMES' },
      { label: 'Rarely or never', value: 'RARELY' },
    ],
  },
  {
    key: 'customProposalOrNegotiation',
    question:
      'Do you create custom proposals, estimates, scopes, or negotiate pricing and terms?',
    options: [
      { label: 'Often', value: 'OFTEN' },
      { label: 'Sometimes', value: 'SOMETIMES' },
      { label: 'Rarely or never', value: 'RARELY' },
    ],
  },
  {
    key: 'directPurchaseFlow',
    question:
      'Can most customers move directly from an inquiry into a quote, booking, or purchase without a separate opportunity stage?',
    options: [
      { label: 'Yes, usually', value: 'USUALLY' },
      { label: 'Sometimes', value: 'SOMETIMES' },
      { label: 'No, usually not', value: 'RARELY' },
    ],
  },
  {
    key: 'commerceOperations',
    question:
      'Does the business primarily manage products, orders, fulfillment, wholesale purchases, repeat purchasing, or subscriptions?',
    options: [
      { label: 'Yes, primarily', value: 'PRIMARY' },
      { label: 'Partly', value: 'PARTIAL' },
      { label: 'No', value: 'NO' },
    ],
  },
]

const MODEL_CARD_COPY: Record<
  string,
  {
    description: string
    bestFor: string[]
  }
> = {
  SIMPLE_SERVICE_BUSINESS: {
    description:
      'For businesses that usually turn inquiries directly into customers.',
    bestFor: ['Home services', 'Field services', 'Lawn & landscaping'],
  },
  CONSULTATIVE_SALES: {
    description:
      'For businesses with longer sales cycles involving discovery, proposals, scoping, or negotiation.',
    bestFor: ['Agencies', 'Consulting', 'Commercial services'],
  },
  DIRECT_SALES: {
    description:
      'For businesses that use a dedicated sales or quoting process before someone becomes a client.',
    bestFor: ['Quote-driven sales', 'Sales teams', 'Higher-ticket services'],
  },
  PRODUCT_COMMERCE: {
    description:
      'For businesses that manage customers, products, orders, and fulfillment.',
    bestFor: ['E-commerce', 'Product brands', 'Wholesale'],
  },
}

function ModelChoice({
  model,
  selected,
  recommended,
  onSelect,
  onMove,
}: {
  model: WorkspaceBusinessModelDefinition
  selected: boolean
  recommended: boolean
  onSelect: () => void
  onMove: (fromModelId: string, direction: -1 | 1) => void
}) {
  const cardCopy = MODEL_CARD_COPY[model.id] ?? {
    description: model.description,
    bestFor: model.recommendedFor.slice(0, 3),
  }
  const workflow = model.defaultWorkflow.replaceAll('->', '→')

  return (
    <button
      type="button"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault()
          onMove(model.id, 1)
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault()
          onMove(model.id, -1)
        }
      }}
      role="radio"
      aria-checked={selected}
      className={cn(
        'group flex h-full w-full cursor-pointer flex-col gap-4 rounded-2xl border p-3 text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:p-4',
        selected
          ? 'border-cyan-300/70 bg-cyan-300/[0.09] shadow-lg shadow-cyan-500/10'
          : 'border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-300/[0.05] hover:shadow-lg hover:shadow-black/20',
      )}
    >
      <BusinessModelPreview model={model.id} selected={selected} />

      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">{model.name}</p>
            <p className="text-white/62 mt-1 text-xs leading-5">
              {cardCopy.description}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {recommended ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[11px] font-medium text-emerald-100">
                <Sparkles className="h-3.5 w-3.5" />
                Recommended for you
              </span>
            ) : null}
            {selected ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/35 bg-cyan-300/15 px-2 py-1 text-[11px] font-medium text-cyan-100">
                <Check className="h-3.5 w-3.5" />
                Selected
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Flow
          </p>
          <p className="mt-1 text-xs font-medium text-white/80">{workflow}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Best for
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cardCopy.bestFor.map((example) => (
              <span
                key={example}
                className="text-white/62 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px]"
              >
                {example}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  )
}

function isCompleteAnswers(
  answers: QuestionnaireAnswers,
): answers is BusinessModelQuestionnaireAnswers {
  return QUESTIONNAIRE.every((question) => Boolean(answers[question.key]))
}

export default function CreateWorkspaceModal({
  triggerClassName,
  triggerLabel = 'Create Workspace',
  onCreated,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  restoreFocusRef,
}: Props) {
  const router = useRouter()
  const firstInputRef = useRef<HTMLInputElement | null>(null)
  const modalRef = useRef<HTMLFormElement | null>(null)
  const internalTriggerRef = useRef<HTMLButtonElement | null>(null)
  const cardsRegionRef = useRef<HTMLDivElement | null>(null)
  const [internalOpen, setInternalOpen] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [workspaceName, setWorkspaceName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [industry, setIndustry] = useState('')
  const [businessModel, setBusinessModel] = useState<string>('')
  const [stepTwoView, setStepTwoView] = useState<StepTwoView>('cards')
  const [questionnaireAnswers, setQuestionnaireAnswers] =
    useState<QuestionnaireAnswers>({})
  const [recommendation, setRecommendation] =
    useState<BusinessModelRecommendation | null>(null)
  const [recommendationDismissed, setRecommendationDismissed] = useState(false)
  const [createdWorkspace, setCreatedWorkspace] =
    useState<CreatedWorkspace | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const open = controlledOpen ?? internalOpen
  const setOpenState = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) {
        setInternalOpen(nextOpen)
      }
      onOpenChange?.(nextOpen)
    },
    [controlledOpen, onOpenChange],
  )

  const normalizedWorkspaceName = workspaceName.trim()
  const canContinueStepOne = normalizedWorkspaceName.length > 0 && !isSubmitting
  const canCreateStepTwo = Boolean(businessModel) && !isSubmitting
  const selectedModel = useMemo(
    () => MODELS.find((model) => model.id === businessModel) ?? null,
    [businessModel],
  )
  const visibleRecommendation = recommendationDismissed ? null : recommendation
  const industryHint = useMemo(
    () => getIndustryLayoutHint(industry),
    [industry],
  )
  const visibleIndustryRecommendation =
    !visibleRecommendation && industryHint?.confidence === 'HIGH'
      ? industryHint
      : null
  const recommendedModelId =
    visibleRecommendation?.model ?? visibleIndustryRecommendation?.model ?? null
  const activeRecommendedModel = useMemo(
    () => MODELS.find((model) => model.id === recommendedModelId) ?? null,
    [recommendedModelId],
  )
  const otherModels = useMemo(
    () =>
      activeRecommendedModel
        ? MODELS.filter((model) => model.id !== activeRecommendedModel.id)
        : MODELS,
    [activeRecommendedModel],
  )
  const answersComplete = isCompleteAnswers(questionnaireAnswers)
  const moveBusinessModelSelection = useCallback(
    (modelId: string, direction: -1 | 1) => {
      const currentIndex = MODELS.findIndex((model) => model.id === modelId)
      const safeIndex = currentIndex === -1 ? 0 : currentIndex
      const nextModel =
        MODELS[(safeIndex + direction + MODELS.length) % MODELS.length]
      setBusinessModel(nextModel.id)
    },
    [],
  )

  useEffect(() => {
    setPortalReady(true)
  }, [])

  const reset = useCallback(() => {
    setStep(1)
    setWorkspaceName('')
    setBusinessName('')
    setIndustry('')
    setBusinessModel('')
    setStepTwoView('cards')
    setQuestionnaireAnswers({})
    setRecommendation(null)
    setRecommendationDismissed(false)
    setCreatedWorkspace(null)
    setIsSubmitting(false)
    setError('')
  }, [])

  const close = useCallback(() => {
    if (isSubmitting) return
    setOpenState(false)
    reset()
    window.requestAnimationFrame(() => {
      const focusTarget = restoreFocusRef?.current ?? internalTriggerRef.current
      focusTarget?.focus()
    })
  }, [isSubmitting, reset, restoreFocusRef, setOpenState])

  const openModal = useCallback(() => {
    setOpenState(true)
  }, [setOpenState])

  const continueToModelStep = useCallback(() => {
    if (!canContinueStepOne) {
      setError('Enter a workspace name to continue.')
      return
    }
    setError('')
    setStep(2)
  }, [canContinueStepOne])

  const updateQuestionnaireAnswer = useCallback(
    <TKey extends QuestionnaireField>(
      key: TKey,
      value: BusinessModelQuestionnaireAnswers[TKey],
    ) => {
      setQuestionnaireAnswers((current) => ({
        ...current,
        [key]: value,
      }))
    },
    [],
  )

  const showRecommendation = useCallback(() => {
    if (!isCompleteAnswers(questionnaireAnswers)) return
    const nextRecommendation = recommendBusinessModel({
      answers: questionnaireAnswers,
      businessName: businessName.trim(),
      industry: industry.trim(),
    })
    setRecommendation(nextRecommendation)
    setRecommendationDismissed(false)
    setBusinessModel(nextRecommendation.model)
    setStepTwoView('cards')
    window.requestAnimationFrame(() => {
      cardsRegionRef.current?.focus()
    })
  }, [businessName, industry, questionnaireAnswers])

  const goBack = useCallback(() => {
    if (step === 1) {
      close()
      return
    }
    if (stepTwoView !== 'cards') {
      setStepTwoView('cards')
      return
    }
    setStep(1)
  }, [close, step, stepTwoView])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      if (modalRef.current?.contains(document.activeElement)) return
      firstInputRef.current?.focus()
    }, 0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [close, open])

  async function submit() {
    if (step === 1) {
      continueToModelStep()
      return
    }

    if (isSubmitting || !canCreateStepTwo) return
    setIsSubmitting(true)
    setError('')
    const response = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: normalizedWorkspaceName,
        businessName: businessName.trim(),
        industry: industry.trim(),
        businessModel,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(data.error || 'Could not create workspace.')
      setIsSubmitting(false)
      return
    }

    const workspace = data.workspace as CreatedWorkspace
    onCreated?.(workspace)
    setCreatedWorkspace(workspace)
    setIsSubmitting(false)
  }

  function finishWorkspaceCreation(destination: 'dashboard' | 'setup') {
    if (!createdWorkspace) return
    const workspace = createdWorkspace
    setOpenState(false)
    reset()
    router.push(
      destination === 'setup'
        ? `/dashboard/${workspace.slug}?setup=1`
        : `/dashboard/${workspace.slug}`,
    )
    router.refresh()
  }

  return (
    <>
      {!hideTrigger ? (
        <button
          ref={internalTriggerRef}
          type="button"
          onClick={openModal}
          className={
            triggerClassName ??
            'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10'
          }
        >
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </button>
      ) : null}

      {portalReady && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-workspace-title"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) close()
              }}
            >
              <form
                ref={modalRef}
                className={cn(
                  'flex max-h-[calc(100vh-32px)] w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#070A12] text-white shadow-2xl shadow-black/60 transition-[max-width] duration-200 sm:max-h-[calc(100vh-48px)]',
                  step === 2
                    ? 'max-w-[min(1100px,calc(100vw-40px))]'
                    : 'max-w-[min(880px,calc(100vw-32px))]',
                )}
                onKeyDown={(event) => {
                  if (step !== 1 || event.key !== 'Enter') return
                  event.preventDefault()
                  continueToModelStep()
                }}
                onSubmit={(event) => {
                  event.preventDefault()
                  submit()
                }}
              >
                {createdWorkspace ? (
                  <>
                    <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
                          Workspace created
                        </p>
                        <h2
                          id="create-workspace-title"
                          className="text-2xl font-semibold"
                        >
                          Workspace Ready!
                        </h2>
                        <p className="mt-1 text-sm text-white/60">
                          Your workspace has been created successfully.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => finishWorkspaceCreation('dashboard')}
                        className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/65 transition hover:bg-white/10 hover:text-white"
                        aria-label="Open workspace dashboard"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="px-5 py-6 sm:px-7">
                      <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.07] p-5">
                        <div className="flex items-start gap-3">
                          <span className="rounded-xl border border-cyan-200/30 bg-cyan-200/10 p-2 text-cyan-100">
                            <PartyPopper className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-base font-semibold text-white">
                              Complete setup to personalize Skillify for your
                              business, team, scheduling, AI, and operations.
                            </p>
                            <p className="text-white/68 mt-2 max-w-2xl text-sm leading-6">
                              Setup takes you through business information,
                              team, scheduling, AI, lead intake, and
                              notifications.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 px-5 py-4 sm:px-7">
                      <Button
                        type="button"
                        onClick={() => finishWorkspaceCreation('setup')}
                      >
                        Start Workspace Setup
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/20 bg-white/[0.04] text-white/80 hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
                        onClick={() => finishWorkspaceCreation('dashboard')}
                      >
                        Go to Dashboard
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
                          Step {step} of 2 ·{' '}
                          {step === 1 ? 'Business details' : 'Business model'}
                        </p>
                        <h2
                          id="create-workspace-title"
                          className="text-2xl font-semibold"
                        >
                          {step === 1
                            ? 'Create a new workspace'
                            : 'Choose how your business works'}
                        </h2>
                        <p className="mt-1 text-sm text-white/60">
                          {step === 1
                            ? 'Each workspace represents a separate business, client, brand, or organization.'
                            : "We'll organize Skillify around how you turn inquiries into customers and manage the work afterward. You can change this later."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={close}
                        className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/65 transition hover:bg-white/10 hover:text-white"
                        aria-label="Close setup modal"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
                      {step === 1 ? (
                        <div className="grid gap-5">
                          <label className="space-y-1 text-sm">
                            <span className="font-medium text-white/85">
                              Workspace Name *
                            </span>
                            <Input
                              ref={firstInputRef}
                              name="workspaceName"
                              value={workspaceName}
                              onChange={(event) => {
                                setWorkspaceName(event.target.value)
                                if (error) setError('')
                              }}
                              onInput={(event) => {
                                const nextValue = event.currentTarget.value
                                setWorkspaceName((currentValue) =>
                                  currentValue === nextValue
                                    ? currentValue
                                    : nextValue,
                                )
                              }}
                              placeholder="Commonwealth Gas"
                              aria-describedby="workspace-name-help"
                              required
                              error={
                                error && !canContinueStepOne ? error : undefined
                              }
                            />
                            <span
                              id="workspace-name-help"
                              className="block text-xs text-white/45"
                            >
                              This is the name shown in your workspace switcher.
                            </span>
                          </label>
                          <label className="space-y-1 text-sm">
                            <span className="font-medium text-white/85">
                              Business Name
                            </span>
                            <Input
                              value={businessName}
                              onChange={(event) =>
                                setBusinessName(event.target.value)
                              }
                              placeholder="Optional if same"
                            />
                            <span className="block text-xs text-white/45">
                              Use the legal or public-facing business name if it
                              differs.
                            </span>
                          </label>
                          <label className="space-y-1 text-sm">
                            <span className="font-medium text-white/85">
                              Industry
                            </span>
                            <Input
                              value={industry}
                              onChange={(event) =>
                                setIndustry(event.target.value)
                              }
                              placeholder="Home services, agency, retail..."
                            />
                            <span className="block text-xs text-white/45">
                              Used to personalize recommendations and setup.
                            </span>
                          </label>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {stepTwoView === 'cards' ? (
                            <>
                              <div
                                ref={cardsRegionRef}
                                tabIndex={-1}
                                className="space-y-3 outline-none transition-opacity duration-200"
                              >
                                {visibleRecommendation &&
                                activeRecommendedModel ? (
                                  <div
                                    className="rounded-2xl border border-cyan-300/30 bg-cyan-300/[0.07] px-4 py-3"
                                    role="status"
                                    aria-live="polite"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="max-w-3xl">
                                        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
                                          <Sparkles className="h-3.5 w-3.5" />
                                          Recommended for your business
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-white">
                                          {activeRecommendedModel.name}
                                        </p>
                                        <p className="mt-1 text-xs text-white/55">
                                          Based on your answers:
                                        </p>
                                        <ul className="text-white/68 mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
                                          {visibleRecommendation.reasons
                                            .slice(0, 3)
                                            .map((reason) => (
                                              <li
                                                key={reason}
                                                className="flex gap-2"
                                              >
                                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                                                <span>{reason}</span>
                                              </li>
                                            ))}
                                        </ul>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() =>
                                            setStepTwoView('questionnaire')
                                          }
                                        >
                                          Change answers
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() =>
                                            setRecommendationDismissed(true)
                                          }
                                        >
                                          Dismiss recommendation
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ) : visibleIndustryRecommendation &&
                                  activeRecommendedModel ? (
                                  <div
                                    className="rounded-2xl border border-cyan-300/30 bg-cyan-300/[0.07] px-4 py-3"
                                    role="status"
                                    aria-live="polite"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
                                          <Sparkles className="h-3.5 w-3.5" />
                                          {visibleIndustryRecommendation.reason}
                                        </p>
                                        <p className="mt-1 text-lg font-semibold text-white">
                                          {activeRecommendedModel.name}
                                        </p>
                                        <p className="mt-1 text-sm text-white/60">
                                          You can choose this starting point or
                                          pick a different model below.
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setStepTwoView('questionnaire')
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-300/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                                      >
                                        <HelpCircle className="h-4 w-4" />
                                        Help me choose
                                      </button>
                                    </div>
                                  </div>
                                ) : industryHint ? (
                                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
                                    <div>
                                      <p className="text-sm font-medium text-white/85">
                                        {industryHint.reason}
                                      </p>
                                      <p className="text-xs text-white/50">
                                        Business processes vary. Use Help me
                                        choose for a recommendation based on how
                                        your business actually operates.
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setStepTwoView('questionnaire')
                                      }
                                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-300/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                                    >
                                      <HelpCircle className="h-4 w-4" />
                                      Help me choose
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
                                    <div>
                                      <p className="text-sm font-medium text-white/85">
                                        Not sure which layout fits?
                                      </p>
                                      <p className="text-xs text-white/50">
                                        Answer a few local questions and
                                        Skillify will recommend a starting
                                        layout.
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setStepTwoView('questionnaire')
                                      }
                                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-300/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                                    >
                                      <HelpCircle className="h-4 w-4" />
                                      Help me choose
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div
                                role="radiogroup"
                                aria-label="Business model"
                                className="space-y-4"
                              >
                                {activeRecommendedModel ? (
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/65">
                                      Recommended
                                    </p>
                                    <div className="max-w-3xl">
                                      <ModelChoice
                                        model={activeRecommendedModel}
                                        selected={
                                          selectedModel?.id ===
                                          activeRecommendedModel.id
                                        }
                                        recommended
                                        onSelect={() =>
                                          setBusinessModel(
                                            activeRecommendedModel.id,
                                          )
                                        }
                                        onMove={(fromModelId, direction) =>
                                          moveBusinessModelSelection(
                                            selectedModel?.id ?? fromModelId,
                                            direction,
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                ) : null}
                                <div className="space-y-2">
                                  {activeRecommendedModel ? (
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                                      Other options
                                    </p>
                                  ) : null}
                                  <div className="grid gap-4 xl:grid-cols-3">
                                    {otherModels.map((model) => (
                                      <ModelChoice
                                        key={model.id}
                                        model={model}
                                        selected={
                                          selectedModel?.id === model.id
                                        }
                                        recommended={
                                          recommendedModelId === model.id
                                        }
                                        onSelect={() =>
                                          setBusinessModel(model.id)
                                        }
                                        onMove={(fromModelId, direction) =>
                                          moveBusinessModelSelection(
                                            selectedModel?.id ?? fromModelId,
                                            direction,
                                          )
                                        }
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : null}

                          {stepTwoView === 'questionnaire' ? (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <h3 className="text-lg font-semibold text-white">
                                    Help Skillify recommend a layout
                                  </h3>
                                  <p className="mt-1 max-w-2xl text-sm leading-6 text-white/60">
                                    Answer a few questions about how customers
                                    buy from your business. You can still choose
                                    any layout afterward.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setStepTwoView('cards')}
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                                >
                                  Review all layouts
                                </button>
                              </div>

                              <div className="space-y-4">
                                {QUESTIONNAIRE.map(
                                  (question, questionIndex) => (
                                    <fieldset
                                      key={question.key}
                                      className="rounded-2xl border border-white/10 bg-slate-950/35 p-3"
                                    >
                                      <legend className="px-1 text-sm font-medium leading-6 text-white/85">
                                        {questionIndex + 1}. {question.question}
                                      </legend>
                                      <div
                                        role="radiogroup"
                                        aria-label={question.question}
                                        className="mt-3 grid gap-2 sm:grid-cols-3"
                                      >
                                        {question.options.map((option) => {
                                          const selected =
                                            questionnaireAnswers[
                                              question.key
                                            ] === option.value
                                          return (
                                            <button
                                              key={option.value}
                                              type="button"
                                              role="radio"
                                              aria-checked={selected}
                                              onClick={() =>
                                                updateQuestionnaireAnswer(
                                                  question.key,
                                                  option.value,
                                                )
                                              }
                                              className={cn(
                                                'rounded-xl border px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70',
                                                selected
                                                  ? 'border-cyan-300/65 bg-cyan-300/[0.12] text-cyan-50'
                                                  : 'text-white/68 border-white/10 bg-white/[0.035] hover:border-cyan-300/35 hover:bg-cyan-300/[0.06] hover:text-white',
                                              )}
                                            >
                                              {option.label}
                                            </button>
                                          )
                                        })}
                                      </div>
                                    </fieldset>
                                  ),
                                )}
                              </div>

                              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                                <p className="text-xs text-white/50">
                                  {answersComplete
                                    ? 'Ready to show a recommendation.'
                                    : 'Answer all five questions to get a recommendation.'}
                                </p>
                                <Button
                                  type="button"
                                  disabled={!answersComplete}
                                  onClick={showRecommendation}
                                >
                                  Recommend my layout
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {error ? (
                            <p className="text-sm text-rose-300">{error}</p>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-7">
                      <div
                        className="flex items-center gap-2"
                        aria-hidden="true"
                      >
                        <span
                          className={cn(
                            'h-1.5 w-10 rounded-full',
                            step === 1 ? 'bg-cyan-300' : 'bg-cyan-300/50',
                          )}
                        />
                        <span
                          className={cn(
                            'h-1.5 w-10 rounded-full',
                            step === 2 ? 'bg-cyan-300' : 'bg-white/15',
                          )}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/10 bg-white/[0.025] text-white/65 shadow-none hover:border-white/20 hover:bg-white/[0.06] hover:text-white/85"
                          onClick={goBack}
                          disabled={isSubmitting}
                        >
                          {step === 1 ? 'Cancel' : 'Back'}
                        </Button>
                        {step === 1 ? (
                          <button
                            type="button"
                            disabled={!canContinueStepOne}
                            onClick={continueToModelStep}
                            className={cn(
                              'focus-visible:ring-brand-primary/70 inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                              canContinueStepOne
                                ? 'border-brand-primary/80 hover:bg-brand-primary/90 cursor-pointer bg-brand-primary text-white'
                                : 'border-brand-primary/40 cursor-not-allowed bg-brand-primary text-white opacity-50',
                            )}
                          >
                            Continue
                          </button>
                        ) : (
                          <Button
                            type="submit"
                            disabled={!canCreateStepTwo}
                            loading={isSubmitting}
                          >
                            {isSubmitting
                              ? 'Creating workspace...'
                              : 'Create Workspace'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </form>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
