'use client'

import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import type { ReactNode } from 'react'

export type DeltaDirection = 'up' | 'down' | 'neutral'

export type StatIntent = 'default' | 'primary' | 'danger' | 'muted'

export interface StatItem {
  label: string
  value: string | number
  helper?: string

  delta?: string
  deltaDirection?: DeltaDirection

  // NEW — supports your dashboard usage
  tone?: StatIntent

  // original prop (will receive tone if tone provided)
  intent?: StatIntent

  icon?: ReactNode
}

export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <MetricCard key={item.label} {...item} />
      ))}
    </section>
  )
}

export function MetricCard(props: StatItem) {
  const {
    label,
    value,
    helper,
    delta,
    deltaDirection = 'neutral',

    // tone overrides intent if provided
    intent = props.tone ?? 'default',

    icon,
  } = props

  const base =
    'card card-hover flex flex-col justify-between border transition-all duration-200'

  const intentClasses: Record<StatIntent, string> = {
    default: 'border-app bg-app-surface-raised',
    primary:
      'border-emerald-500/35 bg-emerald-500/5 shadow-[0_10px_28px_rgba(16,185,129,0.12)]',
    danger:
      'border-red-500/35 bg-red-500/5 shadow-[0_10px_28px_rgba(248,113,113,0.12)]',
    muted: 'border-app bg-app-surface-muted opacity-90',
  }

  const deltaIcon =
    deltaDirection === 'up' ? (
      <ArrowUpRight className="h-3 w-3 text-emerald-400" />
    ) : deltaDirection === 'down' ? (
      <ArrowDownRight className="h-3 w-3 text-red-400" />
    ) : (
      <Minus className="text-app-muted h-3 w-3" />
    )

  const deltaColor =
    deltaDirection === 'up'
      ? 'text-emerald-300'
      : deltaDirection === 'down'
        ? 'text-red-300'
        : 'text-app-muted'

  return (
    <div className={`${base} ${intentClasses[intent]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-neutral-text-secondary text-[11px] font-medium uppercase tracking-wide">
            {label}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-neutral-text-primary text-2xl font-semibold">
              {value}
            </div>
          </div>
        </div>
        {icon && (
          <div className="border-app bg-app-surface-muted text-app-secondary flex h-8 w-8 items-center justify-center rounded-xl border">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px]">
        {helper && <p className="text-neutral-text-secondary">{helper}</p>}

        {delta && (
          <span className={`inline-flex items-center gap-1 ${deltaColor}`}>
            {deltaIcon}
            <span>{delta}</span>
          </span>
        )}
      </div>
    </div>
  )
}
