import type { FC } from 'react'
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

type NodeOption = {
  id: string
  label: string
}

type Props = {
  nodes: NodeOption[]
  onSelect: (id: string) => void
}

export const NodeSearch: FC<Props> = ({ nodes, onSelect }) => {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return nodes.filter(
      (n) =>
        n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q),
    )
  }, [nodes, query])

  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100">
      <div className="mb-2 flex items-center gap-2">
        <Search className="h-4 w-4 text-slate-400" aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes..."
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-100 outline-none focus:border-slate-500"
        />
      </div>
      <div className="max-h-48 space-y-1 overflow-y-auto text-[12px] text-slate-200">
        {filtered.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onSelect(n.id)}
            className="flex w-full items-center justify-between rounded border border-slate-800 bg-slate-900 px-2 py-1 text-left hover:border-slate-600"
          >
            <span className="truncate">{n.label}</span>
            <span className="text-[10px] text-slate-500">{n.id}</span>
          </button>
        ))}
        {filtered.length === 0 ? (
          <div className="text-slate-500">No matches</div>
        ) : null}
      </div>
    </div>
  )
}

export default NodeSearch
