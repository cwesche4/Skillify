'use client'

import type { FC } from 'react'
import type { TemplateCategory } from '@/lib/templates/categories'

// Template marketplace filters.
// Visual discovery only.
// Must not affect execution or permissions.
type Props = {
  categories: TemplateCategory[]
  activeCategory?: TemplateCategory
  onCategoryChange: (c?: TemplateCategory) => void
}

export const TemplateFilters: FC<Props> = ({
  categories,
  activeCategory,
  onCategoryChange,
}) => {
  return (
    <div className="flex gap-2 text-xs text-slate-100">
      <button
        className={`rounded px-2 py-1 ${!activeCategory ? 'bg-slate-800 font-semibold' : ''}`}
        onClick={() => onCategoryChange(undefined)}
        type="button"
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c}
          className={`rounded px-2 py-1 ${
            activeCategory === c
              ? 'bg-emerald-700/30 font-semibold'
              : 'bg-slate-900'
          }`}
          onClick={() => onCategoryChange(c)}
          type="button"
        >
          {c}
        </button>
      ))}
    </div>
  )
}

export default TemplateFilters
