'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Hammer, Sparkles } from 'lucide-react'

interface BuildRequestCalloutProps {
  className?: string
  workspaceId?: string
  workspaceSlug?: string
  source?: string // e.g. 'dashboard', 'automations', 'builder'
  disabled?: boolean
  disabledReason?: string
}

export function BuildRequestCallout({
  className,
  workspaceId,
  workspaceSlug,
  source = 'dashboard',
  disabled = false,
  disabledReason,
}: BuildRequestCalloutProps) {
  const router = useRouter()

  const handleClick = () => {
    if (disabled) return
    const qs = workspaceId
      ? `?workspaceId=${workspaceId}&source=${source}`
      : `?source=${source}`
    router.push(
      workspaceSlug
        ? `/dashboard/${workspaceSlug}/build-requests${qs}`
        : `/upsell/build${qs}`,
    )
  }

  return (
    <div
      className={cn(
        'bg-status-warning-surface rounded-xl border border-amber-500/30 p-5 shadow-lg shadow-amber-200/35 backdrop-blur-md dark:bg-gradient-to-b dark:from-slate-900/70 dark:to-slate-950/80 dark:shadow-amber-900/20',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
          <Sparkles className="h-5 w-5 text-amber-700 dark:text-amber-300" />
        </div>

        <div className="flex-1 space-y-2">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Want us to build your entire automation system?
          </h3>
          <p className="text-app-secondary text-xs leading-relaxed dark:text-slate-300">
            Our Elite automation engineers can design, build, and deploy your
            full workflow system, integrate your apps, and optimize your
            operations with AI-driven automation.
          </p>

          {disabled && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-100">
              {disabledReason ?? 'Upgrade your plan to request a full build.'}
            </div>
          )}

          <Button
            size="sm"
            variant="primary"
            className="mt-2 bg-amber-500 text-black hover:bg-amber-400"
            onClick={handleClick}
            disabled={disabled}
          >
            <Hammer className="mr-2 h-4 w-4" />
            Request Full Build
          </Button>
        </div>
      </div>
    </div>
  )
}
