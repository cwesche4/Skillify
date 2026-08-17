import Link from 'next/link'
import { ArrowRight, Boxes, CheckCircle2 } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

export type CommerceFoundationPageProps = {
  workspaceSlug: string
  title: string
  description: string
  status: string
  futureItems: string[]
  emptyTitle: string
  emptyDescription: string
}

export function CommerceFoundationPage({
  workspaceSlug,
  title,
  description,
  status,
  futureItems,
  emptyTitle,
  emptyDescription,
}: CommerceFoundationPageProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
            Product & Commerce
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-100">
            {title}
          </h1>
          <p className="text-neutral-text-secondary mt-2 max-w-3xl text-sm leading-6">
            {description}
          </p>
        </div>
        <Badge variant="blue">{status}</Badge>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] p-2 text-cyan-100">
                <Boxes className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-neutral-100">
                  {emptyTitle}
                </h2>
                <p className="text-neutral-text-secondary mt-1 text-sm leading-6">
                  {emptyDescription}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4">
              <p className="text-sm font-medium text-neutral-100">
                Foundation page
              </p>
              <p className="text-neutral-text-secondary mt-1 text-sm leading-6">
                This area is enabled for the workspace, but full record creation
                and operational workflows are scheduled for a later Phase 5
                milestone.
              </p>
            </div>
          </div>

          <div className="w-full rounded-xl border border-slate-800 bg-slate-950/45 p-4 lg:w-80">
            <h3 className="text-sm font-semibold text-neutral-100">
              Future content
            </h3>
            <ul className="mt-3 space-y-2">
              {futureItems.map((item) => (
                <li
                  key={item}
                  className="text-neutral-text-secondary flex items-start gap-2 text-sm"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200/70" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/dashboard/${workspaceSlug}`}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white"
        >
          Back to Dashboard
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
