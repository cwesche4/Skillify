'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface BuilderShellProps {
  workspaceId: string
  automationId: string
  children: ReactNode
  className?: string
}

export function BuilderShell({
  workspaceId,
  automationId,
  children,
  className,
}: BuilderShellProps) {
  return (
    <div
      className={cn(
        'flex h-[calc(100vh-64px)] flex-col bg-slate-950',
        className,
      )}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/95 px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/${workspaceId}/automations`}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to automations
          </Link>

          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-100">
              Automation Builder
            </span>
            <span className="text-[10px] text-slate-500">
              Workspace: {workspaceId} · Automation: {automationId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge size="xs" variant="blue">
            Live
          </Badge>
          <Button size="sm" variant="subtle">
            Save
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
