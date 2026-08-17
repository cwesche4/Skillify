'use client'

import type { FC } from 'react'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

type Props = {
  prompt: string
  onChange: (value: string) => void
}

export const AiPromptEditor: FC<Props> = ({ prompt, onChange }) => {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded border border-slate-800 bg-slate-950/80 text-[12px] text-slate-100">
      <button
        type="button"
        className="flex w-full items-center justify-between px-2 py-1 text-left hover:bg-slate-900/80"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-semibold text-slate-200">Prompt</span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="border-t border-slate-800 p-2">
          <textarea
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-100 outline-none focus:border-slate-500"
            rows={4}
            value={prompt}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
          <p className="mt-1 text-[10px] text-slate-500">
            This node sends the prompt exactly as written.
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default AiPromptEditor
