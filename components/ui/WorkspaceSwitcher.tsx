// components/ui/WorkspaceSwitcher.tsx
'use client'

import { ChevronDown } from 'lucide-react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

interface Workspace {
  id: string
  name: string
  slug: string
}

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Workspace | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/workspaces')
      .then((res) => res.json())
      .then((data) => {
        const list: Workspace[] = data.data || []
        setWorkspaces(list)

        const slugFromUrl = searchParams.get('workspace')
        if (slugFromUrl) {
          const found = list.find((w) => w.slug === slugFromUrl)
          if (found) setActive(found)
        } else if (list[0]) {
          setActive(list[0])
        }
      })
  }, [searchParams])

  const selectWorkspace = (ws: Workspace) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('workspace', ws.slug)

    router.push(`${pathname}?${params.toString()}`)
    setActive(ws)
    setOpen(false)
  }

  if (!active && workspaces.length === 0) {
    return (
      <div className="workspace-switcher">
        <span className="text-neutral-text-secondary text-xs">
          No workspace
        </span>
      </div>
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
        <span className="text-sm font-medium">
          {active ? active.name : 'Select workspace'}
        </span>
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
              onClick={() => selectWorkspace(ws)}
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
