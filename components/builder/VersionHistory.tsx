import type { FC } from 'react'
import { Clock, Star, Tag } from 'lucide-react'

type VersionItem = {
  id: string
  createdAt: string
  createdBy?: string
  tag?: string
  note?: string
  isActive?: boolean
}

type Props = {
  versions: VersionItem[]
  onSelect?: (id: string) => void
}

export const VersionHistory: FC<Props> = ({ versions, onSelect }) => {
  return (
    <div className="flex flex-col gap-3">
      {versions.map((v) => (
        <button
          key={v.id}
          className={`flex items-center justify-between rounded border px-3 py-2 text-left text-sm ${
            v.isActive
              ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-100'
              : 'border-slate-800 bg-slate-950 text-slate-100'
          }`}
          onClick={() => onSelect?.(v.id)}
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-[12px] font-semibold">
              {v.tag ? (
                <span className="flex items-center gap-1 text-emerald-200">
                  <Tag className="h-3 w-3" aria-hidden />
                  {v.tag}
                </span>
              ) : (
                <span className="text-slate-300">Version</span>
              )}
              {v.isActive ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Star className="h-3 w-3" aria-hidden />
                  Current
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Clock className="h-3 w-3" aria-hidden />
              <span>{new Date(v.createdAt).toLocaleString()}</span>
              {v.createdBy ? <span>• {v.createdBy}</span> : null}
            </div>
            {v.note ? (
              <div className="text-[11px] text-slate-300">{v.note}</div>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  )
}

export default VersionHistory
