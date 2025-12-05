"use client"

import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"
import type { ReactNode } from "react"

export type DeltaDirection = "up" | "down" | "neutral"

export type StatIntent = "default" | "primary" | "danger" | "muted"

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
    deltaDirection = "neutral",

    // tone overrides intent if provided
    intent = props.tone ?? "default",

    icon,
  } = props

  const base =
    "card card-hover flex flex-col justify-between border transition-all duration-200"

  const intentClasses: Record<StatIntent, string> = {
    default: "border-slate-800 bg-slate-900/40",
    primary:
      "border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_24px_rgba(16,185,129,0.25)]",
    danger: "border-red-500/40 bg-red-500/5 shadow-[0_0_24px_rgba(248,113,113,0.25)]",
    muted: "border-slate-800/60 bg-slate-900/60 opacity-80",
  }

  const deltaIcon =
    deltaDirection === "up" ? (
      <ArrowUpRight className="h-3 w-3 text-emerald-400" />
    ) : deltaDirection === "down" ? (
      <ArrowDownRight className="h-3 w-3 text-red-400" />
    ) : (
      <Minus className="h-3 w-3 text-slate-500" />
    )

  const deltaColor =
    deltaDirection === "up"
      ? "text-emerald-300"
      : deltaDirection === "down"
        ? "text-red-300"
        : "text-slate-400"

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
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/70">
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
