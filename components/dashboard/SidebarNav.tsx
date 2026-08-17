// components/dashboard/SidebarNav.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  FileBarChart,
  HelpCircle,
  History,
  LayoutDashboard,
  Layers,
  ListChecks,
  Settings,
  Users,
  Workflow,
  Radio,
  Lock,
  Star,
  UserPlus,
  BadgeDollarSign,
  KanbanSquare,
  ClipboardList,
  CalendarDays,
} from 'lucide-react'

import CreateWorkspaceModal from '@/components/workspaces/CreateWorkspaceModal'
import type { SidebarItem } from './sidebar-items'
import { cn } from '@/lib/utils'
import { SidebarTooltip } from '@/components/ui/SidebarTooltip'
import { useSidebarSettings } from '@/components/dashboard/useSidebarSettings'
import type { Plan } from '@/lib/subscriptions/features'
import { planAtLeast } from '@/lib/subscriptions/features'
import OnboardingTasks from '@/components/onboarding/OnboardingTasks'
import { BrandLogo } from '@/components/branding/BrandLogo'

// ICON SET
const ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  leads: UserPlus,
  opportunities: BadgeDollarSign,
  salesPipeline: KanbanSquare,
  automations: Workflow,
  executions: History,
  templates: Layers,
  analytics: BarChart3,
  reports: FileBarChart,
  clients: BriefcaseBusiness,
  tasks: ListChecks,
  serviceRequests: ClipboardList,
  scheduling: CalendarDays,
  settings: Settings,
  team: Users,
  billing: CreditCard,
  ai: Bot,
  help: HelpCircle,
}

export type SidebarRole = 'owner' | 'admin' | 'member'

export interface SidebarNavProps {
  items: SidebarItem[]
  role?: SidebarRole
  workspaceSlug: string
  plan?: Plan | null
}

type LiveMetrics = {
  successRate: number | null
  runsToday: number | null
  isLive: boolean
}

