// ---------------------------------------------------------------
// FILE: components/builder/Toolbar.tsx
// ---------------------------------------------------------------

'use client'

import React from 'react'
import { Button } from '@/components/ui/Button'
import { useFlowStore } from '@/lib/builder/useFlowStore'

export default function Toolbar() {
  const clearFlow = useFlowStore((s) => s.clear)

  return (
    <div className="flex h-14 items-center gap-2 border-b bg-neutral-light px-4 dark:bg-neutral-dark">
      {/* Reset entire page */}
      <Button
        size="sm"
        onClick={() => {
          if (typeof window !== 'undefined') window.location.reload()
        }}
      >
        Reset
      </Button>

      {/* Clear nodes + edges */}
      <Button size="sm" onClick={clearFlow}>
        Clear
      </Button>
    </div>
  )
}
