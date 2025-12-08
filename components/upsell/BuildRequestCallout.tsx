'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Hammer, Sparkles } from 'lucide-react'

interface BuildRequestCalloutProps {
  className?: string
  workspaceId?: string
  source?: string // e.g. 'dashboard', 'automations', 'builder'
}

export function BuildRequestCallout({
  className,
  workspaceId,
  source = 'dashboard',
}: BuildRequestCalloutProps) {
  const router = useRouter()

  const handleClick = () => {
    const qs = workspaceId
      ? `?workspaceId=${workspaceId}&source=${source}`
      : `?source=${source}`
    router.push(`/upsell/build${qs}`)
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-amber-500/30 bg-gradient-to-b from-slate-900/70 to-slate-950/80 p-5 shadow-lg shadow-amber-900/20 backdrop-blur-md',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
          <Sparkles className="h-5 w-5 text-amber-300" />
        </div>

        <div className="flex-1 space-y-2">
          <h3 className="text-sm font-semibold text-amber-200">
            Want us to build your entire automation system?
          </h3>
          <p className="text-xs leading-relaxed text-slate-300">
            Our Elite automation engineers can design, build, and deploy your
            full workflow system, integrate your apps, and optimize your
            operations with AI-driven automation.
          </p>

          <Button
            size="sm"
            variant="primary"
            className="mt-2 bg-amber-500 text-black hover:bg-amber-400"
            onClick={handleClick}
          >
            <Hammer className="mr-2 h-4 w-4" />
            Request Full Build
          </Button>
        </div>
      </div>
    </div>
  )
}
