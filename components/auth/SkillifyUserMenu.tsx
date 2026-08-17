'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useClerk, useUser } from '@clerk/nextjs'
import { ChevronDown, LogOut, ShieldCheck, UserRound } from 'lucide-react'

import { cn } from '@/lib/utils'

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.length) return 'S'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function SkillifyUserMenu({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  const { signOut } = useClerk()
  const { isLoaded, user } = useUser()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const primaryEmail = user?.primaryEmailAddress?.emailAddress ?? ''
  const displayName =
    user?.fullName || user?.username || primaryEmail || 'Skillify user'
  const secondary = primaryEmail || user?.username || 'Signed in'
  const imageUrl = user?.imageUrl
  const initials = useMemo(() => getInitials(displayName), [displayName])

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!isLoaded) {
    return (
      <div
        aria-label="Loading account"
        className={cn(
          'h-9 w-9 animate-pulse rounded-full border border-white/10 bg-white/10',
          className,
        )}
      />
    )
  }

  if (!user) return null

  const closeMenu = () => setOpen(false)

  return (
    <div ref={menuRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open account menu"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 text-left text-slate-100 transition hover:border-white/20 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
          !compact && 'pr-2.5',
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 text-xs font-semibold text-white">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>
        {!compact ? (
          <>
            <span className="hidden max-w-[9rem] truncate text-xs font-semibold text-slate-100 sm:block">
              {displayName}
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[90] w-72 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 text-slate-100 shadow-2xl shadow-slate-950/60 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 text-sm font-semibold text-white">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-400">{secondary}</p>
            </div>
          </div>

          <div className="p-2">
            <Link
              role="menuitem"
              href="/account/profile"
              onClick={closeMenu}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <UserRound className="h-4 w-4 text-cyan-200" />
              My Profile
            </Link>
            <Link
              role="menuitem"
              href="/account/security"
              onClick={closeMenu}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <ShieldCheck className="h-4 w-4 text-cyan-200" />
              Account &amp; Security
            </Link>
          </div>

          <div className="border-t border-white/10 p-2">
            <button
              role="menuitem"
              type="button"
              onClick={() => void signOut({ redirectUrl: '/' })}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-rose-500/10 hover:text-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
            >
              <LogOut className="h-4 w-4 text-rose-200" />
              Sign Out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
