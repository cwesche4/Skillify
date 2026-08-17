'use client'

import React from 'react'
import {
  BriefcaseBusiness,
  KanbanSquare,
  PackageCheck,
  ShoppingCart,
  Users,
  Wrench,
} from 'lucide-react'

import type { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { cn } from '@/lib/utils'

type BusinessModelPreviewProps = {
  model: WorkspaceBusinessModel | string
  selected?: boolean
}

const PREVIEWS = {
  SIMPLE_SERVICE_BUSINESS: {
    label: 'Service business',
    nav: [
      { label: 'Leads', icon: Users },
      { label: 'Customers', icon: Users },
    ],
    panels: ['New inquiries', 'Customer queue', 'Follow-up work'],
  },
  CONSULTATIVE_SALES: {
    label: 'Full sales cycle',
    nav: [
      { label: 'Leads', icon: Users },
      { label: 'Opportunities', icon: BriefcaseBusiness },
      { label: 'Sales Pipeline', icon: KanbanSquare },
      { label: 'Clients', icon: Users },
    ],
    panels: ['Lead intake', 'Opportunity review', 'Proposal pipeline'],
  },
  DIRECT_SALES: {
    label: 'Sales & services',
    nav: [
      { label: 'Leads', icon: Users },
      { label: 'Sales Pipeline', icon: KanbanSquare },
      { label: 'Clients', icon: Users },
    ],
    panels: ['New inquiries', 'Quotes & bookings', 'Client follow-up'],
  },
  PRODUCT_COMMERCE: {
    label: 'Product & commerce',
    nav: [
      { label: 'Customers', icon: Users },
      { label: 'Orders', icon: ShoppingCart },
      { label: 'Fulfillment', icon: PackageCheck },
      { label: 'Support', icon: Wrench },
    ],
    panels: ['Customer activity', 'Order queue', 'Fulfillment status'],
  },
} as const

function getPreview(model: WorkspaceBusinessModel | string) {
  if (model in PREVIEWS) {
    return PREVIEWS[model as keyof typeof PREVIEWS]
  }
  return PREVIEWS.DIRECT_SALES
}

export function BusinessModelPreview({
  model,
  selected,
}: BusinessModelPreviewProps) {
  const preview = getPreview(model)

  return (
    <div
      aria-hidden="true"
      className={cn(
        'overflow-hidden rounded-2xl border bg-slate-950/80 shadow-inner transition',
        selected
          ? 'border-cyan-300/50 shadow-cyan-400/10'
          : 'border-white/10 shadow-black/20',
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.035] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-300/70" />
          <span className="h-2 w-2 rounded-full bg-amber-300/70" />
          <span className="h-2 w-2 rounded-full bg-emerald-300/70" />
        </div>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-medium',
            selected
              ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
              : 'border-white/10 bg-white/[0.04] text-white/55',
          )}
        >
          {preview.label}
        </span>
      </div>

      <div className="grid min-h-[158px] grid-cols-[116px_1fr]">
        <div className="space-y-1 border-r border-white/10 bg-white/[0.025] p-2">
          <div className="mb-2 h-2.5 w-16 rounded-full bg-white/15" />
          {preview.nav.map((item, index) => {
            const Icon = item.icon
            const active = selected || index === 0
            return (
              <div
                key={item.label}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px]',
                  active
                    ? 'bg-cyan-300/10 text-cyan-100'
                    : 'bg-white/[0.025] text-white/50',
                )}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.label}</span>
              </div>
            )
          })}
        </div>

        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <div className="h-2.5 w-24 rounded-full bg-white/15" />
            <div className="h-5 w-16 rounded-full border border-white/10 bg-white/[0.04]" />
          </div>
          <div className="grid gap-2">
            {preview.panels.map((panel, index) => (
              <div
                key={panel}
                className={cn(
                  'rounded-xl border p-2',
                  selected && index === 1
                    ? 'border-cyan-300/35 bg-cyan-300/[0.075]'
                    : 'border-white/10 bg-white/[0.035]',
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="h-2 w-20 rounded-full bg-white/20" />
                  <div className="h-2 w-8 rounded-full bg-white/10" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-1.5 w-full rounded-full bg-white/10" />
                  <div className="h-1.5 w-2/3 rounded-full bg-white/10" />
                </div>
                <span className="sr-only">{panel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
