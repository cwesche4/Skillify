'use client'

import React from 'react'
import { CheckCircle2 } from 'lucide-react'

import CreateWorkspaceModal from '@/components/workspaces/CreateWorkspaceModal'

const FIRST_WORKSPACE_BENEFITS = [
  'Organize leads and customers',
  'Schedule and manage work',
  'Automate repetitive tasks',
  'See what needs attention',
]

export function CreateFirstWorkspaceClient() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-slate-950 px-6 py-10 text-white sm:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_8%,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_82%_2%,rgba(99,102,241,0.15),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,1))]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent"
      />
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-7rem)] max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/75">
            Workspace setup
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Create your first workspace
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-400 sm:text-base">
            Set up the business, client, brand, or organization you want
            Skillify to run.
          </p>
          <ul className="mt-6 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            {FIRST_WORKSPACE_BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-200" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <CreateWorkspaceModal
              triggerLabel="Create Workspace"
              triggerClassName="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-100/70 bg-cyan-50 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/15 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            />
          </div>
        </section>

        <div
          className="relative hidden lg:block"
          aria-label="Generic Skillify product preview"
          data-testid="first-workspace-product-preview"
        >
          <div className="absolute -inset-6 rounded-[2rem] bg-cyan-300/10 blur-3xl" />
          <div className="border-white/12 bg-slate-950/82 relative overflow-hidden rounded-3xl border shadow-2xl shadow-black/45 backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
              <div className="bg-white/12 ml-4 h-2 w-32 rounded-full" />
            </div>

            <div className="grid min-h-[430px] grid-cols-[150px_minmax(0,1fr)]">
              <aside className="border-r border-white/10 bg-white/[0.025] p-4">
                <div className="h-7 w-24 rounded-lg bg-cyan-200/20" />
                <div className="mt-7 space-y-3">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2"
                      aria-hidden="true"
                    >
                      <span className="bg-white/8 h-6 w-6 rounded-lg" />
                      <span className="h-2 flex-1 rounded-full bg-white/10" />
                    </div>
                  ))}
                </div>
              </aside>

              <main className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="h-3 w-24 rounded-full bg-cyan-200/25" />
                    <div className="bg-white/14 mt-3 h-7 w-56 rounded-xl" />
                    <div className="bg-white/8 mt-3 h-2 w-72 rounded-full" />
                  </div>
                  <div className="h-9 w-28 rounded-xl bg-cyan-200/20" />
                </div>

                <div className="mt-7 grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
                    >
                      <div className="bg-white/12 h-2 w-16 rounded-full" />
                      <div className="bg-white/16 mt-4 h-7 w-20 rounded-xl" />
                      <div className="bg-cyan-200/16 mt-3 h-2 w-full rounded-full" />
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-[minmax(0,1fr)_180px] gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="bg-white/14 h-3 w-28 rounded-full" />
                    <div className="from-cyan-200/18 to-indigo-300/8 mt-5 h-32 rounded-2xl bg-gradient-to-b" />
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-2 rounded-full bg-white/10"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                      >
                        <div className="bg-white/14 h-2 w-20 rounded-full" />
                        <div className="bg-white/8 mt-3 h-2 w-full rounded-full" />
                        <div className="bg-white/8 mt-2 h-2 w-2/3 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
