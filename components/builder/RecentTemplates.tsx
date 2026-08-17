import type { FC } from 'react'
import type { TemplateMeta } from '@/lib/templates/registry'
import { Badge } from '@/components/ui/Badge'

type Props = {
  templates: TemplateMeta[]
  onSelect: (template: TemplateMeta) => void
}

export const RecentTemplates: FC<Props> = ({ templates, onSelect }) => {
  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Recently used
        </span>
        <Badge size="xs" variant="slate">
          {templates.length}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelect(tpl)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-100 hover:border-slate-500"
            aria-label={`Use template ${tpl.name}`}
          >
            {tpl.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default RecentTemplates
