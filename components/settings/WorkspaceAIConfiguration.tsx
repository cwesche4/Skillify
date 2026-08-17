'use client'

import React from 'react'
import { useMemo, useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import { getWorkspaceAIFormDefinition } from '@/lib/ai/workspaceAIFormRegistry'
import {
  DEFAULT_WORKSPACE_AI_GUARDRAILS,
  WORKSPACE_AI_STATUS_COPY,
  WorkspaceAIStatus,
  type WorkspaceAIGuardrails,
} from '@/lib/ai/workspaceAIStatus'
import type { WorkspaceAIStatus as WorkspaceAIStatusValue } from '@/lib/prisma/enums'
import type { WorkspaceCapabilitiesSource } from '@/lib/workspaces/getWorkspaceCapabilities'

type WorkspaceAIProfileView = {
  enabled: boolean
  status: WorkspaceAIStatusValue
  businessSummary?: string | null
  productsAndServices?: unknown
  operatingGuidelines?: unknown
  brandVoice?: unknown
  customerPolicies?: unknown
  automationGuardrails?: Partial<WorkspaceAIGuardrails> | null
}

type ActivityView = {
  id: string
  type: string
  source?: string | null
  createdAt: string | Date
}

type Props = {
  workspaceId: string
  canEdit: boolean
  initialProfile: WorkspaceAIProfileView
  initialActivity: ActivityView[]
  workspaceConfig: WorkspaceCapabilitiesSource
}

function stringifyJson(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(String).join('\n')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => {
        if (Array.isArray(entry)) {
          return `${key}:\n${entry.map((item) => String(item)).join('\n')}`
        }
        return `${key}: ${String(entry)}`
      })
      .join('\n\n')
  }
  return JSON.stringify(value, null, 2)
}

function cleanOptionalText(value: string) {
  return value.trim() || null
}

function normalizeFormState(params: {
  profile: WorkspaceAIProfileView
  guardrails: WorkspaceAIGuardrails
}) {
  return {
    enabled: params.profile.enabled,
    status: params.profile.status,
    businessSummary: params.profile.businessSummary ?? '',
    productsAndServices: stringifyJson(params.profile.productsAndServices),
    operatingGuidelines: stringifyJson(params.profile.operatingGuidelines),
    brandVoice: stringifyJson(params.profile.brandVoice),
    customerPolicies: stringifyJson(params.profile.customerPolicies),
    guardrails: params.guardrails,
  }
}

function serialize(value: unknown) {
  return JSON.stringify(value)
}

function ProfilePanel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
        <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
          {description}
        </p>
      </div>
      {children}
    </section>
  )
}

