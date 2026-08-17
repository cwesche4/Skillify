'use client'

import type { FC, KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

type Props = {
  name: string
  secondaryLabel?: string
  onRename: (name: string) => void
}

export const NodeHeader: FC<Props> = ({ name, secondaryLabel, onRename }) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => {
    setDraft(name)
  }, [name])

  const commit = () => {
    onRename(draft.trim() || name)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(name)
    setEditing(false)
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  return (
    <div className="space-y-0.5 text-slate-100">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[13px] font-semibold text-slate-100 outline-none focus:border-slate-500"
        />
      ) : (
        <button
          type="button"
          className="w-full text-left text-[13px] font-semibold text-slate-100 hover:text-slate-50"
          onClick={() => setEditing(true)}
        >
          {name || 'Untitled node'}
        </button>
      )}
      {secondaryLabel ? (
        <div className="text-[11px] text-slate-400">{secondaryLabel}</div>
      ) : null}
    </div>
  )
}

export default NodeHeader
