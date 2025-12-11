'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type HeatValue = 0 | 1 | 2 | 3 | 4

export function SidebarHeatmapMini({
  workspaceSlug,
}: {
  workspaceSlug: string
}) {
  const [values, setValues] = useState<HeatValue[]>([])

  useEffect(() => {
    if (!workspaceSlug) return
    const url = `/api/analytics/heatmap-mini?workspace=${workspaceSlug}`

    fetch(url)
      .then((r) => r.json())
      .then((d) => setValues(d.values || []))
      .catch(() => setValues([]))
  }, [workspaceSlug])

  const color = (v: HeatValue) => {
    switch (v) {
      case 0:
        return 'bg-neutral-700'
      case 1:
        return 'bg-red-500/40'
      case 2:
        return 'bg-orange-500/40'
      case 3:
        return 'bg-yellow-400/40'
      case 4:
        return 'bg-emerald-400/40'
    }
  }

  return (
    <div className="text-neutral-text-secondary mt-4 rounded-xl border border-neutral-border p-2 text-[10px]">
      <div className="mb-1 font-semibold text-neutral-200">
        Reliability Today
      </div>

      <div className="grid grid-cols-12 gap-0.5">
        {values.map((v, i) => (
          <div key={i} className={cn('h-2 w-full rounded-sm', color(v))} />
        ))}
      </div>

      <div className="mt-1 text-[9px] opacity-60">24h execution stability</div>
    </div>
  )
}
