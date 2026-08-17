'use client'

import type { FC } from 'react'
import type { AutomationTemplate } from '@/lib/templates/types'
import type { Node, Edge } from 'reactflow'
import FlowExplainer from './FlowExplainer'
import TemplateExplanation from './TemplateExplanation'

type Props = {
  template?: AutomationTemplate
  onClone?: (template: AutomationTemplate) => void
  readOnly?: boolean
}

export const TemplatePreview: FC<Props> = ({ template, onClone }) => {
  if (!template) {
    return (
      <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-400">
        Select a template to preview.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">
              {template.label} (Read-only)
            </div>
            <div className="text-[11px] text-slate-400">
              {template.category} • v{template.version}
            </div>
          </div>
          {onClone ? (
            <button
              onClick={() => onClone(template)}
              className="rounded border border-emerald-700/60 bg-emerald-950/40 px-2 py-1 text-[11px] text-emerald-100"
            >
              Clone to edit
            </button>
          ) : null}
        </div>
        <div className="mt-2 text-[12px] text-slate-300">
          {template.description}
        </div>
        <div className="mt-2 text-[10px] text-amber-200">
          Read-only preview; no execution until cloned and saved.
        </div>
      </div>

      <TemplateExplanation template={template} />

      <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">
          Flow Preview (Read-only)
        </div>
        <FlowExplainer
          nodes={(template.flow?.nodes as Node[]) || []}
          edges={(template.flow?.edges as Edge[]) || []}
        />
      </div>
    </div>
  )
}

export default TemplatePreview
