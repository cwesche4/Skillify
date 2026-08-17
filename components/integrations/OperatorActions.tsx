// Operator controls for CRM integrations (client-side wrapper around server actions)
'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/Button'

type ActionFn = (
  integrationId: string,
) => Promise<{ ok: boolean; error?: string }>

interface OperatorActionsProps {
  integrationId: string
  onClearCircuit: ActionFn
  onToggleDisable: ActionFn
  disabled: boolean
  onReplay: ActionFn
}

export function OperatorActions({
  integrationId,
  onClearCircuit,
  onToggleDisable,
  disabled,
  onReplay,
}: OperatorActionsProps) {
  const [pending, startTransition] = useTransition()

  const run = (fn: ActionFn) => {
    startTransition(async () => {
      await fn(integrationId)
    })
  }

  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      <Button
        size="xs"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!confirm('Clear circuit breaker?')) return
          run(onClearCircuit)
        }}
      >
        Clear circuit
      </Button>
      <Button
        size="xs"
        variant={disabled ? 'primary' : 'outline'}
        disabled={pending}
        onClick={() => {
          if (
            !confirm(disabled ? 'Enable integration?' : 'Disable integration?')
          )
            return
          run(onToggleDisable)
        }}
      >
        {disabled ? 'Enable' : 'Disable'}
      </Button>
      <Button
        size="xs"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!confirm('Replay last failed CRM action?')) return
          run(onReplay)
        }}
      >
        Replay last failed action
      </Button>
    </div>
  )
}
