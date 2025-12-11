'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Helper: Capitalize normal text
function formatSegment(seg: string) {
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function Breadcrumbs({ workspaceName }: { workspaceName?: string }) {
  const pathname = usePathname()

  const segments = pathname.split('/').filter(Boolean)

  // Replace [workspaceSlug] with real workspace name
  const cleanedSegments = segments.map((seg, index) => {
    if (index === 1 && workspaceName) return workspaceName
    return formatSegment(seg)
  })

  const crumbs = cleanedSegments.map((label, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    return { label, href }
  })

  if (crumbs.length <= 1) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden items-center text-xs text-slate-400 sm:flex"
    >
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1

        return (
          <span key={crumb.href} className="flex items-center">
            {idx > 0 && (
              <ChevronRight size={14} className="mx-1 text-slate-500" />
            )}

            {!isLast ? (
              <Link href={crumb.href} className="hover:text-slate-100">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-slate-200">{crumb.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
