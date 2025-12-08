// app/dashboard/[workspaceSlug]/upsell/build/page.tsx
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { BuildRequestForm } from '@/components/upsell/BuildRequestForm'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface PageProps {
  params: { workspaceSlug: string }
}

export default async function WorkspaceBuildRequestPage({ params }: PageProps) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
  })

  if (!workspace) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge size="xs" variant="blue">
            DFY PRO
          </Badge>
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Done-For-You Build
          </span>
        </div>
        <h1 className="text-lg font-semibold text-slate-50">
          Let us build this workspace for you
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Describe the systems you want fully automated inside{' '}
          <span className="font-medium text-slate-200">{workspace.name}</span>.
          Our team will scope a full build covering leads, bookings, follow-ups,
          and retention.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <BuildRequestForm workspaceId={workspace.id} variant="dashboard" />

        <Card className="space-y-3 border border-slate-800/80 bg-slate-950/80 p-4 text-xs text-slate-300">
          <p className="font-medium text-slate-100">What we typically build</p>
          <ul className="space-y-1.5 text-[11px] text-slate-400">
            <li>• Lead capture + qualification flows</li>
            <li>• Calendar booking + reminder sequences</li>
            <li>• Email/SMS follow-up for no-shows</li>
            <li>• Pipeline sync with CRMs and data warehouses</li>
            <li>• AI-assisted routing, tagging, and summarization</li>
          </ul>
          <div className="h-px bg-gradient-to-r from-slate-900 via-slate-700/60 to-slate-900" />
          <p className="text-[11px] text-slate-500">
            After you submit this form, we&apos;ll reply with scope options,
            timeline, and pricing tailored to this workspace.
          </p>
        </Card>
      </div>
    </div>
  )
}