export function WorkspaceAIConfiguration({
  workspaceId,
  canEdit,
  initialProfile,
  initialActivity,
  workspaceConfig,
}: Props) {
  const initialGuardrails = {
    ...DEFAULT_WORKSPACE_AI_GUARDRAILS,
    ...(initialProfile.automationGuardrails ?? {}),
    allowAutonomousActions: false,
  }
  const formDefinition = getWorkspaceAIFormDefinition(workspaceConfig)
  const [profile, setProfile] = useState(initialProfile)
  const [businessSummary, setBusinessSummary] = useState(
    initialProfile.businessSummary ?? '',
  )
  const [productsAndServices, setProductsAndServices] = useState(
    stringifyJson(initialProfile.productsAndServices),
  )
  const [operatingGuidelines, setOperatingGuidelines] = useState(
    stringifyJson(initialProfile.operatingGuidelines),
  )
  const [brandVoice, setBrandVoice] = useState(
    stringifyJson(initialProfile.brandVoice),
  )
  const [customerPolicies, setCustomerPolicies] = useState(
    stringifyJson(initialProfile.customerPolicies),
  )
  const [guardrails, setGuardrails] =
    useState<WorkspaceAIGuardrails>(initialGuardrails)
  const [activity, setActivity] = useState(initialActivity)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [lastSaved, setLastSaved] = useState(() =>
    normalizeFormState({
      profile: initialProfile,
      guardrails: initialGuardrails,
    }),
  )

  const statusText = WORKSPACE_AI_STATUS_COPY[profile.status]
  const canEnable = canEdit && !saving
  const currentForm = useMemo(
    () => ({
      enabled: profile.enabled,
      status: profile.status,
      businessSummary,
      productsAndServices,
      operatingGuidelines,
      brandVoice,
      customerPolicies,
      guardrails,
    }),
    [
      brandVoice,
      businessSummary,
      customerPolicies,
      guardrails,
      operatingGuidelines,
      productsAndServices,
      profile.enabled,
      profile.status,
    ],
  )
  const dirty = serialize(currentForm) !== serialize(lastSaved)
  useUnsavedChangesWarning(dirty)

  const guardrailSummary = useMemo(
    () => [
      [
        'Advice',
        'Allow AI features to provide recommendations and explanations.',
        guardrails.allowAdvice,
      ],
      [
        'Drafting',
        'Allow AI features to draft messages, summaries, and content.',
        guardrails.allowDrafting,
      ],
      [
        'Action proposals',
        'Allow AI to suggest actions for human review.',
        guardrails.allowActionProposals,
      ],
      [
        'Approval required',
        'Require a person to approve proposed actions.',
        guardrails.requireApprovalForActions,
      ],
      [
        'Autonomous actions',
        'Allow AI to execute supported actions without approval.',
        false,
        'Not available yet',
      ],
    ],
    [guardrails],
  )

  const completedItems = [
    Boolean(lastSaved.businessSummary.trim()),
    Boolean(lastSaved.productsAndServices.trim()),
    Boolean(lastSaved.brandVoice.trim()),
    Boolean(
      lastSaved.customerPolicies.trim() || lastSaved.operatingGuidelines.trim(),
    ),
    lastSaved.enabled,
  ].filter(Boolean).length
  const completeness = Math.round((completedItems / 5) * 100)

  function discard() {
    setProfile((current) => ({
      ...current,
      enabled: lastSaved.enabled,
      status: lastSaved.status,
      businessSummary: lastSaved.businessSummary,
    }))
    setBusinessSummary(lastSaved.businessSummary)
    setProductsAndServices(lastSaved.productsAndServices)
    setOperatingGuidelines(lastSaved.operatingGuidelines)
    setBrandVoice(lastSaved.brandVoice)
    setCustomerPolicies(lastSaved.customerPolicies)
    setGuardrails(lastSaved.guardrails)
    setError(null)
    setSaved(false)
  }

  async function save(overrides: Record<string, unknown> = {}) {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const payload = {
        businessSummary,
        enabled: profile.enabled,
        status: profile.status,
        productsAndServices: cleanOptionalText(productsAndServices),
        operatingGuidelines: cleanOptionalText(operatingGuidelines),
        brandVoice: cleanOptionalText(brandVoice),
        customerPolicies: cleanOptionalText(customerPolicies),
        automationGuardrails: guardrails,
        ...overrides,
      }
      const res = await fetch(
        `/api/workspaces/${workspaceId}/settings/ai-profile`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to save AI configuration.')
      }
      setProfile(json.aiProfile)
      const nextGuardrails = {
        ...DEFAULT_WORKSPACE_AI_GUARDRAILS,
        ...(json.aiProfile.automationGuardrails ?? guardrails),
        allowAutonomousActions: false,
      }
      setGuardrails(nextGuardrails)
      setLastSaved(
        normalizeFormState({
          profile: json.aiProfile,
          guardrails: nextGuardrails,
        }),
      )
      setSaved(true)
      const refreshed = await fetch(
        `/api/workspaces/${workspaceId}/settings/ai-profile`,
        { cache: 'no-store' },
      )
      if (refreshed.ok) {
        const next = await refreshed.json().catch(() => null)
        if (next?.activity) setActivity(next.activity)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function setEnabled(next: boolean) {
    setSaved(false)
    setProfile((current) => ({
      ...current,
      enabled: next,
      status: next ? WorkspaceAIStatus.READY : WorkspaceAIStatus.DISABLED,
    }))
  }

  function updateGuardrail(key: keyof WorkspaceAIGuardrails, value: boolean) {
    if (key === 'allowAutonomousActions') return
    setSaved(false)
    setGuardrails((current) => ({
      ...current,
      [key]: value,
      allowAutonomousActions: false,
      requireApprovalForActions:
        key === 'allowActionProposals' && value
          ? true
          : current.requireApprovalForActions,
    }))
  }

  function setText(setter: (value: string) => void, value: string) {
    setSaved(false)
    setter(value)
  }

  function SaveControls() {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {dirty ? <Badge variant="orange">Unsaved changes</Badge> : null}
        {saved && !dirty ? <Badge variant="green">Saved</Badge> : null}
        <Button
          type="button"
          size="sm"
          disabled={!canEdit || saving || !dirty}
          loading={saving}
          onClick={() => save()}
        >
          Save Changes
        </Button>
        {dirty ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={discard}
          >
            Discard
          </Button>
        ) : null}
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/70">
            AI Configuration
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            Teach Skillify about your business
          </h2>
          <p className="text-neutral-text-secondary mt-1 max-w-3xl text-sm leading-6">
            Add the business context Skillify can use when workspace-aware AI
            features are invoked.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={profile.enabled ? 'green' : 'blue'}>
            {profile.status.replaceAll('_', ' ')}
          </Badge>
          <Badge variant="purple">AI setup progress: {completeness}%</Badge>
        </div>
      </div>

      <SaveControls />

      <ProfilePanel
        title="Status and enablement"
        description="Workspace-aware AI context makes saved business details available to future AI features. It does not start continuous background processing, execute actions automatically, or connect an external provider."
      >
        <div className="flex items-start gap-3">
          <Switch
            checked={profile.enabled}
            disabled={!canEnable}
            onCheckedChange={setEnabled}
          />
          <div>
            <p className="text-sm font-medium text-neutral-100">
              Enable workspace-aware AI context
            </p>
            <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
              {statusText}
            </p>
            {!canEdit ? (
              <p className="mt-2 text-xs text-amber-300">
                Only workspace owners and admins can edit AI configuration.
              </p>
            ) : null}
          </div>
        </div>
      </ProfilePanel>

      <ProfilePanel
        title="Business context"
        description="Start with the plain-language background a teammate would need before helping a customer."
      >
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-neutral-100">
            {formDefinition.businessOverview.label}
          </span>
          <textarea
            value={businessSummary}
            disabled={!canEdit}
            onChange={(event) =>
              setText(setBusinessSummary, event.target.value)
            }
            className="min-h-24 w-full rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-neutral-100 outline-none focus:border-cyan-300/60 disabled:opacity-60"
            placeholder={formDefinition.businessOverview.placeholder}
          />
          <span className="text-neutral-text-secondary block text-xs">
            {formDefinition.businessOverview.helper}
          </span>
        </label>
      </ProfilePanel>

      <div className="grid gap-4 md:grid-cols-2">
        <ProfilePanel
          title={formDefinition.productsOrServices.label}
          description="List what customers buy or request most often."
        >
          <ProfileTextField
            label={formDefinition.productsOrServices.label}
            value={productsAndServices}
            disabled={!canEdit}
            onChange={(value) => setText(setProductsAndServices, value)}
            placeholder={formDefinition.productsOrServices.placeholder}
            helper={formDefinition.productsOrServices.helper}
          />
        </ProfilePanel>

        <ProfilePanel
          title="Brand voice"
          description="Tell Skillify how the business should sound."
        >
          <ProfileTextField
            label={formDefinition.brandVoice.label}
            value={brandVoice}
            disabled={!canEdit}
            onChange={(value) => setText(setBrandVoice, value)}
            placeholder={formDefinition.brandVoice.placeholder}
            helper={formDefinition.brandVoice.helper}
          />
        </ProfilePanel>

        <ProfilePanel
          title="Guidelines and policies"
          description="Add operational rules and customer-facing policies."
        >
          <div className="space-y-3">
            <ProfileTextField
              label={formDefinition.operatingGuidelines.label}
              value={operatingGuidelines}
              disabled={!canEdit}
              onChange={(value) => setText(setOperatingGuidelines, value)}
              placeholder={formDefinition.operatingGuidelines.placeholder}
              helper={formDefinition.operatingGuidelines.helper}
            />
            <ProfileTextField
              label={formDefinition.customerPolicies.label}
              value={customerPolicies}
              disabled={!canEdit}
              onChange={(value) => setText(setCustomerPolicies, value)}
              placeholder={formDefinition.customerPolicies.placeholder}
              helper={formDefinition.customerPolicies.helper}
            />
          </div>
        </ProfilePanel>

        <ProfilePanel
          title="Guardrails"
          description="Control what AI features may suggest when they use this saved context."
        >
          <div className="space-y-2">
            {guardrailSummary.map(([label, description, enabled, note]) => {
              const guardrailKey =
                label === 'Advice'
                  ? 'allowAdvice'
                  : label === 'Drafting'
                    ? 'allowDrafting'
                    : label === 'Action proposals'
                      ? 'allowActionProposals'
                      : label === 'Approval required'
                        ? 'requireApprovalForActions'
                        : 'allowAutonomousActions'
              return (
                <div
                  key={label as string}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-white/[0.03] px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-medium text-neutral-100">
                      {label as string}
                    </p>
                    <p className="text-neutral-text-secondary mt-0.5 text-xs leading-5">
                      {description as string}
                    </p>
                  </div>
                  {note ? (
                    <Badge variant="blue" className="shrink-0 text-[10px]">
                      {note as string}
                    </Badge>
                  ) : (
                    <Switch
                      checked={Boolean(enabled)}
                      disabled={!canEdit}
                      onCheckedChange={(value) =>
                        updateGuardrail(
                          guardrailKey as keyof WorkspaceAIGuardrails,
                          value,
                        )
                      }
                    />
                  )}
                </div>
              )
            })}
          </div>
        </ProfilePanel>
      </div>

      <ProfilePanel
        title="Knowledge sources"
        description="Connected documents, policies, websites, and knowledge sources will appear here in a future phase."
      >
        <p className="text-neutral-text-secondary text-xs">
          No crawling, indexing, syncing, or provider calls are running today.
        </p>
      </ProfilePanel>

      <SaveControls />

      <div className="border-t border-slate-800 pt-3">
        <p className="text-xs font-semibold text-neutral-100">
          Recent lifecycle activity
        </p>
        {activity.length > 0 ? (
          <div className="mt-2 space-y-2">
            {activity.slice(0, 5).map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-white/[0.03] px-3 py-2"
              >
                <span className="text-xs text-neutral-200">
                  {event.type.replaceAll('_', ' ')}
                </span>
                <span className="text-neutral-text-secondary text-[11px]">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-text-secondary mt-2 text-xs">
            Lifecycle updates will appear here after AI configuration changes.
          </p>
        )}
      </div>
    </div>
  )
}

function ProfileTextField({
  label,
  value,
  disabled,
  placeholder,
  helper,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  placeholder: string
  helper: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-neutral-100">{label}</span>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-32 w-full rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm leading-6 text-neutral-100 outline-none focus:border-cyan-300/60 disabled:opacity-60"
        placeholder={placeholder}
      />
      <span className="text-neutral-text-secondary block text-xs">
        {helper}
      </span>
    </label>
  )
}
