import type { FC } from 'react'
import KillStatusBanner from './KillStatusBanner'
import ApprovalInbox from '@/components/approvals/ApprovalInbox'
import KillSwitch from '@/components/admin/KillSwitch'
import ReenableExecutions from './ReenableExecutions'
import SlaBadge from '@/components/runs/SlaBadge'
import AuditLog from '@/components/audit/AuditLog'
import type { ApprovalRequest } from '@/lib/runs/approvals/types'
import type { SlaBreachEvent } from '@/lib/runs/sla/types'
import type { AuditEvent } from '@/lib/audit/types'

type Props = {
  isAdmin: boolean
  killActive: boolean
  killMessage?: string
  approvals: ApprovalRequest[]
  slaBreaches: SlaBreachEvent[]
  auditEvents: AuditEvent[]
  onKill?: (reason: string) => void
  onReenable?: (reason: string) => void
  onApprove?: (id: string, reason: string) => void
  onReject?: (id: string, reason: string) => void
  onExportAuditJson?: () => void
  onExportAuditCsv?: () => void
}

export const ExecutionControlPlane: FC<Props> = ({
  isAdmin,
  killActive,
  killMessage,
  approvals,
  slaBreaches,
  auditEvents,
  onKill,
  onReenable,
  onApprove,
  onReject,
  onExportAuditJson,
  onExportAuditCsv,
}) => {
  return (
    <div className="space-y-4">
      <section>
        <KillStatusBanner active={killActive} message={killMessage} />
        {killActive ? (
          <div className="mt-2 rounded border border-rose-800 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-200">
            Executions are blocked. This is admin-controlled and audited.
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-100">
          Pending Approvals
        </h3>
        <ApprovalInbox
          requests={approvals}
          onApprove={isAdmin ? onApprove : undefined}
          onReject={isAdmin ? onReject : undefined}
        />
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-100">SLA Signals</h3>
        <SlaBadge breaches={slaBreaches} />
        <div className="text-[11px] text-slate-400">
          Informational only; no execution blocking implied.
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-100">
          Execution Audit
        </h3>
        <AuditLog
          events={auditEvents}
          onExportJson={onExportAuditJson}
          onExportCsv={onExportAuditCsv}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-100">
          Emergency Controls
        </h3>
        {isAdmin ? (
          <div className="space-y-2">
            <KillSwitch onKill={onKill ?? (() => {})} />
            <ReenableExecutions onReenable={onReenable ?? (() => {})} />
          </div>
        ) : (
          <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-[12px] text-slate-300">
            Admin-only controls. Contact a workspace admin to change kill switch
            state.
          </div>
        )}
      </section>
    </div>
  )
}

export default ExecutionControlPlane
