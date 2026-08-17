import type { FC } from 'react'
import { Clock, CheckCircle, XCircle } from 'lucide-react'
import type { ApprovalRequest } from '@/lib/runs/approvals/types'
import { useState } from 'react'

type Props = {
  requests: ApprovalRequest[]
  onApprove?: (id: string, reason: string) => void
  onReject?: (id: string, reason: string) => void
}

export const ApprovalInbox: FC<Props> = ({ requests, onApprove, onReject }) => {
  const [reasons, setReasons] = useState<Record<string, string>>({})

  return (
    <div className="space-y-3">
      {requests.length === 0 ? (
        <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
          No pending approvals.
        </div>
      ) : (
        requests.map((req) => (
          <div
            key={req.id}
            className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">
                  {req.nodeLabel ?? 'Approval required'}
                </div>
                <div className="text-[11px] text-slate-400">
                  Node: {req.nodeId} • Run: {req.runId}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="h-3 w-3" aria-hidden /> Waiting since{' '}
                {new Date(req.requestedAt).toLocaleString()}
              </div>
            </div>
            <div className="mt-2">
              <label className="text-[11px] text-slate-300">
                Approval reason{' '}
                {req.reasonRequired ? '(required)' : '(optional)'}
              </label>
              <textarea
                className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[12px] text-slate-100"
                rows={2}
                value={reasons[req.id] ?? ''}
                onChange={(e) =>
                  setReasons((prev) => ({ ...prev, [req.id]: e.target.value }))
                }
                placeholder="Enter approval notes"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => {
                  const reason = reasons[req.id] ?? ''
                  if (req.reasonRequired && !reason.trim()) return
                  onApprove?.(req.id, reason)
                }}
                className="flex items-center gap-1 rounded border border-emerald-700/60 bg-emerald-950/40 px-2 py-1 text-[12px] text-emerald-100"
              >
                <CheckCircle className="h-3 w-3" aria-hidden />
                Approve
              </button>
              <button
                onClick={() => {
                  const reason = reasons[req.id] ?? ''
                  if (req.reasonRequired && !reason.trim()) return
                  onReject?.(req.id, reason)
                }}
                className="flex items-center gap-1 rounded border border-rose-700/60 bg-rose-950/40 px-2 py-1 text-[12px] text-rose-100"
              >
                <XCircle className="h-3 w-3" aria-hidden />
                Reject
              </button>
              <div className="text-[10px] text-slate-500">
                No SLA implied; audit records track decisions.
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default ApprovalInbox
