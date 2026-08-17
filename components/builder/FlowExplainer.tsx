import type { FC } from 'react'
import type { Node, Edge } from 'reactflow'
import { explainFlow } from '@/lib/ai/assist/explainFlow'

type Props = {
  nodes: Node[]
  edges: Edge[]
}

export const FlowExplainer: FC<Props> = ({ nodes, edges }) => {
  const explanation = explainFlow(nodes, edges)

  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
      <div className="text-sm font-semibold text-slate-200">Flow Explainer</div>
      <div className="text-[12px] text-slate-300">{explanation.summary}</div>

      <div className="mt-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">
          Nodes
        </div>
        <ul className="mt-1 space-y-1 text-[12px] text-slate-200">
          {explanation.nodes.map((n) => (
            <li key={n.id}>
              {n.label ?? n.id} ({n.type}) — {n.role}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">
          Branches
        </div>
        <ul className="mt-1 space-y-1 text-[12px] text-slate-200">
          {explanation.branches.map((b, idx) => (
            <li key={idx}>{b}</li>
          ))}
          {explanation.branches.length === 0 && (
            <li className="text-slate-400">No connections.</li>
          )}
        </ul>
      </div>

      {explanation.risks.length ? (
        <div className="mt-2 rounded border border-amber-800/60 bg-amber-950/30 px-2 py-1 text-[12px] text-amber-100">
          <div className="text-[11px] uppercase tracking-wide text-amber-200">
            Risks (observational)
          </div>
          <ul className="mt-1 space-y-1">
            {explanation.risks.map((r, idx) => (
              <li key={idx}>• {r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-1 text-[10px] text-slate-500">
        Explanation only; no edits or execution.
      </div>
    </div>
  )
}

export default FlowExplainer
