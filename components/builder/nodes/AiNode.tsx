'use client'

import type { FC } from 'react'
import AiPromptEditor from './AiPromptEditor'
import AiIOMap from './AiIOMap'
import AiOutputPorts from './AiOutputPorts'
import type { AiOutputField } from '@/lib/builder/nodes/aiSchema'

type Props = {
  prompt: string
  onPromptChange: (value: string) => void
  inputs: { from: string; to: string }[]
  outputs: AiOutputField[]
}

export const AiNode: FC<Props> = ({
  prompt,
  onPromptChange,
  inputs,
  outputs,
}) => {
  return (
    // AI node ergonomics.
    // Explicit inputs and outputs only.
    // No inference or autonomy.
    <div className="space-y-2 rounded border border-slate-800 bg-slate-950 p-3 text-[12px] text-slate-100">
      <div className="text-sm font-semibold text-slate-100">AI Node</div>

      {/* Prompt configuration */}
      <AiPromptEditor prompt={prompt} onChange={onPromptChange} />

      {/* Explicit input mapping (read-only) */}
      <AiIOMap inputs={inputs} outputs={[]} />

      {/* Explicit, named output ports */}
      <AiOutputPorts outputs={outputs} />

      <p className="text-[10px] text-slate-500">
        This node sends the prompt exactly as written. Outputs are explicit
        fields; no hidden transformations.
      </p>
    </div>
  )
}

export default AiNode
