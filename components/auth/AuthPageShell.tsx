import React, { type ReactNode } from 'react'
import Link from 'next/link'

import { BrandLogo } from '@/components/branding/BrandLogo'
import { SKILLIFY_SHORT_TAGLINE } from '@/lib/branding/brandMessaging'

export function AuthPageShell({
  children,
  mode,
}: {
  children: ReactNode
  mode: 'sign-in' | 'sign-up'
}) {
  const isSignUp = mode === 'sign-up'

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-8 text-white sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.18),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,1))]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent"
      />

      <section className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link
            href="/"
            className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <BrandLogo
              variant="horizontal"
              theme="dark"
              size="lg"
              alt="Skillify"
              className="h-24 w-[22rem]"
            />
          </Link>
        </div>

        <div className="bg-slate-950/78 rounded-2xl border border-white/15 p-5 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl sm:p-6">
          <div className="mb-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              {isSignUp ? 'Create account' : 'Secure access'}
            </p>
            <h1 className="mt-3 font-heading text-2xl font-semibold text-white">
              {isSignUp
                ? 'Create your Skillify account'
                : 'Sign in to Skillify'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {isSignUp
                ? 'Create your account, choose a plan, and set up the workspace your business will run from.'
                : 'Welcome back. Sign in to continue managing your workspace.'}
            </p>
          </div>

          <div className="flex justify-center">{children}</div>

          <div className="mt-5 border-t border-white/10 pt-5 text-center text-sm text-slate-300">
            {isSignUp ? (
              <>
                <span>Already have an account? </span>
                <Link
                  href="/sign-in"
                  className="font-semibold text-cyan-200 underline-offset-4 hover:text-cyan-100 hover:underline focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  Sign in
                </Link>
              </>
            ) : (
              <>
                <span>New to Skillify? </span>
                <Link
                  href="/sign-up"
                  className="font-semibold text-cyan-200 underline-offset-4 hover:text-cyan-100 hover:underline focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  Create an account
                </Link>
              </>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          {SKILLIFY_SHORT_TAGLINE}
        </p>
      </section>
    </main>
  )
}
