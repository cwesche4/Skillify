import type { FC } from 'react'
import { useState } from 'react'
import RunActionButton from './RunActionButton'

type Props = {
  onRun: () => void
  onStop?: () => void
  onRetry?: () => void
  canStop?: boolean
  canRetry?: boolean
  automationLabel: string
}

export const RuntimeControlBar: FC<Props> = ({
  onRun,
  onStop,
  onRetry,
  canStop = false,
  canRetry = false,
  automationLabel,
}) => {
  const [confirming, setConfirming] = useState<'stop' | 'retry' | null>(null)

  const handleStop = () => {
    if (!onStop) return
    if (confirming === 'stop') {
      setConfirming(null)
      onStop()
    } else {
      setConfirming('stop')
      setTimeout(() => setConfirming(null), 2000)
    }
  }

  const handleRetry = () => {
    if (!onRetry) return
    if (confirming === 'retry') {
      setConfirming(null)
      onRetry()
    } else {
      setConfirming('retry')
      setTimeout(() => setConfirming(null), 2000)
    }
  }

  return (
    <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-100">
      <div className="flex flex-col">
        <span className="font-semibold">Runtime controls</span>
        <span className="text-[11px] text-slate-400">
          Actions apply to the currently selected automation: {automationLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <RunActionButton label="Run" onClick={onRun} />
        {onStop ? (
          <RunActionButton
            label={confirming === 'stop' ? 'Click again to stop' : 'Stop'}
            onClick={handleStop}
            disabled={!canStop}
            destructive
            confirming={confirming === 'stop'}
          />
        ) : null}
        {onRetry ? (
          <RunActionButton
            label={
              confirming === 'retry' ? 'Click again to retry' : 'Retry last run'
            }
            onClick={handleRetry}
            disabled={!canRetry}
            destructive
            confirming={confirming === 'retry'}
          />
        ) : null}
      </div>
    </div>
  )
}

export default RuntimeControlBar
