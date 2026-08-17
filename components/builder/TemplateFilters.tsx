import type { FC } from 'react'
import type { TemplateCategory } from '@/lib/templates/types'

type Props = {
  category?: TemplateCategory | 'all'
  complexity?: 'all' | 'simple' | 'advanced'
  aiUsage?: 'all' | 'ai-only' | 'no-ai'
  search?: string
  onChange: (next: {
    category?: TemplateCategory | 'all'
    complexity?: 'all' | 'simple' | 'advanced'
    aiUsage?: 'all' | 'ai-only' | 'no-ai'
    search?: string
  }) => void
}

export const TemplateFilters: FC<Props> = ({
  category = 'all',
  complexity = 'all',
  aiUsage = 'all',
  search = '',
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 rounded border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100">
      <input
        type="text"
        value={search}
        onChange={(e) =>
          onChange({ category, complexity, aiUsage, search: e.target.value })
        }
        placeholder="Search templates"
        className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[12px] text-slate-200"
      />
      <div className="grid grid-cols-3 gap-2 text-[12px] text-slate-200">
        <div>
          <div className="text-[11px] text-slate-400">Category</div>
          <select
            className="w-full rounded border border-slate-800 bg-slate-900 px-1 py-1 text-[12px]"
            value={category}
            onChange={(e) =>
              onChange({
                category: e.target.value as TemplateCategory | 'all',
                complexity,
                aiUsage,
                search,
              })
            }
          >
            <option value="all">All</option>
            <option value="AI">AI</option>
            <option value="Integrations">Integrations</option>
            <option value="Logic">Logic</option>
            <option value="Organization">Organization</option>
            <option value="Sales">Sales</option>
            <option value="Ops">Ops</option>
            <option value="Compliance">Compliance</option>
          </select>
        </div>
        <div>
          <div className="text-[11px] text-slate-400">Complexity</div>
          <select
            className="w-full rounded border border-slate-800 bg-slate-900 px-1 py-1 text-[12px]"
            value={complexity}
            onChange={(e) =>
              onChange({
                category,
                complexity: e.target.value as any,
                aiUsage,
                search,
              })
            }
          >
            <option value="all">All</option>
            <option value="simple">Simple</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div>
          <div className="text-[11px] text-slate-400">AI Usage</div>
          <select
            className="w-full rounded border border-slate-800 bg-slate-900 px-1 py-1 text-[12px]"
            value={aiUsage}
            onChange={(e) =>
              onChange({
                category,
                complexity,
                aiUsage: e.target.value as any,
                search,
              })
            }
          >
            <option value="all">All</option>
            <option value="ai-only">AI templates</option>
            <option value="no-ai">No AI</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default TemplateFilters
