import type { FC } from 'react'
import type { AutomationTemplate } from '@/lib/templates/types'

type Props = {
  template?: AutomationTemplate
}

export const TemplateExplanation: FC<Props> = ({ template }) => {
  if (!template) {
    return (
      <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-400">
        Select a template to view details.
      </div>
    )
  }

  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
      <div className="text-sm font-semibold text-slate-200">
        {template.label} (Read-only)
      </div>
      <div className="text-[12px] text-slate-300">{template.description}</div>
      {template.explanation ? (
        <div className="mt-2 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-200">
          {template.explanation}
        </div>
      ) : null}
      <div className="mt-2 text-[11px] text-slate-400">
        AI usage:{' '}
        {template.category === 'AI' ? 'Yes (see nodes for details)' : 'None'}
      </div>
      <div className="mt-1 text-[11px] text-slate-400">
        Required integrations:{' '}
        {template.requiredIntegrations?.join(', ') || 'None'}
      </div>
      <div className="mt-1 text-[11px] text-slate-400">
        Use cases: {template.useCases?.join(', ') || 'Not specified'}
      </div>
      <div className="mt-1 text-[11px] text-slate-400">
        Limitations/Risks: {template.limitations?.join(', ') || 'None noted'}
      </div>
    </div>
  )
}

export default TemplateExplanation
