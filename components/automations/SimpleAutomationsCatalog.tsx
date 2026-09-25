'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  FileText,
  MessagesSquare,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { SimpleAutomationSetupPanel } from '@/components/automations/SimpleAutomationSetupPanel'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import {
  SIMPLE_AUTOMATION_CATEGORY_ORDER,
  type SimpleAutomationDefinition,
  type SimpleAutomationIcon,
  type SimpleAutomationInstallationSummary,
  type SimpleAutomationReadinessSummary,
} from '@/lib/automations/simpleAutomationCatalog'

const iconByKey: Record<SimpleAutomationIcon, LucideIcon> = {
  bell: Bell,
  messages: MessagesSquare,
  estimate: FileText,
  appointment: CalendarClock,
  'schedule-change': CalendarRange,
  'job-complete': CheckCircle2,
}

export function SimpleAutomationsCatalog({
  recipes,
  workspaceId,
  workspaceSlug,
  hasSimpleAutomationCapability,
  canManage,
  initialInstallations,
  initialReadiness,
}: {
  recipes: SimpleAutomationDefinition[]
  workspaceId: string
  workspaceSlug: string
  hasSimpleAutomationCapability: boolean
  canManage: boolean
  initialInstallations: SimpleAutomationInstallationSummary[]
  initialReadiness: Record<string, SimpleAutomationReadinessSummary>
}) {
  const [query, setQuery] = useState('')
  const [selectedRecipe, setSelectedRecipe] =
    useState<SimpleAutomationDefinition | null>(null)
  const [installations, setInstallations] = useState(
    () =>
      new Map(
        initialInstallations.map((installation) => [
          installation.definitionKey,
          installation,
        ]),
      ),
  )
  const [readiness, setReadiness] = useState(initialReadiness)
  const [pendingLifecycleKey, setPendingLifecycleKey] = useState<string | null>(
    null,
  )

  const changeLifecycle = async (
    recipe: SimpleAutomationDefinition,
    action: 'activate' | 'pause' | 'resume',
  ) => {
    setPendingLifecycleKey(recipe.key)
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/simple-automations/${encodeURIComponent(recipe.key)}/${action}`,
        { method: 'POST' },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message =
          payload.requirements?.[0]?.message ??
          payload.error ??
          'Automation status could not be changed.'
        throw new Error(message)
      }

      setInstallations((current) => {
        const existing = current.get(recipe.key)
        if (!existing) return current
        const next = new Map(current)
        next.set(recipe.key, {
          ...existing,
          automationStatus: payload.automationStatus,
        })
        return next
      })
      if (payload.readiness) {
        setReadiness((current) => ({
          ...current,
          [recipe.key]: payload.readiness,
        }))
      }
      toast.success(
        action === 'pause'
          ? `${recipe.title} paused.`
          : action === 'resume'
            ? `${recipe.title} resumed.`
            : `${recipe.title} activated.`,
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Automation status could not be changed.',
      )
    } finally {
      setPendingLifecycleKey(null)
    }
  }

  const filteredRecipes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return recipes

    return recipes.filter((recipe) =>
      [recipe.title, recipe.description, recipe.categoryLabel]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [query, recipes])

  const groupedRecipes = useMemo(
    () =>
      SIMPLE_AUTOMATION_CATEGORY_ORDER.map((category) => ({
        category,
        label:
          recipes.find((recipe) => recipe.category === category)
            ?.categoryLabel ?? category,
        recipes: filteredRecipes.filter(
          (recipe) => recipe.category === category,
        ),
      })).filter((group) => group.recipes.length > 0),
    [filteredRecipes, recipes],
  )

  return (
    <>
      <section aria-labelledby="simple-automations-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="simple-automations-heading"
              className="text-app-primary text-xl font-semibold tracking-tight"
            >
              Choose what you want Skillify to handle for you.
            </h2>
            <p className="text-app-secondary mt-1 max-w-2xl text-sm leading-6">
              Save the setup that fits your business, then activate recipes with
              a complete production connection.
            </p>
          </div>

          {recipes.length > 0 ? (
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="text-app-muted pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search automations..."
                aria-label="Search Simple Automations"
                className="pl-9"
              />
            </div>
          ) : null}
        </div>

        {recipes.length === 0 ? (
          <Card className="mt-6 border-dashed p-6 text-center sm:p-8">
            <h3 className="text-app-primary text-base font-semibold">
              Simple Automations are not available for this workspace yet
            </h3>
            <p className="text-app-secondary mx-auto mt-2 max-w-lg text-sm leading-6">
              This first catalog is designed for service businesses. Custom
              workflows are still available in Advanced.
            </p>
            <Link
              href={`/dashboard/${workspaceSlug}/automations/advanced`}
              className="focus-visible:ring-brand-primary/70 mt-4 inline-flex rounded-lg px-2 py-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2"
            >
              Go to Advanced
            </Link>
          </Card>
        ) : filteredRecipes.length === 0 ? (
          <Card className="mt-6 border-dashed p-6 text-center">
            <h3 className="text-app-primary text-base font-semibold">
              No automations match “{query.trim()}”
            </h3>
            <p className="text-app-secondary mt-2 text-sm">
              Try searching for leads, scheduling, reminders, or jobs.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => setQuery('')}
            >
              Clear search
            </Button>
          </Card>
        ) : (
          <div className="mt-7 space-y-8">
            {groupedRecipes.map((group) => (
              <section
                key={group.category}
                aria-labelledby={`automation-category-${group.category}`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <h3
                    id={`automation-category-${group.category}`}
                    className="text-app-primary text-sm font-semibold"
                  >
                    {group.label}
                  </h3>
                  <span
                    className="border-app h-px flex-1 border-t"
                    aria-hidden="true"
                  />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {group.recipes.map((recipe) => (
                    <SimpleAutomationCard
                      key={recipe.key}
                      recipe={recipe}
                      hasSimpleAutomationCapability={
                        hasSimpleAutomationCapability
                      }
                      canManage={canManage}
                      installation={installations.get(recipe.key)}
                      readiness={readiness[recipe.key]}
                      lifecyclePending={pendingLifecycleKey === recipe.key}
                      onSetUp={() => setSelectedRecipe(recipe)}
                      onLifecycle={(action) =>
                        void changeLifecycle(recipe, action)
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <div className="border-app mt-9 border-t pt-5 text-center">
        <p className="text-app-muted text-xs">
          Need more control?{' '}
          <Link
            href={`/dashboard/${workspaceSlug}/automations/advanced`}
            className="text-app-secondary focus-visible:ring-brand-primary/70 rounded font-medium hover:text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2"
          >
            Build a custom workflow in Advanced.
          </Link>
        </p>
      </div>

      <SimpleAutomationSetupPanel
        recipe={selectedRecipe}
        workspaceId={workspaceId}
        installation={
          selectedRecipe ? installations.get(selectedRecipe.key) : undefined
        }
        canManage={canManage}
        onClose={() => setSelectedRecipe(null)}
        onSaved={(installation, installationReadiness) => {
          setInstallations((current) => {
            const next = new Map(current)
            next.set(installation.definitionKey, installation)
            return next
          })
          setReadiness((current) => ({
            ...current,
            [installation.definitionKey]: installationReadiness,
          }))
        }}
        onRemoved={(definitionKey) => {
          setInstallations((current) => {
            const next = new Map(current)
            next.delete(definitionKey)
            return next
          })
        }}
      />
    </>
  )
}

function SimpleAutomationCard({
  recipe,
  hasSimpleAutomationCapability,
  canManage,
  installation,
  readiness,
  lifecyclePending,
  onSetUp,
  onLifecycle,
}: {
  recipe: SimpleAutomationDefinition
  hasSimpleAutomationCapability: boolean
  canManage: boolean
  installation?: SimpleAutomationInstallationSummary
  readiness?: SimpleAutomationReadinessSummary
  lifecyclePending: boolean
  onSetUp: () => void
  onLifecycle: (action: 'activate' | 'pause' | 'resume') => void
}) {
  const Icon = iconByKey[recipe.icon]
  const isAvailable = recipe.availability.state === 'available'
  const canOpen =
    isAvailable &&
    hasSimpleAutomationCapability &&
    (canManage || Boolean(installation))
  const automationStatus = installation?.automationStatus
  const statusLabel = !isAvailable
    ? 'Coming Soon'
    : !hasSimpleAutomationCapability
      ? 'Unavailable'
      : automationStatus === 'ACTIVE'
        ? readiness && !readiness.ready
          ? 'Active · Needs Attention'
          : 'Active'
        : automationStatus === 'PAUSED'
          ? 'Paused'
          : installation && readiness?.liveSupported && !readiness.ready
            ? 'Needs Integration'
            : installation
              ? 'Configured'
              : 'Not Set Up'
  const statusVariant: BadgeVariant = !isAvailable
    ? 'yellow'
    : !hasSimpleAutomationCapability
      ? 'gray'
      : automationStatus === 'ACTIVE'
        ? readiness && !readiness.ready
          ? 'orange'
          : 'green'
        : automationStatus === 'PAUSED'
          ? 'yellow'
          : installation && readiness?.liveSupported && !readiness.ready
            ? 'orange'
            : installation
              ? 'green'
              : 'brand'

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="border-app bg-app-surface-muted inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-brand-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {recipe.recommended ? (
            <Badge variant="blue" size="xs">
              Recommended
            </Badge>
          ) : null}
          <Badge variant={statusVariant} size="xs">
            {statusLabel}
          </Badge>
        </div>
      </div>

      <div className="mt-4 flex-1">
        <p className="text-app-muted text-[11px] font-semibold uppercase tracking-[0.1em]">
          {recipe.categoryLabel}
        </p>
        <h4 className="text-app-primary mt-1.5 text-base font-semibold">
          {recipe.title}
        </h4>
        <p className="text-app-secondary mt-2 text-sm leading-6">
          {recipe.description}
        </p>

        <div className="border-app bg-app-surface-muted mt-4 rounded-xl border px-3 py-2.5">
          <p className="text-app-secondary text-xs leading-5">
            {!hasSimpleAutomationCapability && isAvailable
              ? 'Simple Automations are unavailable on this workspace plan.'
              : automationStatus === 'ACTIVE'
                ? readiness && !readiness.ready
                  ? `${readiness.requirements[0]?.message ?? 'A production requirement needs attention.'} New events will not dispatch until it is resolved.`
                  : 'This automation is live and will create run history when triggered.'
                : automationStatus === 'PAUSED'
                  ? (readiness?.requirements[0]?.message ??
                    'This automation is paused and will not dispatch.')
                  : installation
                    ? (readiness?.requirements[0]?.message ??
                      'Your configuration is saved and ready for activation.')
                    : !canManage
                      ? 'Ask a workspace manager to set up this automation.'
                      : recipe.availability.helpText}
          </p>
          {recipe.availability.requirementLabel ? (
            <p className="text-app-muted mt-1 text-[11px] leading-4">
              {recipe.availability.requirementLabel}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canOpen}
          onClick={canOpen ? onSetUp : undefined}
          aria-label={
            canOpen
              ? `${canManage ? (installation ? 'Edit' : 'Set up') : 'View'} ${recipe.title}`
              : !isAvailable
                ? `${recipe.title} is coming soon`
                : !hasSimpleAutomationCapability
                  ? `${recipe.title} is unavailable on this workspace plan`
                  : `${recipe.title} requires a workspace manager to configure`
          }
        >
          {canOpen
            ? canManage
              ? installation
                ? 'Edit'
                : 'Set Up'
              : 'View'
            : !isAvailable
              ? 'Coming Soon'
              : !hasSimpleAutomationCapability
                ? 'Unavailable'
                : 'Needs Manager'}
        </Button>
        {installation && canManage && isAvailable ? (
          automationStatus === 'ACTIVE' ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={lifecyclePending}
              onClick={() => onLifecycle('pause')}
            >
              Pause
            </Button>
          ) : readiness?.liveSupported ? (
            <Button
              type="button"
              size="sm"
              disabled={!readiness.ready}
              loading={lifecyclePending}
              onClick={() =>
                onLifecycle(
                  automationStatus === 'PAUSED' ? 'resume' : 'activate',
                )
              }
            >
              {automationStatus === 'PAUSED' ? 'Resume' : 'Activate'}
            </Button>
          ) : (
            <Button type="button" variant="secondary" size="sm" disabled>
              Activation Pending
            </Button>
          )
        ) : null}
      </div>
    </Card>
  )
}
