// components/dashboard/ChartCard.tsx
'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface ChartCardProps {
  title: string
  description?: string
  children: React.ReactNode
  rightSlot?: React.ReactNode
  className?: string
}

export function ChartCard({
  title,
  description,
  children,
  rightSlot,
  className,
}: ChartCardProps) {
  return (
    <Card className={cn('card-analytics', className)}>
      <CardHeader className="mb-4 flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && (
            <p className="text-neutral-text-secondary mt-1 text-xs">
              {description}
            </p>
          )}
        </div>
        {rightSlot && (
          <div className="flex items-center gap-2">{rightSlot}</div>
        )}
      </CardHeader>

      <CardContent>
        <div className="flex h-72 items-center justify-center rounded-xl border border-slate-800/80 bg-slate-950">
          {/* Chart content or skeleton */}
          {children}
        </div>
      </CardContent>
    </Card>
  )
}
