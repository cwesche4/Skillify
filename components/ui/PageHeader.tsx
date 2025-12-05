// components/ui/PageHeader.tsx
"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="text-neutral-text-primary text-2xl font-semibold sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="text-neutral-text-secondary mt-1 max-w-xl text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
