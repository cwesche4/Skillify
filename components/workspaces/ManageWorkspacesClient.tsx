'use client'

import React from 'react'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Archive,
  CreditCard,
  ExternalLink,
  MoreHorizontal,
  RotateCcw,
  Settings,
  Trash2,
  Type,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import CreateWorkspaceModal from '@/components/workspaces/CreateWorkspaceModal'
import { DeleteWorkspaceDialog } from '@/components/workspaces/DeleteWorkspaceDialog'
import { getWorkspaceBusinessModelDefinition } from '@/lib/workspaces/businessModelRegistry'
import { cn } from '@/lib/utils'

type ManagedWorkspace = {
  id: string
  name: string
  slug: string
  businessModel?: string | null
  plan?: string | null
  renewalDate?: string | Date | null
  ownerName?: string | null
  membersCount: number
  createdAt: string | Date
  archivedAt?: string | Date | null
  memberRole: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER'
}

function formatDate(value?: string | Date | null) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function ManageWorkspacesClient({
  workspaces,
  currentSlug,
}: {
  workspaces: ManagedWorkspace[]
  currentSlug: string
}) {
  const router = useRouter()
  const [items, setItems] = useState(workspaces)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ManagedWorkspace | null>(
    null,
  )
  const [archiveTarget, setArchiveTarget] = useState<{
    workspace: ManagedWorkspace
    mode: 'archive' | 'restore'
  } | null>(null)
  const [renameTarget, setRenameTarget] = useState<ManagedWorkspace | null>(
    null,
  )
  const [notice, setNotice] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  const activeWorkspaces = useMemo(
    () => items.filter((workspace) => !workspace.archivedAt),
    [items],
  )
  const hasOnlyOne = activeWorkspaces.length <= 1

  async function updateWorkspace(
    workspaceId: string,
    body: Record<string, unknown>,
  ) {
    setPendingId(workspaceId)
    const response = await fetch(`/api/workspaces/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      setPendingId(null)
      setNotice({
        type: 'error',
        message: 'Could not update workspace. No local changes were applied.',
      })
      return null
    }
    const data = await response.json()
    setItems((current) =>
      current.map((workspace) =>
        workspace.id === workspaceId
          ? { ...workspace, ...data.workspace }
          : workspace,
      ),
    )
    setPendingId(null)
    router.refresh()
    return data as {
      workspace: ManagedWorkspace
      redirectTo?: string | null
    }
  }

  async function renameWorkspace(workspace: ManagedWorkspace) {
    setRenameTarget(workspace)
  }

  function openArchiveDialog(
    workspace: ManagedWorkspace,
    mode: 'archive' | 'restore',
  ) {
    setArchiveTarget({ workspace, mode })
  }

  async function openWorkspace(workspace: ManagedWorkspace) {
    if (pendingId || isPending || workspace.archivedAt) return
    setPendingId(workspace.id)
    setNotice(null)

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
        setNotice({
          type: 'error',
          message:
            typeof data.error === 'string'
              ? data.error
              : 'Workspace could not be opened. Please try again.',
        })
        setPendingId(null)
        return
      }

      startTransition(() => {
        router.push(data.redirectTo)
        setPendingId(null)
      })
    } catch {
      setNotice({
        type: 'error',
        message:
          'Workspace could not be opened. Check your connection and try again.',
      })
      setPendingId(null)
    }
  }

  function closeMenu() {
    setMenuOpenId(null)
  }

  function navigateTo(path: string) {
    closeMenu()
    startTransition(() => {
      router.push(path)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-100">
            Manage Workspaces
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-sm">
            Each workspace is isolated for a separate business, company, client,
            or organization.
          </p>
        </div>
        <CreateWorkspaceModal />
      </div>

      {hasOnlyOne ? (
        <Card className="border-cyan-300/20 bg-cyan-300/[0.045] p-5">
          <p className="text-sm font-semibold text-cyan-100">
            Add another workspace when you are ready.
          </p>
          <p className="text-neutral-text-secondary mt-1 text-sm">
            Use separate workspaces for separate businesses, client accounts,
            testing environments, or development sandboxes.
          </p>
        </Card>
      ) : null}

      {notice ? (
        <div
          className={cn(
            'flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm',
            notice.type === 'success'
              ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100'
              : 'border-rose-300/25 bg-rose-300/[0.08] text-rose-100',
          )}
          role={notice.type === 'error' ? 'alert' : 'status'}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setNotice(null)}
            className="text-current/70 rounded-lg p-1 hover:bg-white/10 hover:text-current"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="space-y-6">
        {[
          { title: 'Active Workspaces', items: activeWorkspaces },
          {
            title: 'Archived Workspaces',
            items: items.filter((workspace) => workspace.archivedAt),
          },
        ].map((group) =>
          group.items.length ? (
            <section key={group.title} className="space-y-3">
              <h3 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.12em]">
                {group.title}
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.items.map((workspace) => {
                  const current = workspace.slug === currentSlug
                  const model = getWorkspaceBusinessModelDefinition(
                    workspace.businessModel,
                  )
                  const disabled = pendingId === workspace.id || isPending
                  return (
                    <Card
                      key={workspace.id}
                      className={`space-y-4 p-5 ${
                        workspace.archivedAt ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold text-neutral-100">
                              {workspace.name}
                            </h3>
                            {current ? (
                              <Badge variant="green">Current</Badge>
                            ) : null}
                            {workspace.archivedAt ? (
                              <Badge variant="orange">Archived</Badge>
                            ) : null}
                          </div>
                          <p className="text-neutral-text-secondary mt-1 text-xs">
                            {workspace.slug}
                          </p>
                        </div>
                        <WorkspaceActionsMenu
                          workspace={workspace}
                          disabled={disabled}
                          open={menuOpenId === workspace.id}
                          onOpenChange={(nextOpen) =>
                            setMenuOpenId(nextOpen ? workspace.id : null)
                          }
                          onRename={() => {
                            closeMenu()
                            renameWorkspace(workspace)
                          }}
                          onAIConfiguration={() =>
                            navigateTo(
                              `/dashboard/${workspace.slug}/settings#ai-configuration`,
                            )
                          }
                          onBilling={() =>
                            navigateTo(`/dashboard/${workspace.slug}/billing`)
                          }
                          onArchive={() => {
                            closeMenu()
                            openArchiveDialog(
                              workspace,
                              workspace.archivedAt ? 'restore' : 'archive',
                            )
                          }}
                          onDelete={() => {
                            closeMenu()
                            setDeleteTarget(workspace)
                          }}
                        />
                      </div>

                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <Info label="Business Model" value={model.name} />
                        <Info
                          label="Current Plan"
                          value={workspace.plan ?? 'Free'}
                        />
                        <Info
                          label="Owner"
                          value={workspace.ownerName ?? 'Owner'}
                        />
                        <Info
                          label="Members"
                          value={String(workspace.membersCount)}
                        />
                        <Info
                          label="Created"
                          value={formatDate(workspace.createdAt)}
                        />
                        <Info
                          label={
                            workspace.archivedAt ? 'Archived' : 'Next renewal'
                          }
                          value={formatDate(
                            workspace.archivedAt ?? workspace.renewalDate,
                          )}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/70 pt-4">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openWorkspace(workspace)}
                          disabled={disabled || Boolean(workspace.archivedAt)}
                          leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
                        >
                          Open Workspace
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          ) : null,
        )}
      </div>

      {renameTarget ? (
        <RenameWorkspaceDialog
          workspace={renameTarget}
          onOpenChange={(open) => {
            if (!open) setRenameTarget(null)
          }}
          onSave={async (name) => {
            const data = await updateWorkspace(renameTarget.id, { name })
            if (!data) return
            setNotice({
              type: 'success',
              message: `${data.workspace.name} was renamed.`,
            })
            setRenameTarget(null)
          }}
        />
      ) : null}

      {archiveTarget ? (
        <ArchiveWorkspaceDialog
          workspace={archiveTarget.workspace}
          mode={archiveTarget.mode}
          currentSlug={currentSlug}
          pending={pendingId === archiveTarget.workspace.id}
          onOpenChange={(open) => {
            if (!open) setArchiveTarget(null)
          }}
          onConfirm={async () => {
            const { workspace, mode } = archiveTarget
            const data = await updateWorkspace(workspace.id, {
              action: mode === 'archive' ? 'archive' : 'restore',
            })
            if (!data) return
            const archived = mode === 'archive'
            setNotice({
              type: 'success',
              message: archived
                ? `${data.workspace.name} was archived.`
                : `${data.workspace.name} was restored.`,
            })
            setArchiveTarget(null)
            if (archived && workspace.slug === currentSlug && data.redirectTo) {
              startTransition(() => {
                router.push(data.redirectTo as string)
              })
            }
          }}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteWorkspaceDialog
          open={Boolean(deleteTarget)}
          workspaceId={deleteTarget.id}
          workspaceName={deleteTarget.name}
          workspaceSlug={deleteTarget.slug}
          currentWorkspaceSlug={currentSlug}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          onDeleted={(workspaceId) =>
            setItems((current) =>
              current.filter((workspace) => workspace.id !== workspaceId),
            )
          }
        />
      ) : null}

      <div className="text-neutral-text-secondary text-xs">
        Billing actions are prepared for workspace-level subscriptions. Upgrade
        opens billing once connected.
      </div>
      <Link
        href={`/dashboard/${currentSlug}/settings`}
        className="inline-flex text-sm font-medium text-cyan-200 hover:text-cyan-100"
      >
        Back to Settings
      </Link>
    </div>
  )
}

