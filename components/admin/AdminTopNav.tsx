// components/admin/AdminTopNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'

export type WorkspaceRole = 'owner' | 'admin' | 'member'

type AdminWorkspace = {
  id: string
  name: string
  slug: string
}

export interface AdminTopNavProps {
  workspace: AdminWorkspace | null
  role: WorkspaceRole
}

const ADMIN_LINKS = [
  {
    key: 'system',
    label: 'System',
    href: (slug: string) => `/dashboard/${slug}/admin/system`,
  },
  {
    key: 'build-requests',
    label: 'Build Requests',
    href: (slug: string) => `/dashboard/${slug}/admin/build-requests`,
  },
]

export function AdminTopNav({ workspace, role }: AdminTopNavProps) {
  const pathname = usePathname()

  // No workspace or not an admin => hide entirely
  if (!workspace || role === 'member') return null

  const baseAdminPath = `/dashboard/${workspace.slug}/admin`
  const isOnAdminRoute = pathname.startsWith(baseAdminPath)

  return (
    <div className="flex items-center gap-2">
      {isOnAdminRoute && (
        <Badge size="xs" variant="blue" className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          <span>Admin</span>
        </Badge>
      )}

      <nav className="border-neutral-border/60 bg-neutral-card-light/70 dark:bg-neutral-card-dark/70 flex items-center gap-1 rounded-full border px-1 py-0.5 text-xs">
        {ADMIN_LINKS.map((link) => {
          const href = link.href(workspace.slug)
          const active = pathname === href

          return (
            <Link
              key={link.key}
              href={href}
              className={cn(
                'rounded-full px-2.5 py-1 transition-colors',
                active
                  ? 'bg-brand-primary text-white'
                  : 'text-neutral-text-secondary hover:bg-neutral-border/40',
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
