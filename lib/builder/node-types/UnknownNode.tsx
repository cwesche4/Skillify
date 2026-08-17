'use client'

import type { NodeProps } from 'reactflow'

import NodeBase from './NodeBase'
import { formatSchemaStub } from '../devSchemaDiagnostics'

export default function UnknownNode({ id, data }: NodeProps) {
  const label = (data as any)?.label || 'Unknown node'
  const nodeType = (data as any)?.type || (data as any)?.nodeType || 'unknown'

  const handleCopyStub = () => {
    const stub = formatSchemaStub(String(nodeType))
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(stub)
    } else if (typeof document !== 'undefined') {
      const el = document.createElement('textarea')
      el.value = stub
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
  }

  return (
    <NodeBase
      title={label}
      category={`Type: ${nodeType}`}
      iconKey="workflow"
      tone="logic"
    >
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-200">
        <div>
          Unknown node type. This node is experimental or missing a renderer.
        </div>
        <div className="mt-1 text-amber-100">ID: {id}</div>
        <button
          type="button"
          onClick={handleCopyStub}
          className="mt-2 inline-flex items-center rounded-md border border-amber-500/50 px-2 py-1 text-[10px] font-semibold text-amber-100 hover:bg-amber-500/10"
        >
          Copy schema stub
        </button>
      </div>
    </NodeBase>
  )
}
