'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export function ExplainPanel({ runId }: { runId: string }) {
  const [steps, setSteps] = useState<string[]>([])

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/ai/explain/${runId}`)
      const json = await res.json()
      setSteps(json.steps)
    })()
  }, [runId])

  return (
    <div className="bg-neutral-card-dark fixed bottom-4 right-4 z-50 w-[360px] rounded-xl border border-neutral-border p-4 shadow-xl">
      <h3 className="mb-3 text-lg font-semibold">AI Explanation</h3>

      <div className="max-h-80 space-y-3 overflow-y-auto">
        {steps.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-neutral-light/10 rounded-lg p-3 text-sm"
          >
            {s}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
