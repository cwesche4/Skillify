'use client'

import { ChevronDown } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Workspace {
  id: string
  name: string
  slug: string
}

export default function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Workspace | null>(null)

  const pathname = usePathname()
  const router = useRouter()

  // Extract slug from current route
  const match = pathname.match(/^\/dashboard\/([^\/]+)/)
  const currentSlug = match ? match[1] : null

  useEffect(() => {
    fetch('/api/workspaces')
      .then((res) => res.json())
      .then((wsList) => {
        setWorkspaces(wsList)
        const found = wsList.find((ws: Workspace) => ws.slug === currentSlug)
        setActive(found || wsList[0] || null)
      })
  }, [currentSlug])

  // Replace current slug with chosen slug
  const switchWorkspace = (ws: Workspace) => {
    if (!currentSlug) return
    const newPath = pathname.replace(
      `/dashboard/${currentSlug}`,
      `/dashboard/${ws.slug}`,
    )
    router.push(newPath)
    setActive(ws)
    setOpen(false)
  }

  if (!active) {
    return (
      <span className="text-neutral-text-secondary text-xs">No workspace</span>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'workspace-switcher min-w-[180px] justify-between',
          open && 'bg-slate-800',
        )}
      >
        <span className="text-sm font-medium">{active.name}</span>
        <ChevronDown size={16} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              className={cn(
                'flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-800',
                active?.id === ws.id && 'bg-slate-800',
              )}
              onClick={() => switchWorkspace(ws)}
            >
              <span>{ws.name}</span>
              {active?.id === ws.id && (
                <span className="text-xs text-brand-primary">Active</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