function WorkspaceActionsMenu({
  workspace,
  disabled,
  open,
  onOpenChange,
  onRename,
  onAIConfiguration,
  onBilling,
  onArchive,
  onDelete,
}: {
  workspace: ManagedWorkspace
  disabled: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onRename: () => void
  onAIConfiguration: () => void
  onBilling: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const canManage =
    workspace.memberRole === 'OWNER' || workspace.memberRole === 'ADMIN'
  const canDelete = workspace.memberRole === 'OWNER'

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        onOpenChange(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onOpenChange, open])

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Workspace actions for ${workspace.name}`}
        onClick={() => onOpenChange(!open)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/70 text-white/60 transition hover:bg-slate-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 py-1 text-sm shadow-2xl shadow-black/50"
        >
          {canManage ? (
            <MenuButton icon={<Type className="h-4 w-4" />} onClick={onRename}>
              Rename
            </MenuButton>
          ) : null}
          <MenuButton
            icon={<Settings className="h-4 w-4" />}
            onClick={onAIConfiguration}
          >
            AI Configuration
          </MenuButton>
          <MenuButton
            icon={<CreditCard className="h-4 w-4" />}
            onClick={onBilling}
          >
            Billing or Upgrade
          </MenuButton>
          {canManage ? (
            <MenuButton
              icon={
                workspace.archivedAt ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <Archive className="h-4 w-4" />
                )
              }
              onClick={onArchive}
            >
              {workspace.archivedAt ? 'Unarchive' : 'Archive'}
            </MenuButton>
          ) : null}
          {canDelete ? (
            <>
              <div className="my-1 border-t border-slate-800" />
              <MenuButton
                destructive
                icon={<Trash2 className="h-4 w-4" />}
                onClick={onDelete}
              >
                Delete
              </MenuButton>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function RenameWorkspaceDialog({
  workspace,
  onOpenChange,
  onSave,
}: {
  workspace: ManagedWorkspace
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => Promise<void>
}) {
  const [name, setName] = useState(workspace.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      setError('Workspace name is required.')
      return
    }
    if (nextName === workspace.name) {
      onOpenChange(false)
      return
    }
    setSaving(true)
    setError(null)
    await onSave(nextName)
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-workspace-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070A12] p-5 text-white shadow-2xl shadow-black/60"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="rename-workspace-title" className="text-lg font-semibold">
              Rename workspace
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-sm leading-6">
              Update the display name for this workspace. Routes and stored data
              are unchanged.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close rename workspace dialog"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/65 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="mt-4 block space-y-1 text-sm">
          <span className="font-medium text-white/85">Workspace name</span>
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            className="h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/20"
            aria-invalid={Boolean(error)}
          />
        </label>
        {error ? (
          <p className="mt-2 text-sm text-rose-200" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            Save name
          </Button>
        </div>
      </form>
    </div>
  )
}

function ArchiveWorkspaceDialog({
  workspace,
  mode,
  currentSlug,
  pending,
  onOpenChange,
  onConfirm,
}: {
  workspace: ManagedWorkspace
  mode: 'archive' | 'restore'
  currentSlug: string
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}) {
  const isArchive = mode === 'archive'
  const current = workspace.slug === currentSlug

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-workspace-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
    >
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#070A12] p-5 text-white shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/70">
              Workspace lifecycle
            </p>
            <h2
              id="archive-workspace-title"
              className="mt-1 text-lg font-semibold"
            >
              {isArchive
                ? `Archive ${workspace.name}?`
                : `Unarchive ${workspace.name}?`}
            </h2>
            <p className="text-neutral-text-secondary mt-2 text-sm leading-6">
              {isArchive
                ? 'Archived workspaces are hidden from normal switching and cannot be opened until restored. Workspace data is preserved.'
                : 'Restoring this workspace makes it available in the workspace switcher and normal navigation again.'}
            </p>
            {isArchive && current ? (
              <p className="mt-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-sm text-cyan-100">
                Because this is your current workspace, Skillify will move you
                to another active workspace or workspace setup after archiving.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close workspace lifecycle dialog"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/65 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isArchive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            disabled={pending}
          >
            {isArchive ? 'Archive workspace' : 'Unarchive workspace'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function MenuButton({
  children,
  icon,
  destructive = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  destructive?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-slate-900 focus:bg-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45',
        destructive ? 'text-rose-300 hover:text-rose-200' : 'text-neutral-200',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-neutral-text-secondary text-xs">{label}</p>
      <p className="mt-0.5 font-medium text-neutral-100">{value}</p>
    </div>
  )
}
