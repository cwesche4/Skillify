'use client'

import React from 'react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Check, ChevronDown, Plus, Settings } from 'lucide-react'

import CreateWorkspaceModal from '@/components/workspaces/CreateWorkspaceModal'
import { cn } from '@/lib/utils'

type Workspace = {
  id: string
  name: string
  slug: string
  plan?: string
  memberRole?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER'
}

export default function WorkspaceSwitcher({
  workspaces,
  current,
  currentSlug,
  plan,
}: {
  workspaces?: Workspace[]
  current?: Workspace | null
  currentSlug?: string
  plan?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const menuRef = useRef<HTMLDivElement | null>(null)
  const switcherButtonRef = useRef<HTMLButtonElement | null>(null)
  const createWorkspaceButtonRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false)
  const [items, setItems] = useState<Workspace[]>(workspaces ?? [])
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(
    null,
  )
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (workspaces) {
      setItems(workspaces)
      return
    }
    fetch('/api/workspaces', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: Workspace[]) => setItems(data))
      .catch(() => setItems([]))
  }, [workspaces])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const urlSlug = useMemo(() => {
    const match = pathname.match(/^\/dashboard\/([^/]+)/)
    return match ? match[1] : null
  }, [pathname])

  const activeSlug = current?.slug ?? currentSlug ?? urlSlug ?? ''
  const activeWorkspace =
    items.find((workspace) => workspace.slug === activeSlug) ||
    current ||
    items[0] ||
    null

  async function switchWorkspace(workspace: Workspace) {
    if (!workspace.slug || workspace.slug === activeSlug) {
      setOpen(false)
      return
    }
    if (pendingWorkspaceId || isPending) return
    setSwitchError(null)
    setPendingWorkspaceId(workspace.id)

    try {
      const response = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || typeof data.redirectTo !== 'string') {
        setSwitchError(
          typeof data.error === 'string'
            ? data.error
            : 'Workspace could not be opened. Please try again.',
        )
        setPendingWorkspaceId(null)
        return
      }

      const currentSegment = urlSlug
      const redirectTo = data.redirectTo as string
      const nextPath = currentSegment
        ? pathname.replace(`/dashboard/${currentSegment}`, redirectTo)
        : redirectTo
      setOpen(false)
      startTransition(() => {
        router.push(nextPath)
        router.refresh()
        setPendingWorkspaceId(null)
      })
    } catch {
      setSwitchError(
        'Workspace could not be opened. Check your connection and try again.',
      )
      setPendingWorkspaceId(null)
    }
  }

  if (!activeWorkspace) {
    return (
      <CreateWorkspaceModal
        triggerLabel="Create Workspace"
        triggerClassName="inline-flex items-center justify-center gap-2 rounded-full border border-app bg-app-surface-muted px-3 py-1.5 text-xs font-medium text-app-primary transition hover:bg-app-surface-hover"
      />
    )
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={switcherButtonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="border-app bg-app-surface-muted text-app-primary hover:bg-app-surface-hover flex max-w-[280px] cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="truncate">{activeWorkspace.name}</span>
        <span className="text-app-muted">
          ({activeWorkspace.memberRole ?? 'MEMBER'})
        </span>
        {isPending ? (
          <span className="border-app-strong h-3 w-3 animate-spin rounded-full border border-t-brand-primary" />
        ) : (
          <ChevronDown className="text-app-secondary h-3.5 w-3.5" />
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="app-popover absolute left-0 z-50 mt-2 w-[340px] overflow-hidden"
        >
          <div className="border-app border-b px-3 py-3">
            <p className="text-app-muted text-xs font-semibold uppercase tracking-[0.16em]">
              Workspaces
            </p>
            {switchError ? (
              <p className="mt-2 rounded-lg border border-rose-300/25 bg-rose-300/[0.08] px-2.5 py-2 text-xs text-rose-100">
                {switchError}
              </p>
            ) : null}
          </div>

          <div className="max-h-72 overflow-auto p-1.5">
            {items.map((workspace) => {
              const active = workspace.slug === activeWorkspace.slug
              return (
                <button
                  key={workspace.id}
                  type="button"
                  role="menuitem"
                  onClick={() => switchWorkspace(workspace)}
                  disabled={Boolean(pendingWorkspaceId) || isPending}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                    active
                      ? 'text-app-primary bg-blue-500/10'
                      : 'text-app-secondary hover:bg-app-surface-hover hover:text-app-primary',
                    (pendingWorkspaceId || isPending) &&
                      'cursor-not-allowed opacity-60',
                  )}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-brand-primary">
                    {pendingWorkspaceId === workspace.id ? (
                      <span className="border-app-strong h-3.5 w-3.5 animate-spin rounded-full border border-t-brand-primary" />
                    ) : active ? (
                      <Check className="h-4 w-4" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {workspace.name}
                    </span>
                    <span className="text-app-muted block truncate text-xs">
                      {workspace.plan ?? (active ? plan : null) ?? 'Free'} Plan
                    </span>
                  </span>
                  {active ? (
                    <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-700 dark:text-cyan-100">
                      Current
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="border-app space-y-1 border-t p-2">
            <button
              ref={createWorkspaceButtonRef}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                setCreateWorkspaceOpen(true)
              }}
              className="border-app bg-app-surface-muted text-app-primary hover:bg-app-surface-hover flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition"
            >
              <Plus className="h-4 w-4" />
              Create Workspace
            </button>
            <Link
              href={`/dashboard/${activeWorkspace.slug}/settings/workspaces`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="text-app-secondary hover:bg-app-surface-hover hover:text-app-primary flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition"
            >
              <Settings className="h-4 w-4" />
              Manage Workspaces
            </Link>
          </div>
        </div>
      ) : null}
      <CreateWorkspaceModal
        hideTrigger
        open={createWorkspaceOpen}
        onOpenChange={setCreateWorkspaceOpen}
        restoreFocusRef={
          createWorkspaceButtonRef.current
            ? createWorkspaceButtonRef
            : switcherButtonRef
        }
        onCreated={() => setOpen(false)}
      />
    </div>
  )
}
