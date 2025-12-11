// components/dashboard/SidebarNav.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bot,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  HelpCircle,
  LayoutDashboard,
  Settings,
  Users,
  Workflow,
  Radio,
  Lock,
  Star,
} from 'lucide-react'

import CreateWorkspaceModal from '@/components/workspaces/CreateWorkspaceModal'
import type { SidebarItem } from './sidebar-items'
import { cn } from '@/lib/utils'
import { SidebarTooltip } from '@/components/ui/SidebarTooltip'
import { useSidebarSettings } from '@/components/dashboard/useSidebarSettings'
import type { Plan } from '@/lib/subscriptions/features'
import { planAtLeast } from '@/lib/subscriptions/features'
import { UpsellDFYModal } from '@/components/upsell/UpsellDFYModal'

// ICON SET
const ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  automations: Workflow,
  analytics: BarChart3,
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

// Resolve /dashboard/:workspace/... → /dashboard/{slug}/...
function resolveHref(templateHref: string, workspaceSlug: string): string {
  if (!templateHref.includes(':workspace')) return templateHref
  return templateHref.replace(':workspace', workspaceSlug)
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
  const pathname = usePathname()
  const { compact, toggleCompact, isAutoCompact } = useSidebarSettings()

  const [metrics, setMetrics] = useState<LiveMetrics>({
    successRate: null,
    runsToday: null,
    isLive: false,
  })

  const [upsellOpen, setUpsellOpen] = useState(false)
  const [upsellFeature, setUpsellFeature] = useState<string | null>(null)

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
  const sections = useMemo(
    () =>
      items.reduce<Record<string, SidebarItem[]>>((acc, item) => {
        const key = item.section ?? 'General'
        if (!acc[key]) acc[key] = []
        acc[key].push({
          ...item,
          href: resolveHref(item.href, workspaceSlug),
        })
        return acc
      }, {}),
    [items, workspaceSlug],
  )

  const successRateLabel =
    metrics.successRate != null ? `${Math.round(metrics.successRate)}%` : '—'

  const runsTodayLabel =
    metrics.runsToday != null ? metrics.runsToday.toString() : '—'

  const handleLockedClick = (label: string) => {
    setUpsellFeature(label)
    setUpsellOpen(true)
  }

  return (
    <>
      <aside
        className={cn(
          'bg-neutral-card-dark text-neutral-text-primary flex h-full select-none flex-col border-r border-neutral-border px-3 py-4 transition-all duration-200',
          compact ? 'w-20' : 'w-64',
        )}
      >
        {/* TOP: LOGO + COMPACT TOGGLE */}
        <div className="mb-6 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <div className="bg-brand-primary/15 flex h-8 w-8 items-center justify-center rounded-xl text-sm font-semibold text-brand-primary">
              S
            </div>
            {!compact && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight">
                  Skillify
                </span>
                <span className="text-neutral-text-secondary/70 text-[11px]">
                  Automation HQ
                </span>
              </div>
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
                  // Role-based filtering (layout still passes uppercase roles in `roles` array)
                  if (
                    item.roles &&
                    !item.roles.includes(role.toUpperCase() as any)
                  ) {
                    return null
                  }

                  const Icon = ICONS[item.icon]
                  const active = pathname === item.href

                  // Normalize plan (fixes TS error)
                  const currentPlan: Plan = plan ?? 'Free'

                  const isLocked =
                    item.requiredPlan &&
                    !planAtLeast(currentPlan, item.requiredPlan)

                  const row = (
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
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
                            {isLocked && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                                <Lock className="h-3 w-3" />
                                {item.requiredPlan}
                              </span>
                            )}
                          </span>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  )

                  // If locked, we use a button that opens upsell
                  const inner = isLocked ? (
                    <button
                      type="button"
                      onClick={() => handleLockedClick(item.label)}
                      className="w-full text-left"
                    >
                      {row}
                    </button>
                  ) : (
                    <Link href={item.href}>{row}</Link>
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

        <div className="text-neutral-text-secondary/70 mt-3 flex items-center justify-between px-1 text-[10px]">
          {!compact && <span>© {new Date().getFullYear()} Skillify</span>}
          {compact && (
            <span className="text-[9px] uppercase tracking-[0.16em]">HQ</span>
          )}
          <span className="border-neutral-border/40 rounded-full border px-2 py-0.5 text-[9px]">
            Cmd + K
          </span>
        </div>
      </aside>

      {/* Upsell DFY modal triggered from locked sidebar items */}
      <UpsellDFYModal
        open={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        workspaceId={workspaceSlug}
        feature={upsellFeature ?? 'nav.premium-items'}
      />
    </>
  )
}
