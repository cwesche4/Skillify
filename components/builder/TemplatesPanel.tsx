import type { FC } from 'react'
import type { AutomationTemplate } from '@/lib/templates/registry'
import TemplateFilters from './TemplateFilters'
import { useMemo, useState } from 'react'

type Props = {
  templates: AutomationTemplate[]
  onSelect?: (template: AutomationTemplate) => void
  hideFilters?: boolean
}

export const TemplatesPanel: FC<Props> = ({
  templates,
  onSelect,
  hideFilters,
}) => {
  const [filters, setFilters] = useState<{
    category?: any
    complexity?: any
    aiUsage?: any
    search?: string
  }>({
    category: 'all',
    complexity: 'all',
    aiUsage: 'all',
    search: '',
  })

  const filtered = useMemo(() => {
    return templates.filter((tpl) => {
      if (
        filters.category &&
        filters.category !== 'all' &&
        tpl.category !== filters.category
      )
        return false
      if (filters.aiUsage === 'ai-only' && tpl.category !== 'AI') return false
      if (filters.aiUsage === 'no-ai' && tpl.category === 'AI') return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (
          !tpl.label.toLowerCase().includes(q) &&
          !tpl.description.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [templates, filters])

  return (
    <div className="flex flex-col gap-3">
      {!hideFilters ? (
        <TemplateFilters
          category={filters.category}
          complexity={filters.complexity}
          aiUsage={filters.aiUsage}
          search={filters.search}
          onChange={setFilters}
        />
      ) : null}
      {filtered.map((tpl) => (
        <button
          key={tpl.id}
          className="flex flex-col gap-1 rounded border border-slate-800 bg-slate-950 px-3 py-2 text-left text-sm text-slate-100"
          onClick={() => onSelect?.(tpl)}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">{tpl.label}</span>
            <span className="text-[11px] text-slate-400">{tpl.category}</span>
          </div>
          <div className="text-[12px] text-slate-300">{tpl.description}</div>
          <div className="text-[10px] text-slate-500">v{tpl.version}</div>
        </button>
      ))}
      {filtered.length === 0 && (
        <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-400">
          No templates available.
        </div>
      )}
    </div>
  )
}

export default TemplatesPanel
