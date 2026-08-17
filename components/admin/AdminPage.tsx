import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, CircleAlert, Info } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { BrandIcon } from '@/components/branding/BrandLogo'

export function AdminPageHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
        {title}
      </h1>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
    </header>
  )
}

export function AdminStatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: number | string
  hint?: string
}) {
  return (
    <Card className="border border-slate-800/80 bg-slate-950/70 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-50">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </Card>
  )
}

export function AdminStatsGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
  )
}

export function AdminSection({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn(
        'overflow-hidden border border-slate-800/80 bg-slate-950/80 shadow-sm shadow-slate-950/30',
        className,
      )}
    >
      {children}
    </Card>
  )
}

export function AdminTable({
  children,
  minWidth = 'min-w-[860px]',
}: {
  children: ReactNode
  minWidth?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          'w-full divide-y divide-slate-800/80 text-left text-sm',
          minWidth,
        )}
      >
        {children}
      </table>
    </div>
  )
}

export function AdminEmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 border border-slate-800/80 bg-slate-950/70 p-8 text-center">
      <div className="rounded-full border border-slate-800 bg-slate-900 p-3 text-slate-400">
        <BrandIcon theme="dark" alt="" className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-slate-400">{description}</p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </Card>
  )
}

export type AdminAlertSeverity = 'info' | 'success' | 'warning' | 'error'

export type AdminAlertItem = {
  label: string
  description: string
  href?: string
  severity?: AdminAlertSeverity
}

const alertStyles: Record<
  AdminAlertSeverity,
  {
    container: string
    icon: string
    iconNode: ReactNode
    label: string
  }
> = {
  info: {
    container: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
    icon: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    iconNode: <Info className="h-4 w-4" aria-hidden />,
    label: 'Info',
  },
  success: {
    container: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    icon: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    iconNode: <CheckCircle2 className="h-4 w-4" aria-hidden />,
    label: 'Healthy',
  },
  warning: {
    container: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    icon: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    iconNode: <AlertTriangle className="h-4 w-4" aria-hidden />,
    label: 'Attention',
  },
  error: {
    container: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
    icon: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    iconNode: <CircleAlert className="h-4 w-4" aria-hidden />,
    label: 'Error',
  },
}

function alertSeverityRank(severity: AdminAlertSeverity) {
  if (severity === 'error') return 4
  if (severity === 'warning') return 3
  if (severity === 'info') return 2
  return 1
}

function itemTextColor(severity: AdminAlertSeverity) {
  if (severity === 'error') return 'text-rose-200'
  if (severity === 'warning') return 'text-amber-200'
  if (severity === 'success') return 'text-emerald-200'
  return 'text-sky-200'
}

export function AdminAlertSummary({
  severity,
  title,
  description,
  items = [],
}: {
  severity: AdminAlertSeverity
  title: string
  description: string
  items?: AdminAlertItem[]
}) {
  const mostSevere =
    items.reduce<AdminAlertSeverity>((current, item) => {
      const itemSeverity = item.severity ?? severity
      return alertSeverityRank(itemSeverity) > alertSeverityRank(current)
        ? itemSeverity
        : current
    }, severity) ?? severity
  const styles = alertStyles[mostSevere]

  if (items.length === 1 && items[0].href) {
    const item = items[0]
    const href = item.href!
    const itemSeverity = item.severity ?? mostSevere

    return (
      <Link
        href={href}
        className={cn(
          'block rounded-xl border p-4 transition-colors hover:bg-opacity-15',
          styles.container,
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn('rounded-lg border p-2', styles.icon)}>
            {styles.iconNode}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-50">{title}</div>
            <p className="mt-1 text-sm text-slate-300">{description}</p>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/35 px-3 py-2">
              <div
                className={cn(
                  'text-sm font-medium',
                  itemTextColor(itemSeverity),
                )}
              >
                {item.label}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {item.description}
              </p>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className={cn('rounded-xl border p-4', styles.container)}>
      <div className="flex items-start gap-3">
        <div className={cn('rounded-lg border p-2', styles.icon)}>
          {styles.iconNode}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-slate-50">{title}</div>
            <span className="rounded-full border border-white/10 bg-slate-950/35 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
              {items.length ? `${items.length} items` : styles.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-300">{description}</p>

          {items.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer select-none text-xs font-medium text-slate-200">
                View details
              </summary>
              <div className="mt-3 space-y-2">
                {items.map((item) => {
                  const itemSeverity = item.severity ?? severity
                  const content = (
                    <div className="rounded-lg border border-white/10 bg-slate-950/35 px-3 py-2">
                      <div
                        className={cn(
                          'text-sm font-medium',
                          itemTextColor(itemSeverity),
                        )}
                      >
                        {item.label}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  )

                  return item.href ? (
                    <Link key={`${item.label}-${item.href}`} href={item.href}>
                      {content}
                    </Link>
                  ) : (
                    <div key={item.label}>{content}</div>
                  )
                })}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export const adminTableHeaderClass =
  'bg-slate-900/70 text-xs uppercase tracking-wide text-slate-500'

export const adminTableHeadClass = 'px-5 py-3 font-medium'

export const adminTableCellClass = 'px-5 py-4'

export const adminTableRowClass =
  'align-top text-slate-200 transition-colors hover:bg-slate-900/45'
