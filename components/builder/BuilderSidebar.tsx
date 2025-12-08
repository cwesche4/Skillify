'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { BuildRequestCallout } from '@/components/upsell/BuildRequestCallout'
import { Wand2, Boxes } from 'lucide-react'

interface BuilderSidebarProps {
  automationId: string
  workspaceId: string
  className?: string
}

export function BuilderSidebar({
  automationId,
  workspaceId,
  className,
}: BuilderSidebarProps) {
  return (
    <aside
      className={cn(
        'flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-800/80 bg-slate-950/95 p-4',
        className,
      )}
    >
      {/* Section: Navigation */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Builder Tools
        </p>

        <Link
          href="#nodes"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-900"
        >
          <Boxes className="h-4 w-4" />
          Node Palette
        </Link>

        <Link
          href="#ai"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-900"
        >
          <Wand2 className="h-4 w-4" />
          AI Assistance
        </Link>
      </div>

      {/* CTA */}
      <BuildRequestCallout
        workspaceId={workspaceId}
        source="builder"
        className="mt-4"
      />

      {/* Spacer to push content */}
      <div className="flex-1" />
    </aside>
  )
}
