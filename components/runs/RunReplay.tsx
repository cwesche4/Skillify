import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipForward, Zap } from 'lucide-react'
import type { TimelineItem } from '@/lib/runs/timeline/types'
import { createReplayController } from '@/lib/runs/replay/controller'
import type { ReplaySpeed, ReplayState } from '@/lib/runs/replay/types'

type Props = {
  items: TimelineItem[]
  onHighlight?: (item: TimelineItem, idx: number) => void
}

export function RunReplay({ items, onHighlight }: Props) {
  const controllerRef = useRef<ReturnType<
    typeof createReplayController
  > | null>(null)
  const [state, setState] = useState<ReplayState>({
    isPlaying: false,
    currentIndex: 0,
    speed: '1x',
  })

  useEffect(() => {
    controllerRef.current = createReplayController(items, {
      onUpdate: (s) => setState(s),
      onHighlight,
    })
    return () => controllerRef.current?.dispose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const play = () => controllerRef.current?.play()
  const pause = () => controllerRef.current?.pause()
  const setSpeed = (speed: ReplaySpeed) =>
    controllerRef.current?.setSpeed(speed)
  const step = () =>
    controllerRef.current?.jumpTo(
      Math.min(state.currentIndex + 1, items.length - 1),
    )

  const current = items[state.currentIndex]

  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-100">
            Replay — no execution
          </div>
          <div className="text-[11px] text-slate-400">
            Step-through visualization of recorded events
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={state.isPlaying ? pause : play}
            className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
          >
            {state.isPlaying ? (
              <span className="flex items-center gap-1">
                <Pause className="h-3 w-3" aria-hidden /> Pause
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Play className="h-3 w-3" aria-hidden /> Play
              </span>
            )}
          </button>
          <button
            onClick={step}
            className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
          >
            <span className="flex items-center gap-1">
              <SkipForward className="h-3 w-3" aria-hidden /> Step
            </span>
          </button>
          <div className="flex items-center gap-1 text-[11px] text-slate-300">
            Speed:
            {(['1x', '2x', 'instant'] as ReplaySpeed[]).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded px-2 py-1 ${
                  state.speed === s
                    ? 'bg-slate-800 text-emerald-200'
                    : 'bg-slate-900 text-slate-300'
                }`}
              >
                {s === 'instant' ? (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" aria-hidden /> Instant
                  </span>
                ) : (
                  s
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 rounded border border-slate-800 bg-slate-900 px-2 py-2 text-[12px] text-slate-200">
        {current ? (
          <>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{current.title}</span>
              <span className="text-[11px] text-slate-400">
                {new Date(current.timestamp).toLocaleString()}
              </span>
            </div>
            {current.subtitle ? (
              <div className="text-slate-300">{current.subtitle}</div>
            ) : null}
            {current.details ? (
              <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-slate-200">
                {JSON.stringify(current.details, null, 2)}
              </pre>
            ) : null}
          </>
        ) : (
          <div className="text-slate-400">No events to replay.</div>
        )}
      </div>
    </div>
  )
}

export default RunReplay
