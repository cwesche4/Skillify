'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type WorkspaceLite = { id: string; name: string; slug: string }

export default function WorkspaceShell({
  children,
  workspaceSlug,
  workspaces,
  currentWorkspace,
  role,
  plan,
}: {
  children: React.ReactNode
  workspaceSlug: string
  workspaces: WorkspaceLite[]
  currentWorkspace: WorkspaceLite
  role: 'owner' | 'admin' | 'member'
  plan: string
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('skillify.sidebarCollapsed')
    if (saved === '1') setCollapsed(true)
  }, [])

  function toggleSidebar() {
    setCollapsed((v) => {
      const next = !v
      window.localStorage.setItem('skillify.sidebarCollapsed', next ? '1' : '0')
      return next
    })
  }

  const nav = useMemo(
    () => [
      { label: 'Dashboard', href: `/dashboard/${workspaceSlug}` },
      { label: 'Automations', href: `/dashboard/${workspaceSlug}/automations` },
      { label: 'Analytics', href: `/dashboard/${workspaceSlug}/analytics` },
      { label: 'Members', href: `/dashboard/${workspaceSlug}/members` },
      { label: 'AI Coach', href: `/dashboard/${workspaceSlug}/ai` },
      { label: 'Settings', href: `/dashboard/${workspaceSlug}/settings` },
    ],
    [workspaceSlug],
  )

  return (
    <div className="bg-app-background text-app-primary min-h-screen w-full">
      {/* Top bar */}
      <header className="border-app bg-app-surface/80 sticky top-0 z-40 h-14 border-b backdrop-blur">
        <div className="flex h-full items-center justify-between px-4">
          {/* Left */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="bg-app-surface-muted hover:bg-app-surface-hover rounded-md px-2 py-1 text-xs"
            >
              {collapsed ? '→' : '←'}
            </button>

            <div className="min-w-0">
              <BrandLogo
                variant="dashboard"
                alt="Skillify"
                className="h-8 w-20"
              />
              <div className="text-app-muted truncate text-xs">
                {currentWorkspace.name} · {role.toUpperCase()} · {plan}
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <ThemeToggle />

            {/* Profile */}
            <button className="hover:bg-app-surface-hover flex items-center gap-2 rounded-md px-2 py-1">
              <User size={16} />
              <span className="text-xs">Profile</span>
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex w-full">
        {/* Sidebar */}
        <aside
          className={cn(
            'border-app bg-app-surface/75 h-[calc(100vh-56px)] shrink-0 border-r transition-all',
            collapsed ? 'w-16' : 'w-64',
          )}
        >
          <nav className="flex h-full flex-col gap-1 p-3">
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm transition',
                    active
                      ? 'text-app-primary bg-blue-500/10'
                      : 'text-app-secondary hover:bg-app-surface-hover',
                    collapsed && 'px-2 text-center text-xs',
                  )}
                >
                  {collapsed ? item.label[0] : item.label}
                </Link>
              )
            })}

            <div className="mt-auto px-2">
              <BrandLogo
                variant={collapsed ? 'icon' : 'poweredCompact'}
                alt="Powered by Skillify"
                className={
                  collapsed ? 'mx-auto h-8 w-8' : 'h-7 w-28 opacity-70'
                }
              />
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="bg-app-background min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
