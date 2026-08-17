'use client'

import React from 'react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import {
  getWorkspaceBusinessModelDefinition,
  getWorkspaceBusinessModelDefaults,
  listWorkspaceBusinessModels,
} from '@/lib/workspaces/businessModelRegistry'
import {
  getWorkspaceCapabilities,
  type WorkspaceCapabilitiesSource,
} from '@/lib/workspaces/getWorkspaceCapabilities'
import { normalizeSalesProcessConfig } from '@/lib/workspaces/normalizeSalesProcessConfig'
import {
  LeadConversionDestination,
  QualifiedLeadBehavior,
  WorkspaceBusinessModel,
} from '@/lib/prisma/enums'
import { cn } from '@/lib/utils'

type Props = {
  workspaceId: string
  initialConfig: WorkspaceCapabilitiesSource
  canEdit: boolean
  activeOpportunityCount?: number
}

export function SalesProcessSettings({
  workspaceId,
  initialConfig,
  canEdit,
  activeOpportunityCount = 0,
}: Props) {
  const router = useRouter()
  const [config, setConfig] = useState<WorkspaceCapabilitiesSource>(() =>
    normalizeSalesProcessConfig(initialConfig),
  )
  const [lastSavedConfig, setLastSavedConfig] =
    useState<WorkspaceCapabilitiesSource>(() =>
      normalizeSalesProcessConfig(initialConfig),
    )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const models = listWorkspaceBusinessModels()
  const capabilities = useMemo(() => getWorkspaceCapabilities(config), [config])
  const savedCapabilities = useMemo(
    () => getWorkspaceCapabilities(lastSavedConfig),
    [lastSavedConfig],
  )
  const savedModelDefinition = getWorkspaceBusinessModelDefinition(
    lastSavedConfig.businessModel,
  )
  const pendingModelDefinition = getWorkspaceBusinessModelDefinition(
    config.businessModel,
  )
  const dirty =
    JSON.stringify(configForCompare(config)) !==
    JSON.stringify(configForCompare(lastSavedConfig))
  const layoutDirty =
    config.businessModel !== lastSavedConfig.businessModel ||
    config.opportunitiesEnabled !== lastSavedConfig.opportunitiesEnabled ||
    config.commerceEnabled !== lastSavedConfig.commerceEnabled
  useUnsavedChangesWarning(dirty)

  function applyModel(model: string) {
    if (!(model in WorkspaceBusinessModel)) return
    const defaults = getWorkspaceBusinessModelDefaults(
      model as WorkspaceBusinessModel,
    )
    setConfig((current) => ({
      ...normalizeSalesProcessConfig({
        ...current,
        ...defaults,
      }),
    }))
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    const normalizedConfig = normalizeSalesProcessConfig(config)
    const res = await fetch(`/api/workspaces/${workspaceId}/sales-process`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedConfig),
    })
    if (!res.ok) {
      setMessage('Could not save sales process settings.')
      setSaving(false)
      return
    }
    const json = await res.json()
    const savedConfig = normalizeSalesProcessConfig(json.workspace)
    setConfig(savedConfig)
    setLastSavedConfig(savedConfig)
    setMessage('Sales process settings saved.')
    setSaving(false)
    router.refresh()
  }

  function discard() {
    setConfig(lastSavedConfig)
    setMessage(null)
  }

  function updateConfig(next: WorkspaceCapabilitiesSource) {
    setConfig(normalizeSalesProcessConfig(next))
  }

  const showLeadConversion = capabilities.modules.leads
  const showCommerceWorkflow =
    !showLeadConversion &&
    capabilities.modules.customers &&
    capabilities.modules.orders &&
    capabilities.modules.fulfillment
  const isCommerceWorkspace = capabilities.commerce.commerceEnabled
  const isSimpleServiceWorkspace =
    capabilities.businessModel ===
    WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
  const opportunitiesEnabled = Boolean(config.opportunitiesEnabled)
  const selectedDestination =
    config.defaultLeadDestination ??
    capabilities.conversion.defaultLeadDestination

  return (
    <Card className="space-y-4 p-5 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            {isCommerceWorkspace ? 'Commerce Structure' : 'Sales Process'}
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            {isCommerceWorkspace
              ? 'Control the customer, product, order, and fulfillment modules available in this workspace.'
              : 'Control how this workspace routes leads, names customers, and shows CRM modules.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="blue">Current: {savedModelDefinition.name}</Badge>
          {config.businessModel !== lastSavedConfig.businessModel ? (
            <Badge variant="orange">
              Pending: {pendingModelDefinition.name}
            </Badge>
          ) : null}
        </div>
      </div>

      {dirty ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.08] p-3">
          <div>
            <p className="text-xs font-semibold text-amber-100">
              Unsaved changes
            </p>
            {layoutDirty ? (
              <p className="mt-1 text-xs text-amber-100/80">
                Save these changes to apply the new workspace layout and update
                navigation.
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={saving}
            onClick={discard}
          >
            Discard
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="text-app-secondary font-medium">
            Workspace layout
          </span>
          <Select
            value={config.businessModel ?? WorkspaceBusinessModel.DIRECT_SALES}
            disabled={!canEdit}
            onChange={(event) => applyModel(event.target.value)}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </Select>
        </label>

        {!isCommerceWorkspace && !isSimpleServiceWorkspace ? (
          <label className="app-option-card flex items-center gap-3 rounded-xl p-3 text-xs">
            <input
              type="checkbox"
              checked={opportunitiesEnabled}
              disabled={!canEdit}
              onChange={(event) =>
                updateConfig({
                  ...config,
                  opportunitiesEnabled: event.target.checked,
                  defaultLeadDestination: event.target.checked
                    ? resolveEnabledDestination(config)
                    : LeadConversionDestination.SALE,
                })
              }
            />
            <span>
              <span className="text-app-secondary block font-medium">
                Opportunities pipeline enabled
              </span>
              <span className="text-neutral-text-secondary">
                Hide this from normal navigation without deleting records.
              </span>
            </span>
          </label>
        ) : (
          <div className="app-option-card rounded-xl p-3 text-xs">
            <span className="text-app-secondary block font-medium">
              Active workflow
            </span>
            <span className="text-neutral-text-secondary mt-1 block">
              {isSimpleServiceWorkspace
                ? 'Lead → Customer → Job → Job Steps'
                : 'Customer → Order → Fulfillment'}
            </span>
          </div>
        )}
      </div>

      <div className="app-panel-muted rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-app-primary text-sm font-semibold">
              {showCommerceWorkflow
                ? 'Commerce Workflow'
                : 'Lead conversion path'}
            </h3>
            <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
              {showCommerceWorkflow
                ? 'Review how customers, orders, and fulfillment connect in this workspace.'
                : 'Choose what normally happens when a lead is converted.'}
            </p>
          </div>
          {dirty ? <Badge variant="orange">Unsaved changes</Badge> : null}
        </div>

        <p className="text-neutral-text-secondary mt-3 text-xs leading-5">
          {showCommerceWorkflow
            ? 'Product Commerce starts with customers and orders. CRM-style lead capture for commerce is reserved for a future capability and is not active by default.'
            : 'Default path controls where most converted leads go. Individual overrides are available only when direct conversion is allowed.'}
        </p>

        {!showLeadConversion ? (
          <div
            className="app-option-card mt-3 rounded-xl p-3"
            aria-label="Commerce workflow: Customer to Order to Fulfillment"
          >
            <p className="text-app-primary text-sm font-semibold">
              Customer → Order → Fulfillment
            </p>
            <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
              This layout keeps Leads, Opportunities, and Sales Pipeline out of
              the default commerce workspace. Customer, Order, and Fulfillment
              capabilities can support future commerce records without enabling
              lead conversion controls today.
            </p>
            <p className="mt-2 text-xs leading-5 text-cyan-100">
              Future Commerce CRM capabilities such as commerce leads remain
              inactive unless the workspace explicitly enables them later.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Customers', 'Products', 'Orders', 'Fulfillment'].map(
                (module) => (
                  <Badge key={module} variant="blue">
                    {module}
                  </Badge>
                ),
              )}
            </div>
          </div>
        ) : isSimpleServiceWorkspace ? (
          <div className="app-option-card mt-3 rounded-xl p-3">
            <p className="text-app-primary text-sm font-semibold">
              Lead → {capabilities.terminology.customerSingular}
            </p>
            <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
              Converted leads move directly into{' '}
              {capabilities.terminology.customerPlural.toLowerCase()}. The lead
              stage describes where the inquiry stands, but no stage is a
              mandatory checkpoint.
            </p>
            <p className="mt-2 text-xs leading-5 text-cyan-100">
              Jobs and job steps stay in Operations while the canonical Client,
              Service Request, and Task records remain stable internally.
            </p>
          </div>
        ) : opportunitiesEnabled ? (
          <div
            role="radiogroup"
            aria-label="Lead conversion path"
            className="mt-3 grid gap-3 md:grid-cols-2"
          >
            <ConversionPathCard
              title="Convert to Opportunity"
              flow="Lead → Opportunity"
              description="Use discovery, consultations, site visits, scoping, proposals, or negotiation before moving the record into Sales."
              selected={
                selectedDestination === LeadConversionDestination.OPPORTUNITY
              }
              recommended={
                config.businessModel ===
                WorkspaceBusinessModel.CONSULTATIVE_SALES
              }
              disabled={!canEdit}
              onSelect={() =>
                updateConfig({
                  ...config,
                  defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
                })
              }
            />
            <ConversionPathCard
              title="Convert directly to Sale"
              flow="Lead → Sale"
              description="Skip the Opportunity stage when the lead is ready to buy or does not require a longer sales process."
              selected={selectedDestination === LeadConversionDestination.SALE}
              disabled={!canEdit}
              onSelect={() =>
                updateConfig({
                  ...config,
                  defaultLeadDestination: LeadConversionDestination.SALE,
                })
              }
            />
          </div>
        ) : (
          <div className="app-option-card mt-3 rounded-xl p-3">
            <p className="text-app-primary text-sm font-semibold">
              Lead → Sale
            </p>
            <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
              Converted leads move directly into Sales because the Opportunities
              pipeline is disabled.
            </p>
            <p className="mt-2 text-xs leading-5 text-cyan-100">
              Enable Opportunities to route converted leads through discovery,
              scoping, proposals, or negotiation first.
            </p>
          </div>
        )}
      </div>

      {showLeadConversion && opportunitiesEnabled ? (
        <label className="app-option-card flex items-center gap-3 rounded-xl p-3 text-xs">
          <input
            type="checkbox"
            checked={Boolean(config.allowDirectLeadToSale)}
            disabled={!canEdit}
            onChange={(event) =>
              updateConfig({
                ...config,
                allowDirectLeadToSale: event.target.checked,
              })
            }
          />
          <span>
            <span className="text-app-secondary block font-medium">
              Allow direct conversion to Sale
            </span>
            <span className="text-neutral-text-secondary">
              Let users bypass Opportunities for individual leads that are ready
              to buy immediately.
            </span>
          </span>
        </label>
      ) : null}

      {showLeadConversion ? (
        <div className="app-panel-muted rounded-xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-app-primary text-sm font-semibold">
                Lead Qualification Behavior
              </h3>
              <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
                Choose what Skillify should do after a Lead is marked Qualified.
              </p>
            </div>
            <Badge variant="blue">
              Default next pipeline:{' '}
              {capabilities.conversion.defaultLeadDestination ===
              LeadConversionDestination.OPPORTUNITY
                ? 'Opportunity'
                : capabilities.conversion.defaultLeadDestination ===
                    LeadConversionDestination.SALE
                  ? 'Sale'
                  : capabilities.terminology.customerSingular}
            </Badge>
          </div>
          <div
            role="radiogroup"
            aria-label="Lead qualification behavior"
            className="mt-3 grid gap-3 md:grid-cols-3"
          >
            <QualificationBehaviorCard
              title="Ask before converting"
              description="Show a confirmation so the user can convert the Lead or keep it Qualified."
              selected={
                capabilities.conversion.qualifiedLeadBehavior ===
                QualifiedLeadBehavior.ASK
              }
              disabled={!canEdit}
              onSelect={() =>
                updateConfig({
                  ...config,
                  qualifiedLeadBehavior: QualifiedLeadBehavior.ASK,
                })
              }
            />
            <QualificationBehaviorCard
              title="Automatically convert"
              description="Move Qualified Leads into the workspace’s default next pipeline immediately after saving."
              selected={
                capabilities.conversion.qualifiedLeadBehavior ===
                QualifiedLeadBehavior.AUTO_CONVERT
              }
              disabled={!canEdit}
              onSelect={() =>
                updateConfig({
                  ...config,
                  qualifiedLeadBehavior: QualifiedLeadBehavior.AUTO_CONVERT,
                })
              }
            />
            <QualificationBehaviorCard
              title="Keep Qualified"
              description="Leave the Lead in the Leads pipeline without showing a conversion prompt."
              selected={
                capabilities.conversion.qualifiedLeadBehavior ===
                QualifiedLeadBehavior.KEEP_QUALIFIED
              }
              disabled={!canEdit}
              onSelect={() =>
                updateConfig({
                  ...config,
                  qualifiedLeadBehavior: QualifiedLeadBehavior.KEEP_QUALIFIED,
                })
              }
            />
          </div>
        </div>
      ) : null}

      {!config.opportunitiesEnabled && activeOpportunityCount > 0 ? (
        <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.08] p-3 text-xs text-amber-100">
          You currently have active opportunities. Disabling this pipeline will
          hide it from normal navigation and stop new default conversions, but
          it will not delete existing records.
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs">
          <span className="text-app-secondary font-medium">
            Customer singular
          </span>
          <Input
            value={config.customerSingularLabel ?? ''}
            disabled={!canEdit}
            onChange={(event) =>
              updateConfig({
                ...config,
                customerSingularLabel: event.target.value,
              })
            }
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-app-secondary font-medium">
            Customer plural
          </span>
          <Input
            value={config.customerPluralLabel ?? ''}
            disabled={!canEdit}
            onChange={(event) =>
              updateConfig({
                ...config,
                customerPluralLabel: event.target.value,
              })
            }
          />
        </label>
        {!isCommerceWorkspace ? (
          <label className="space-y-1 text-xs">
            <span className="text-app-secondary font-medium">Sales label</span>
            <Input
              value={config.salesLabel ?? ''}
              disabled={!canEdit}
              onChange={(event) =>
                updateConfig({
                  ...config,
                  salesLabel: event.target.value,
                })
              }
            />
          </label>
        ) : (
          <div className="app-panel-muted rounded-xl p-3 text-xs">
            <span className="text-app-secondary font-medium">
              Commerce terminology
            </span>
            <p className="text-neutral-text-secondary mt-1 leading-5">
              Orders and Fulfillment use canonical commerce labels. The legacy
              Sales label remains saved for compatibility if this workspace
              switches back to a service layout.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-neutral-text-secondary text-xs">
          Commerce foundation:{' '}
          <span className="text-app-secondary">
            {savedCapabilities.modules.customers
              ? 'Customers, Orders, and Fulfillment configured'
              : 'Disabled'}
          </span>
        </p>
        <div className="flex items-center gap-3">
          {message && !dirty ? (
            <span className="text-neutral-text-secondary text-xs">
              {message}
            </span>
          ) : null}
          {dirty ? <Badge variant="orange">Unsaved changes</Badge> : null}
          <Button
            type="button"
            size="sm"
            disabled={!canEdit || !dirty}
            loading={saving}
            onClick={save}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </Card>
  )
}

function configForCompare(config: WorkspaceCapabilitiesSource) {
  const normalized = normalizeSalesProcessConfig(config)
  return {
    businessModel: normalized.businessModel ?? null,
    opportunitiesEnabled: normalized.opportunitiesEnabled ?? null,
    commerceEnabled: normalized.commerceEnabled ?? null,
    defaultLeadDestination: normalized.defaultLeadDestination ?? null,
    allowDirectLeadToSale: normalized.allowDirectLeadToSale ?? null,
    qualifiedLeadBehavior: normalized.qualifiedLeadBehavior ?? null,
    customerSingularLabel: normalized.customerSingularLabel ?? '',
    customerPluralLabel: normalized.customerPluralLabel ?? '',
    salesLabel: normalized.salesLabel ?? '',
  }
}

function resolveEnabledDestination(config: WorkspaceCapabilitiesSource) {
  const currentDestination = config.defaultLeadDestination
  if (currentDestination === LeadConversionDestination.OPPORTUNITY) {
    return LeadConversionDestination.OPPORTUNITY
  }
  if (config.businessModel === WorkspaceBusinessModel.CONSULTATIVE_SALES) {
    return LeadConversionDestination.OPPORTUNITY
  }
  return LeadConversionDestination.SALE
}

function ConversionPathCard({
  title,
  flow,
  description,
  selected,
  recommended = false,
  disabled = false,
  onSelect,
}: {
  title: string
  flow: string
  description: string
  selected: boolean
  recommended?: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex h-full min-h-36 w-full flex-col items-start rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-background)] disabled:cursor-not-allowed disabled:opacity-60',
        selected ? 'border-cyan-300/60 bg-cyan-300/[0.08]' : 'app-option-card',
      )}
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span className="text-app-primary font-medium">{title}</span>
        <span className="flex shrink-0 items-center gap-2">
          {recommended ? <Badge variant="green">Recommended</Badge> : null}
          {selected ? (
            <span className="rounded-full border border-cyan-300/40 bg-cyan-300/15 p-1 text-cyan-100">
              <Check className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </span>
      </span>
      <span className="border-app bg-app-surface-muted text-app-primary mt-2 rounded-full border px-2.5 py-1 text-xs font-semibold">
        {flow}
      </span>
      <span className="text-neutral-text-secondary mt-3 text-xs leading-5">
        {description}
      </span>
    </button>
  )
}

function QualificationBehaviorCard({
  title,
  description,
  selected,
  disabled = false,
  onSelect,
}: {
  title: string
  description: string
  selected: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex h-full min-h-32 w-full flex-col items-start rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-background)] disabled:cursor-not-allowed disabled:opacity-60',
        selected ? 'border-cyan-300/60 bg-cyan-300/[0.08]' : 'app-option-card',
      )}
    >
      <span className="flex w-full items-center justify-between gap-3">
        <span className="text-app-primary font-medium">{title}</span>
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
            selected
              ? 'border-cyan-300 bg-cyan-300 text-slate-950'
              : 'border-app-strong text-transparent',
          )}
          aria-hidden="true"
        >
          <Check className="h-3 w-3" />
        </span>
      </span>
      <span className="text-neutral-text-secondary mt-2 text-xs leading-5">
        {description}
      </span>
    </button>
  )
}
