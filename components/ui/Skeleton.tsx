// components/ui/Skeleton.tsx
'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('bg-app-surface-muted animate-pulse rounded-lg', className)}
      {...props}
    />
  )
}
