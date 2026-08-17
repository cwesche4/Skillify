'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const ADMIN_LINKS = [
  { label: 'Users', href: '/dashboard/admin/users' },
  { label: 'Service Requests', href: '/dashboard/admin/upsells' },
  { label: 'Build Requests', href: '/dashboard/admin/build-requests' },
  { label: 'Enterprise', href: '/dashboard/admin/enterprise' },
  { label: 'System', href: '/dashboard/admin/system' },
  { label: 'AI Playground', href: '/dashboard/admin/ai-playground' },
]

export function GlobalAdminNav() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Badge size="xs" variant="purple">
          Global Admin
        </Badge>
        <span className="text-sm text-slate-400">System-wide controls</span>
        <ThemeToggle />
      </div>

      <nav className="flex flex-wrap justify-end gap-1.5 rounded-lg border border-slate-800 bg-slate-900/55 p-1 text-sm">
        {ADMIN_LINKS.map((link) => {
          const isActive =
            pathname === link.href || pathname?.startsWith(`${link.href}/`)

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-md border px-3 py-1.5 transition-colors',
                isActive
                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-100 shadow-sm shadow-sky-950/30'
                  : 'border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/70 hover:text-slate-50',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
