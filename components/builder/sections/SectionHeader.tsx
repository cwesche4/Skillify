import type { FC } from 'react'
import { X } from 'lucide-react'

type Props = {
  name: string
  onNameChange: (name: string) => void
  onRemove: () => void
}

export const SectionHeader: FC<Props> = ({ name, onNameChange, onRemove }) => {
  return (
    <div className="pointer-events-auto flex items-center justify-between gap-2 rounded bg-slate-900/80 px-2 py-1 text-xs text-slate-100 shadow">
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="w-full border-none bg-transparent text-xs text-slate-50 outline-none"
        placeholder="Section name"
      />
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
        aria-label="Remove section"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

export default SectionHeader
