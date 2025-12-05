// components/dashboard/DashboardShell.tsx
"use client"

import type { ReactNode } from "react"

type DashboardShellProps = {
  children: ReactNode
  /**
   * Optional sidebar item list – currently accepted but not required.
   * You can wire this into a Sidebar component later.
   */
  sidebarItems?: unknown[]
  title?: string
  description?: string
  actions?: ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-neutral-light dark:bg-neutral-dark">
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
