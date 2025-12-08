// app/marketing/resources/page.tsx

import Link from 'next/link'
import { ArrowRight, FileText, Film, Sparkles } from 'lucide-react'

const ARTICLES = [
  {
    title:
      'The Operator’s Guide to Automating Follow-Ups Without Losing Personality',
    tag: 'Playbooks',
    href: '#',
  },
  {
    title: 'How Agencies Use Automation to 3x Client Capacity Without Hiring',
    tag: 'Agencies',
    href: '#',
  },
  {
    title: 'From Spreadsheets to Skillify: Standardizing Client Journeys',
    tag: 'Stories',
    href: '#',
  },
]

const VIDEOS = [
  {
    title: 'Live build: Missed call ➝ SMS ➝ booking link',
    length: '9 min watch',
  },
  {
    title: 'Designing flows with AI Coach: onboarding & retention',
    length: '12 min watch',
  },
]

export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      {/* HEADER */}
      <section className="px-6 pb-10 pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.24em] text-blue-600">
            RESOURCES
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Playbooks, templates, and live builds for automation-first teams.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Learn how operators, agencies, and local brands use Skillify to
            remove manual work — and how to design automations that actually get
            used.
          </p>
        </div>
      </section>

      {/* BODY */}
      <section className="pb-24">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 lg:grid-cols-[1.4fr,1fr]">
          {/* Articles */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-500" />
                <h2 className="text-sm font-semibold">Guides & Articles</h2>
              </div>
              <Link
                href="#"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500"
              >
                View all
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-4">
              {ARTICLES.map((a) => (
                <article
                  key={a.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    {a.tag}
                  </div>
                  <h3 className="text-sm font-semibold">{a.title}</h3>
                  <div className="mt-2 text-xs text-blue-600">
                    <Link
                      href={a.href}
                      className="inline-flex items-center gap-1"
                    >
                      Read article
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Videos / product content */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 flex items-center gap-2">
                <Film className="h-4 w-4 text-zinc-500" />
                <h2 className="text-sm font-semibold">Product deep dives</h2>
              </div>

              <div className="space-y-3 text-xs">
                {VIDEOS.map((v) => (
                  <div
                    key={v.title}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div>
                      <p className="text-xs font-medium text-zinc-800 dark:text-zinc-100">
                        {v.title}
                      </p>
                      <p className="text-[11px] text-zinc-500">{v.length}</p>
                    </div>
                    <button className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-medium text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
                      Watch
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-zinc-300 p-4 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              <Sparkles className="mb-2 h-4 w-4 text-blue-500" />
              <p className="font-medium text-zinc-800 dark:text-zinc-200">
                Want custom playbooks for your business?
              </p>
              <p className="mt-1">
                Elite customers get private Looms, tailored flow diagrams, and
                DFY implementation help from our team.
              </p>
              <Link
                href="/marketing/demo"
                className="mt-3 inline-flex items-center gap-1 text-blue-600 hover:text-blue-500"
              >
                Talk about Elite onboarding
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
