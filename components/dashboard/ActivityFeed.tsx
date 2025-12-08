// components/dashboard/ActivityFeed.tsx

'use client'

import { Zap, AlertTriangle, MessageSquare, Cpu } from 'lucide-react'

export type ActivityKind = 'run' | 'ai' | 'error' | 'billing'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  title: string
  description: string
  timestamp: string
  meta?: string
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="card card-hover">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-neutral-text-primary text-sm font-semibold">
          Recent activity
        </h2>
        <span className="text-neutral-text-secondary text-[11px]">
          Last 24 hours
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-neutral-text-secondary text-sm">
          No recent activity yet. Once automations start running, you’ll see a
          live stream here.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-xl border border-slate-800/70 bg-slate-900/60 px-3 py-2.5"
            >
              <div className="mt-0.5">
                <KindIcon kind={item.kind} />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-neutral-text-primary text-sm font-medium">
                    {item.title}
                  </p>
                  <span className="text-neutral-text-secondary whitespace-nowrap text-[11px]">
                    {item.timestamp}
                  </span>
                </div>
                <p className="text-neutral-text-secondary text-xs">
                  {item.description}
                </p>
                {item.meta && (
                  <p className="text-[11px] text-slate-400">{item.meta}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function KindIcon({ kind }: { kind: ActivityKind }) {
  const base =
    'inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px]'

  switch (kind) {
    case 'run':
      return (
        <span
          className={`${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-300`}
        >
          <Zap className="h-3 w-3" />
        </span>
      )
    case 'ai':
      return (
        <span
          className={`${base} border-indigo-500/40 bg-indigo-500/10 text-indigo-300`}
        >
          <Cpu className="h-3 w-3" />
        </span>
      )
    case 'error':
      return (
        <span
          className={`${base} border-red-500/40 bg-red-500/10 text-red-300`}
        >
          <AlertTriangle className="h-3 w-3" />
        </span>
      )
    case 'billing':
    default:
      return (
        <span
          className={`${base} border-slate-500/40 bg-slate-800 text-slate-200`}
        >
          <MessageSquare className="h-3 w-3" />
        </span>
      )
  }
}
