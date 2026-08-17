'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { SignedIn, SignedOut } from '@clerk/nextjs'

import { SkillifyUserMenu } from '@/components/auth/SkillifyUserMenu'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { cn } from '@/lib/utils'

const links = [
  { href: '/marketing', label: 'Overview' },
  { href: '/marketing/features', label: 'Features' },
  { href: '/marketing/solutions', label: 'Solutions' },
  { href: '/marketing/pricing', label: 'Pricing' },
  { href: '/marketing/demo', label: 'Demo' },
  { href: '/marketing/blog', label: 'Blog' },
]

export default function MarketingNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    const menuButton = menuButtonRef.current
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    window.requestAnimationFrame(() => closeButtonRef.current?.focus())

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      menuButton?.focus()
    }
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-black/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:py-3">
        <Link href="/" className="flex items-center gap-2">
          <BrandLogo
            variant="horizontal"
            alt="Skillify"
            className="h-12 w-44 sm:h-14 sm:w-52 lg:h-20 lg:w-[17rem] xl:h-24 xl:w-80 2xl:w-[22rem]"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm font-medium text-blue-950/75 dark:text-blue-100/80 md:flex xl:gap-8">
          {links.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== '/marketing' && pathname?.startsWith(link.href))

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative rounded-sm pb-1 transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-blue-600 after:transition-transform hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:after:bg-blue-400 dark:hover:text-blue-300 dark:focus-visible:ring-offset-black',
                  isActive &&
                    'text-blue-700 after:scale-x-100 dark:text-blue-300',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Auth / CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <SignedOut>
            <Link
              href="/sign-in"
              className="rounded-sm text-sm font-medium text-slate-800 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:text-zinc-100 dark:hover:text-blue-300 dark:focus-visible:ring-offset-black"
            >
              Log in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white active:scale-[0.99] dark:ring-offset-black"
            >
              Start 14-day free trial
            </Link>
          </SignedOut>

          <SignedIn>
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:border-blue-300 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-blue-500/50 dark:hover:text-blue-300 dark:focus-visible:ring-offset-black"
            >
              Dashboard
            </Link>
            <SkillifyUserMenu compact />
          </SignedIn>
        </div>

        {/* Mobile toggle */}
        <button
          ref={menuButtonRef}
          onClick={() => setOpen((v) => !v)}
          aria-controls="marketing-mobile-navigation"
          aria-expanded={open}
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          className="rounded-md p-2 text-slate-700 hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-blue-300 dark:focus-visible:ring-offset-black md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-slate-950/35"
            onClick={() => setOpen(false)}
          />
          <aside
            id="marketing-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Marketing navigation menu"
            className="absolute right-0 top-0 flex h-full w-[min(22rem,calc(100vw-1.5rem))] flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-zinc-800 dark:bg-black"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
              <BrandLogo
                variant="horizontal"
                alt="Skillify"
                className="h-12 w-44"
              />
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-slate-700 hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-blue-300 dark:focus-visible:ring-offset-black"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col overflow-y-auto px-5 py-5">
              <div className="flex flex-col gap-1">
                {links.map((link) => {
                  const isActive =
                    pathname === link.href ||
                    (link.href !== '/marketing' &&
                      pathname?.startsWith(link.href))

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'rounded-lg border-l-2 border-transparent px-3 py-2.5 text-sm font-medium text-slate-800 transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-zinc-100 dark:hover:text-blue-300 dark:focus-visible:ring-offset-black',
                        isActive &&
                          'border-blue-600 bg-blue-50/70 text-blue-700 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-300',
                      )}
                    >
                      {link.label}
                    </Link>
                  )
                })}
              </div>

              <div className="my-5 border-t border-slate-200 dark:border-zinc-800" />

              <div className="flex flex-col gap-3">
                <SignedOut>
                  <Link
                    href="/sign-in"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-zinc-100 dark:hover:text-blue-300 dark:focus-visible:ring-offset-black"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/sign-up"
                    onClick={() => setOpen(false)}
                    className="inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white active:scale-[0.99] dark:ring-offset-black"
                  >
                    Start 14-day free trial
                  </Link>
                </SignedOut>

                <SignedIn>
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-slate-300 px-4 py-2.5 text-center text-sm font-medium text-slate-800 hover:border-blue-300 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-blue-500/50 dark:hover:text-blue-300 dark:focus-visible:ring-offset-black"
                  >
                    Dashboard
                  </Link>
                  <div className="flex justify-center pt-1">
                    <SkillifyUserMenu />
                  </div>
                </SignedIn>
              </div>
            </nav>
          </aside>
        </div>
      )}
    </header>
  )
}
