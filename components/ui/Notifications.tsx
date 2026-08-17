'use client'

import {
  Archive,
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Filter,
  MailOpen,
  X,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

type NotificationStatusFilter = 'active' | 'unread' | 'read' | 'archived'

type NotificationItem = {
  id: string
  title: string
  body: string
  category?: string
  priority?: string
  actionUrl?: string | null
  readAt?: string | null
  archivedAt?: string | null
  createdAt: string
  metadata?: Record<string, unknown> | null
}

const categoryLabels: Record<string, string> = {
  assignment: 'Assignments',
  reassignment: 'Reassignments',
  rescheduled: 'Reschedules',
  canceled: 'Cancellations',
  completed: 'Completions',
  missed: 'Missed',
  reminder: 'Reminders',
  conflict: 'Conflicts',
  recurringSeriesChanged: 'Recurring changes',
  recurringSeriesCanceled: 'Recurring cancellations',
}

function relativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.max(1, Math.round(diffMs / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function formatCategory(value?: string) {
  if (!value) return 'Scheduling'
  return (
    categoryLabels[value] ??
    value
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (letter) => letter.toUpperCase())
  )
}

function getScopeLabel(item: NotificationItem) {
  const metadata = item.metadata ?? {}
  const scope = metadata.scopeSummary
  if (typeof scope === 'string' && scope.trim()) return scope
  if (metadata.occurrenceId) return 'This occurrence'
  if (metadata.seriesId) return 'Entire series'
  return null
}

export function Notifications({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState<NotificationItem | null>(null)
  const [statusFilter, setStatusFilter] =
    useState<NotificationStatusFilter>('active')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const loadNotifications = useCallback(
    async ({
      cursor,
      append = false,
    }: { cursor?: string | null; append?: boolean } = {}) => {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)
      try {
        const params = new URLSearchParams({
          limit: '10',
          status: statusFilter,
        })
        if (categoryFilter) params.set('category', categoryFilter)
        if (cursor) params.set('cursor', cursor)
        const listResponse = await fetch(
          `/api/workspaces/${workspaceId}/notifications?${params.toString()}`,
        )
        if (!listResponse.ok) throw new Error('Unable to load notifications.')
        const list = await listResponse.json()
        setItems((current) =>
          append
            ? [...current, ...(list.notifications ?? [])]
            : (list.notifications ?? []),
        )
        setNextCursor(list.nextCursor ?? null)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load notifications.',
        )
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [categoryFilter, statusFilter, workspaceId],
  )

  const refreshUnreadCount = useCallback(async () => {
    try {
      const countResponse = await fetch(
        `/api/workspaces/${workspaceId}/notifications/unread-count`,
      )
      if (!countResponse.ok) return
      const unread = await countResponse.json()
      setCount(unread.count ?? 0)
    } catch {
      setCount(0)
    }
  }, [workspaceId])

  const refresh = useCallback(async () => {
    await Promise.all([loadNotifications(), refreshUnreadCount()])
  }, [loadNotifications, refreshUnreadCount])

  useEffect(() => {
    refresh()
    const interval = window.setInterval(refreshUnreadCount, 60_000)
    return () => window.clearInterval(interval)
  }, [refresh, refreshUnreadCount])

  useEffect(() => {
    if (!open) return
    void loadNotifications()
  }, [categoryFilter, loadNotifications, open, statusFilter])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setDetails(null)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setDetails(null)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  async function updateNotification(
    notificationId: string,
    action: 'read' | 'unread' | 'archive',
  ) {
    await fetch(
      `/api/workspaces/${workspaceId}/notifications/${notificationId}/${action}`,
      { method: 'POST' },
    )
    await refresh()
  }

  async function markAllRead() {
    await fetch(`/api/workspaces/${workspaceId}/notifications/read-all`, {
      method: 'POST',
    })
    await refresh()
  }

  async function archiveAll() {
    await fetch(`/api/workspaces/${workspaceId}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archiveAll' }),
    })
    await refresh()
  }

  async function openDetails(item: NotificationItem) {
    setDetails(item)
    if (!item.readAt) {
      await updateNotification(item.id, 'read')
    }
  }

  function openActionUrl(item: NotificationItem) {
    if (item.actionUrl) window.location.assign(item.actionUrl)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
        aria-label={count ? `${count} unread notifications` : 'Notifications'}
        onClick={() => {
          setOpen((current) => !current)
          if (!open) void refresh()
        }}
      >
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-cyan-400 px-1 text-center text-[10px] font-semibold leading-4 text-slate-950">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-[100] mt-2 w-[min(92vw,28rem)] overflow-hidden rounded-xl border border-white/10 bg-[#070A12] shadow-2xl shadow-black/40">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-3 py-3">
            <div>
              <div className="text-sm font-semibold text-white">
                Notifications
              </div>
              <div className="text-xs text-white/45">
                Scheduling updates and reminders
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={markAllRead}
                className="rounded-md p-2 text-cyan-200 hover:bg-white/10"
                aria-label="Mark all notifications read"
                title="Mark all read"
              >
                <CheckCheck className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={archiveAll}
                className="rounded-md p-2 text-white/55 hover:bg-white/10 hover:text-white"
                aria-label="Archive all notifications"
                title="Archive all"
              >
                <Archive className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-white/10 p-3">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as NotificationStatusFilter,
                  )
                }
                className="rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs text-white"
                aria-label="Notification status filter"
              >
                <option value="active">Active</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
                <option value="archived">Archived</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs text-white"
                aria-label="Scheduling category filter"
              >
                <option value="">All categories</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {details ? (
            <NotificationDetails
              item={details}
              onClose={() => setDetails(null)}
              onAction={() => openActionUrl(details)}
              onMarkUnread={() => updateNotification(details.id, 'unread')}
              onArchive={() => updateNotification(details.id, 'archive')}
            />
          ) : (
            <div className="max-h-[28rem] overflow-y-auto p-2">
              {loading ? (
                <div className="px-3 py-8 text-center text-sm text-white/50">
                  Loading notifications...
                </div>
              ) : error ? (
                <div className="px-3 py-8 text-center text-sm text-rose-200">
                  {error}
                </div>
              ) : items.length ? (
                <>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <NotificationRow
                        key={item.id}
                        item={item}
                        onOpen={() => void openDetails(item)}
                        onRead={() => updateNotification(item.id, 'read')}
                        onUnread={() => updateNotification(item.id, 'unread')}
                        onArchive={() => updateNotification(item.id, 'archive')}
                      />
                    ))}
                  </div>
                  {nextCursor ? (
                    <button
                      type="button"
                      className="mt-2 w-full rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/10"
                      disabled={loadingMore}
                      onClick={() =>
                        loadNotifications({ cursor: nextCursor, append: true })
                      }
                    >
                      {loadingMore ? 'Loading...' : 'Load more'}
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="px-3 py-10 text-center">
                  <p className="text-sm font-medium text-white">
                    No notifications found.
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    Scheduling notifications will appear here when they match
                    these filters.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function NotificationRow({
  item,
  onOpen,
  onRead,
  onUnread,
  onArchive,
}: {
  item: NotificationItem
  onOpen: () => void
  onRead: () => void
  onUnread: () => void
  onArchive: () => void
}) {
  return (
    <div className="group rounded-lg border border-transparent bg-white/[0.03] p-3 hover:border-white/10 hover:bg-white/[0.06]">
      <button type="button" className="block w-full text-left" onClick={onOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-white">
                {item.title}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/55">
                {formatCategory(item.category)}
              </span>
            </div>
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-white/60">
              {item.body}
            </div>
          </div>
          {!item.readAt ? (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/35">
          <span>{relativeTime(item.createdAt)}</span>
          {getScopeLabel(item) ? <span>{getScopeLabel(item)}</span> : null}
          <span>{item.priority ?? 'normal'}</span>
        </div>
      </button>
      <div className="mt-2 flex justify-end gap-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          className="rounded-md p-1 text-white/45 hover:bg-white/10 hover:text-white"
          aria-label={
            item.readAt ? 'Mark notification unread' : 'Mark notification read'
          }
          onClick={item.readAt ? onUnread : onRead}
        >
          {item.readAt ? (
            <MailOpen className="h-3.5 w-3.5" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          className="rounded-md p-1 text-white/45 hover:bg-white/10 hover:text-white"
          aria-label="Archive notification"
          onClick={onArchive}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function NotificationDetails({
  item,
  onClose,
  onAction,
  onMarkUnread,
  onArchive,
}: {
  item: NotificationItem
  onClose: () => void
  onAction: () => void
  onMarkUnread: () => void
  onArchive: () => void
}) {
  const metadata = item.metadata ?? {}
  const relatedRows: Array<[string, string]> = [
    ['Category', formatCategory(item.category)],
    ['Priority', item.priority ?? 'normal'],
    ['Time', new Date(item.createdAt).toLocaleString()],
    ['Related event', String(metadata.eventTitle ?? metadata.eventId ?? '')],
    ['Occurrence', String(metadata.occurrenceId ?? '')],
    ['Series', String(metadata.seriesId ?? '')],
    ['Scope', getScopeLabel(item) ?? ''],
    ['Delivery', item.readAt ? 'In-app read' : 'In-app delivered'],
  ].filter((row): row is [string, string] => Boolean(row[1]))

  return (
    <div className="max-h-[32rem] overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
            Notification details
          </p>
          <h3 className="mt-2 text-base font-semibold text-white">
            {item.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="Close notification details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-4 text-sm leading-6 text-white/70">{item.body}</p>
      <div className="mt-4 divide-y divide-white/10 rounded-xl border border-white/10">
        {relatedRows.map(([label, value]) => (
          <div
            key={String(label)}
            className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[8rem_minmax(0,1fr)]"
          >
            <span className="text-white/40">{label}</span>
            <span className="break-words text-white/75">{String(value)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onMarkUnread}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
        >
          Mark unread
        </button>
        <button
          type="button"
          onClick={onArchive}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
        >
          Archive
        </button>
        {item.actionUrl ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-200"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open related record
          </button>
        ) : null}
      </div>
    </div>
  )
}
