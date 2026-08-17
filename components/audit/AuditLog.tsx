import type { FC } from 'react'
import { DownloadCloud, User } from 'lucide-react'
import type { AuditEvent } from '@/lib/audit/types'

type Props = {
  events: AuditEvent[]
  onExportJson?: () => void
  onExportCsv?: () => void
}

export const AuditLog: FC<Props> = ({ events, onExportJson, onExportCsv }) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-slate-100">
        <span className="font-semibold">
          Execution Audit Ledger (Read-only)
        </span>
        {onExportJson ? (
          <button
            onClick={onExportJson}
            className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
          >
            <DownloadCloud className="h-3 w-3" aria-hidden />
            JSON
          </button>
        ) : null}
        {onExportCsv ? (
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
          >
            <DownloadCloud className="h-3 w-3" aria-hidden />
            CSV
          </button>
        ) : null}
      </div>
      <div className="rounded border border-slate-800 bg-slate-950">
        <table className="min-w-full text-left text-[12px] text-slate-200">
          <thead className="border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Node</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Message</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-slate-800/60">
                <td className="px-3 py-2 text-slate-400">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-semibold text-slate-100">
                  {e.type}
                </td>
                <td className="px-3 py-2 text-slate-300">
                  {e.nodeLabel ?? e.nodeId ?? '—'}
                  {e.nodeType ? (
                    <span className="text-slate-500"> ({e.nodeType})</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-slate-300">
                  {e.actorUserId ? (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3 text-slate-400" aria-hidden />
                      {e.actorUserId}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-slate-200">{e.message ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AuditLog
