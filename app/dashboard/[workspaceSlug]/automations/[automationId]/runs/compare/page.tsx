'use client'

import Link from 'next/link'
import { useSearchParams, useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface Run {
  id: string
  status: string
  startedAt: string
  finishedAt: string | null
  log: string
}

/* ---------------------------------------------------------
   UTILITIES
--------------------------------------------------------- */

function duration(run: Run | null): number | null {
  if (!run || !run.finishedAt) return null
  const s = new Date(run.startedAt).getTime()
  const e = new Date(run.finishedAt).getTime()
  return Math.round((e - s) / 1000)
}

function diffLogs(logA: string, logB: string) {
  const a = logA.split('\n')
  const b = logB.split('\n')

  const max = Math.max(a.length, b.length)
  const rows: { a?: string; b?: string; changed: boolean }[] = []

  for (let i = 0; i < max; i++) {
    const lineA = a[i] ?? ''
    const lineB = b[i] ?? ''
    rows.push({
      a: lineA,
      b: lineB,
      changed: lineA !== lineB,
    })
  }

  return rows
}

/* ---------------------------------------------------------
   PAGE
--------------------------------------------------------- */

export default function RunComparePage() {
  const search = useSearchParams()
  const params = useParams<{ automationId: string }>()

  const runAId = search.get('a')
  const runBId = search.get('b')

  const [runA, setRunA] = useState<Run | null>(null)
  const [runB, setRunB] = useState<Run | null>(null)
  const [loading, setLoading] = useState(false)

  // Load both runs
  useEffect(() => {
    if (!runAId || !runBId) return
    setLoading(true)

    Promise.all([
      fetch(`/api/runs/${runAId}`).then((r) => r.json()),
      fetch(`/api/runs/${runBId}`).then((r) => r.json()),
    ])
      .then(([aRes, bRes]) => {
        setRunA(aRes.data ?? null)
        setRunB(bRes.data ?? null)
      })
      .finally(() => setLoading(false))
  }, [runAId, runBId])

  const diff = useMemo(() => {
    if (!runA || !runB) return []
    return diffLogs(runA.log, runB.log)
  }, [runA, runB])

  if (!runAId || !runBId) {
    return (
      <div className="page">
        <h1 className="h2 mb-4">Run Comparison</h1>
        <p className="text-sm text-slate-400">Select two runs to compare.</p>
      </div>
    )
  }

  const runsUrl = `/dashboard/automations/${params.automationId}/runs`

  return (
    <div className="page space-y-6">
      {/* Breadcrumb + header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span className="text-slate-500/80">Automation</span>
          <span>/</span>
          <Link
            href={runsUrl}
            className="underline underline-offset-2 hover:text-slate-300"
          >
            Runs
          </Link>
          <span>/</span>
          <span className="text-slate-300">Compare</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <h1 className="h2">Run Comparison</h1>

          <div className="flex items-center gap-2">
            {/* Compare different runs → just go back to runs list */}
            <Link href={runsUrl}>
              <Button size="sm" variant="subtle">
                Compare other runs
              </Button>
            </Link>

            <Link href={runsUrl}>
              <Button size="sm" variant="secondary">
                Back to runs
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {/* Top summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RunSummaryCard title="Run A" run={runA} />
        <RunSummaryCard title="Run B" run={runB} />
      </div>

      {runA && runB && (
        <>
          {/* PERFORMANCE SUMMARY */}
          <div className="card space-y-3 p-4">
            <h2 className="h4 mb-2">Summary Differences</h2>
            <ul className="space-y-1 text-sm text-slate-200">
              <li>
                <span className="font-semibold">Status: </span>
                {runA.status} vs {runB.status}
              </li>
              <li>
                <span className="font-semibold">Duration: </span>
                {duration(runA) ?? 'n/a'}s vs {duration(runB) ?? 'n/a'}s
              </li>
            </ul>

            {/* Duration bar visualization */}
            <DurationBar a={duration(runA)} b={duration(runB)} />
          </div>

          {/* LOG DIFF HEATMAP */}
          <div className="card overflow-hidden p-0">
            <div className="border-b border-slate-800 p-4">
              <h2 className="h4">Log Differences (Heatmap)</h2>
              <p className="text-xs text-slate-400">
                Rows are highlighted where Run A and Run B logs differ.
              </p>
            </div>

            <div className="max-h-[500px] overflow-auto font-mono text-xs">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-900">
                  <tr>
                    <th className="w-1/2 border-r border-slate-800 px-3 py-2 text-left">
                      Run A
                    </th>
                    <th className="w-1/2 px-3 py-2 text-left">Run B</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.map((row, i) => (
                    <tr
                      key={i}
                      className={
                        row.changed ? 'bg-slate-900/40' : 'bg-slate-900/10'
                      }
                    >
                      <td className="whitespace-pre-wrap border-r border-slate-800 px-3 py-1">
                        {row.a}
                      </td>
                      <td className="whitespace-pre-wrap px-3 py-1">{row.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------------------------------------------------
   COMPONENTS
--------------------------------------------------------- */

function RunSummaryCard({ title, run }: { title: string; run: Run | null }) {
  if (!run) {
    return (
      <div className="card p-4">
        <h2 className="h4 mb-1">{title}</h2>
        <p className="text-xs text-slate-400">No data.</p>
      </div>
    )
  }

  return (
    <div className="card space-y-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="h4">{title}</h2>
        <Badge size="sm">{run.status}</Badge>
      </div>

      <p className="text-xs text-slate-400">
        Started: {new Date(run.startedAt).toLocaleString()}
      </p>

      {run.finishedAt && (
        <p className="text-xs text-slate-400">
          Finished: {new Date(run.finishedAt).toLocaleString()}
        </p>
      )}

      <pre className="max-h-40 overflow-auto rounded bg-slate-900/80 p-3 text-[11px] text-slate-300">
        {run.log}
      </pre>
    </div>
  )
}

function DurationBar({ a, b }: { a: number | null; b: number | null }) {
  if (!a || !b) return null

  const max = Math.max(a, b)
  const aPct = (a / max) * 100
  const bPct = (b / max) * 100

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-10 text-slate-400">Run A</span>
        <div className="h-2 flex-1 rounded bg-slate-800">
          <div
            className="h-2 rounded bg-blue-500/70"
            style={{ width: `${aPct}%` }}
          />
        </div>
        <span className="text-slate-400">{a}s</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="w-10 text-slate-400">Run B</span>
        <div className="h-2 flex-1 rounded bg-slate-800">
          <div
            className="h-2 rounded bg-green-500/70"
            style={{ width: `${bPct}%` }}
          />
        </div>
        <span className="text-slate-400">{b}s</span>
      </div>
    </div>
  )
}