export function SidebarNav({
  items,
  role = 'member',
  workspaceSlug,
  plan = 'Free',
}: SidebarNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { compact, toggleCompact, isAutoCompact } = useSidebarSettings()

  const [metrics, setMetrics] = useState<LiveMetrics>({
    successRate: null,
    runsToday: null,
    isLive: false,
  })

  // --- Live SSE metrics hook ---
  useEffect(() => {
    if (!workspaceSlug) return

    const url = `/api/analytics/live?workspaceSlug=${encodeURIComponent(
      workspaceSlug,
    )}`

    let es: EventSource | null = null

    try {
      es = new EventSource(url)

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as {
            successRate?: number
            runsToday?: number
          }

          setMetrics((prev) => ({
            successRate:
              typeof data.successRate === 'number'
                ? data.successRate
                : prev.successRate,
            runsToday:
              typeof data.runsToday === 'number'
                ? data.runsToday
                : prev.runsToday,
            isLive: true,
          }))
        } catch {
          // ignore parse errors
        }
      }

      es.onerror = () => {
        setMetrics((prev) => ({
          ...prev,
          isLive: false,
        }))
        es?.close()
      }
    } catch {
      // silently fail; sidebar still works without metrics
    }

    return () => {
      es?.close()
    }
  }, [workspaceSlug])

  // Group items by section & resolve hrefs
  const sections = useMemo(() => {
    const grouped = items.reduce<Record<string, SidebarItem[]>>((acc, item) => {
      if (item.roles && !item.roles.includes(role.toUpperCase() as any)) {
        return acc
      }
      const key = item.section ?? 'General'
      if (!acc[key]) acc[key] = []
      let href = item.href
      if (href.includes(':workspace')) {
        href = href.replace(':workspace', workspaceSlug)
      }
      if (!href.startsWith('/dashboard/')) {
        href = `/dashboard/${workspaceSlug}${href.startsWith('/') ? href : `/${href}`}`
      }
      acc[key].push({ ...item, href })
      return acc
    }, {})

    return Object.fromEntries(
      Object.entries(grouped).filter(
        ([, sectionItems]) => sectionItems.length > 0,
      ),
    )
  }, [items, role, workspaceSlug])

  const successRateLabel =
    metrics.successRate != null ? `${Math.round(metrics.successRate)}%` : '—'

  const runsTodayLabel =
    metrics.runsToday != null ? metrics.runsToday.toString() : '—'

  return (
    <>
      <aside
        className={cn(
          'bg-neutral-card-dark text-neutral-text-primary flex h-full select-none flex-col border-r border-neutral-border px-3 py-4 transition-all duration-200',
          compact ? 'w-20' : 'w-64',
        )}
      >
        {/* TOP: LOGO + COMPACT TOGGLE */}
        <div
          className={cn(
            'mb-6 flex items-center gap-3 px-1',
            compact ? 'flex-col justify-center' : 'justify-between',
          )}
        >
          <div
            className={cn(
              'flex items-center justify-start rounded-lg px-1.5 py-1',
              compact ? 'justify-center' : 'gap-2.5',
            )}
          >
            {compact ? (
              <BrandLogo variant="icon" alt="Skillify" className="h-7 w-7" />
            ) : (
              <>
                <BrandLogo variant="icon" alt="Skillify" className="h-7 w-7" />
                <span className="translate-y-px font-heading text-[23px] font-semibold leading-none tracking-normal text-white">
                  Skillify
                </span>
              </>
            )}
          </div>

          {/* Compact toggle */}
          <button
            type="button"
            onClick={toggleCompact}
            className={cn(
              'border-neutral-border/70 text-neutral-text-secondary/80 hover:border-brand-primary/60 inline-flex h-7 w-7 items-center justify-center rounded-full border transition hover:text-brand-primary',
              isAutoCompact && 'border-dashed',
            )}
            title="Toggle compact sidebar"
          >
            {compact ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          </button>
        </div>

        {/* NAVIGATION SECTIONS */}
        <nav className="flex-1 space-y-6 overflow-y-auto pr-1">
          <div className="mb-3">
            <OnboardingTasks workspaceSlug={workspaceSlug} />
          </div>
          {Object.entries(sections).map(([section, sectionItems]) => (
            <div key={section}>
              {/* SECTION LABEL */}
              {!compact && (
                <div className="text-neutral-text-secondary/70 mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                  {section}
                </div>
              )}

              {/* SECTION ITEMS */}
              <div className="space-y-1">
                {sectionItems.map((item) => {
                  const Icon = ICONS[item.icon]
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`)

                  // Normalize plan (fixes TS error)
                  const currentPlan: Plan = plan ?? 'Free'

                  const isLocked =
                    item.requiredPlan &&
                    !planAtLeast(currentPlan, item.requiredPlan)
                  const lockBadge = isLocked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                      <Lock className="h-3 w-3" />
                      {item.requiredPlan}
                    </span>
                  ) : null

                  const inner = (
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      title={
                        isLocked
                          ? `Requires ${item.requiredPlan} plan`
                          : item.label
                      }
                      onClick={(e) => {
                        // Belt-and-suspenders: ensure navigation always fires even if Link is interrupted.
                        e.preventDefault()
                        router.push(item.href)
                      }}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                        active && !isLocked
                          ? 'bg-brand-primary/18 border-brand-primary/50 border text-brand-primary shadow-[0_0_0_1px_rgba(37,99,235,0.35)]'
                          : 'hover:bg-neutral-card-light/8 text-neutral-text-secondary',
                        compact && 'justify-center px-2',
                        isLocked &&
                          'border border-dashed border-amber-500/40 bg-amber-500/5 text-amber-200/90',
                      )}
                    >
                      <Icon size={18} className="shrink-0" />
                      {!compact && (
                        <span className="flex items-center gap-1">
                          {item.label}
                          {lockBadge}
                        </span>
                      )}
                    </Link>
                  )

                  return (
                    <div key={item.href}>
                      {compact ? (
                        <SidebarTooltip
                          label={item.label}
                          section={item.section}
                        >
                          {inner}
                        </SidebarTooltip>
                      ) : (
                        inner
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* LIVE METRICS */}
        <div
          className={cn(
            'border-neutral-border/70 from-neutral-card-dark/60 to-neutral-card-dark/20 text-neutral-text-secondary mt-4 rounded-xl border bg-gradient-to-br p-3 text-[11px]',
            compact && 'px-2 py-2',
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            {!compact && (
              <span className="text-xs font-semibold text-neutral-100">
                Live Automation Health
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <Radio
                className={cn(
                  'h-2.5 w-2.5',
                  metrics.isLive && 'animate-pulse-fast',
                )}
              />
              {metrics.isLive ? 'LIVE' : 'Idle'}
            </span>
          </div>

          <div className={cn('flex gap-2', compact && 'flex-col')}>
            <div className="flex-1 rounded-lg bg-black/15 px-2 py-1.5">
              <div className="text-neutral-text-secondary/80 text-[10px]">
                Success rate
              </div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-sm font-semibold text-emerald-400">
                  {successRateLabel}
                </span>
                {!compact && (
                  <span className="text-neutral-text-secondary/70 text-[10px]">
                    last 24h
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 rounded-lg bg-black/15 px-2 py-1.5">
              <div className="text-neutral-text-secondary/80 text-[10px]">
                Runs today
              </div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-sm font-semibold text-sky-400">
                  {runsTodayLabel}
                </span>
                {!compact && (
                  <span className="text-neutral-text-secondary/70 text-[10px]">
                    executions
                  </span>
                )}
              </div>
            </div>
          </div>

          {!compact && (
            <div className="text-neutral-text-secondary/70 mt-2 text-[10px]">
              Streamed from your workspace in real-time. Keep an eye on
              anomalies without leaving the builder.
            </div>
          )}
        </div>

        {/* NEW WORKSPACE + FOOTER */}
        <div className="border-neutral-border/70 mt-4 border-t pt-3">
          <CreateWorkspaceModal />
        </div>

        <div
          className={cn(
            'text-neutral-text-secondary/70 mt-6 flex items-center justify-between gap-2 px-1 text-[10px]',
            compact && 'flex-col justify-center',
          )}
        >
          {!compact && (
            <p className="px-1 text-center text-[10px] font-medium text-neutral-400/60">
              Powered by Skillify
            </p>
          )}
          {compact && (
            <BrandLogo
              variant="icon"
              alt="Skillify"
              className="h-3.5 w-3.5 opacity-50"
            />
          )}
          <span className="border-neutral-border/40 rounded-full border px-2 py-0.5 text-[9px]">
            Cmd + K
          </span>
        </div>
      </aside>
    </>
  )
}
