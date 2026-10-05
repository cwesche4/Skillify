import Link from 'next/link'
import type { ReactNode } from 'react'

import { PageHeader } from '@/components/dashboard/PageHeader'
import { cn } from '@/lib/utils'
import { ADVANCED_AUTOMATIONS_LAUNCH_ENABLED } from '@/lib/automations/policy'

type AutomationMode = 'simple' | 'advanced'
type AdvancedSection = 'workflows' | 'templates' | 'executions'
type SimpleSection = 'catalog' | 'executions'

export function AutomationsSectionHeader({
  workspaceSlug,
  activeMode,
  activeSection = 'workflows',
  activeSimpleSection = 'catalog',
  showSimpleHistory = true,
  description,
  actions,
}: {
  workspaceSlug: string
  activeMode: AutomationMode
  activeSection?: AdvancedSection
  activeSimpleSection?: SimpleSection
  showSimpleHistory?: boolean
  description: string
  actions?: ReactNode
}) {
  const automationsHref = `/dashboard/${workspaceSlug}/automations`
  const advancedHref = `${automationsHref}/advanced`

  return (
    <div className="mb-6">
      <PageHeader
        title="Automations"
        description={description}
        actions={actions}
        className="mb-4"
      />

      <div className="border-app bg-app-surface-muted/70 rounded-xl border p-1.5">
        <nav
          aria-label="Automation mode"
          className={cn(
            'grid w-full gap-1 sm:w-fit',
            ADVANCED_AUTOMATIONS_LAUNCH_ENABLED
              ? 'grid-cols-2 sm:min-w-64'
              : 'grid-cols-1 sm:min-w-32',
          )}
        >
          <ModeLink
            href={automationsHref}
            label="Simple"
            active={activeMode === 'simple'}
          />
          {ADVANCED_AUTOMATIONS_LAUNCH_ENABLED ? (
            <ModeLink
              href={advancedHref}
              label="Advanced"
              active={activeMode === 'advanced'}
            />
          ) : null}
        </nav>

        {activeMode === 'simple' ? (
          <nav
            aria-label="Simple automation navigation"
            className="border-app mt-1.5 flex min-w-0 gap-1 overflow-x-auto border-t px-1 pt-1.5"
          >
            <SectionLink
              href={automationsHref}
              label="Recipes"
              active={activeSimpleSection === 'catalog'}
            />
            {showSimpleHistory ? (
              <SectionLink
                href={`${automationsHref}/simple/executions`}
                label="History"
                active={activeSimpleSection === 'executions'}
              />
            ) : null}
          </nav>
        ) : ADVANCED_AUTOMATIONS_LAUNCH_ENABLED ? (
          <nav
            aria-label="Advanced automation navigation"
            className="border-app mt-1.5 flex min-w-0 gap-1 overflow-x-auto border-t px-1 pt-1.5"
          >
            <SectionLink
              href={advancedHref}
              label="Workflows"
              active={activeSection === 'workflows'}
            />
            <SectionLink
              href={`${advancedHref}/templates`}
              label="Templates"
              active={activeSection === 'templates'}
            />
            <SectionLink
              href={`${advancedHref}/executions`}
              label="Executions"
              active={activeSection === 'executions'}
            />
          </nav>
        ) : null}
      </div>
    </div>
  )
}

function ModeLink({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'focus-visible:ring-brand-primary/70 inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-background)]',
        active
          ? 'border-app bg-app-surface-raised text-app-primary border font-semibold shadow-sm'
          : 'text-app-secondary hover:bg-app-surface-hover hover:text-app-primary border border-transparent',
      )}
    >
      {label}
      {active ? <span className="sr-only"> (current)</span> : null}
    </Link>
  )
}

function SectionLink({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'focus-visible:ring-brand-primary/70 inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2',
        active
          ? 'bg-brand-primary/15 text-app-primary font-semibold'
          : 'text-app-secondary hover:bg-app-surface-hover hover:text-app-primary',
      )}
    >
      {label}
      {active ? <span className="sr-only"> (current)</span> : null}
    </Link>
  )
}
