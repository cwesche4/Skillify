'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { UserButton, SignedIn, SignedOut } from '@clerk/nextjs'

export default function MarketingNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md dark:border-zinc-800/70 dark:bg-black/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* BRAND */}
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Skillify
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-700 dark:text-zinc-300 md:flex">
          <Link href="/marketing/features">Features</Link>
          <Link href="/marketing/solutions">Solutions</Link>
          <Link href="/marketing/pricing">Pricing</Link>
          <Link href="/marketing/resources">Resources</Link>
          <Link href="/marketing/demo">Demo</Link>
        </nav>

        {/* AUTH */}
        <div className="hidden items-center gap-4 md:flex">
          <SignedOut>
            <Link
              href="/sign-in"
              className="text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
            >
              Sign in
            </Link>

            <Link
              href="/sign-up"
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
            >
              Start free
            </Link>
          </SignedOut>

          <SignedIn>
            <Link
              href="/dashboard"
              className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Go to dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>

        {/* MOBILE BUTTON */}
        <button
          onClick={() => setOpen(!open)}
          className="rounded-md p-2 text-zinc-700 dark:text-zinc-300 md:hidden"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {/* MOBILE MENU */}
      {open && (
        <nav className="border-t border-zinc-200 bg-white px-6 py-4 text-sm dark:border-zinc-800 dark:bg-black md:hidden">
          <div className="flex flex-col gap-4">
            <Link href="/marketing/features">Features</Link>
            <Link href="/marketing/solutions">Solutions</Link>
            <Link href="/marketing/pricing">Pricing</Link>
            <Link href="/marketing/resources">Resources</Link>
            <Link href="/marketing/demo">Demo</Link>

            <SignedOut>
              <Link href="/sign-in">Sign in</Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
              >
                Start free
              </Link>
            </SignedOut>

            <SignedIn>
              <Link
                href="/dashboard"
                className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Go to dashboard
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </nav>
      )}
    </header>
  )
}
