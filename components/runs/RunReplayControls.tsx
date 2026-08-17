import type { FC } from 'react'
import { Pause, Play, Rewind, FastForward } from 'lucide-react'
import type { ReplaySpeed, ReplayState } from '@/lib/runs/replay/types'

type Props = {
  state: ReplayState
  onPlay: () => void
  onPause: () => void
  onStepBack: () => void
  onStepForward: () => void
  onSpeedChange: (speed: ReplaySpeed) => void
}

const speeds: ReplaySpeed[] = ['1x', '2x', 'instant']

export const RunReplayControls: FC<Props> = ({
  state,
  onPlay,
  onPause,
  onStepBack,
  onStepForward,
  onSpeedChange,
}) => {
  return (
    <div className="flex items-center gap-3 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100">
      <button
        type="button"
        onClick={onStepBack}
        className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[12px] text-slate-100 hover:border-slate-500"
      >
        <Rewind className="h-3.5 w-3.5" aria-hidden />
        Prev
      </button>
      {state.isPlaying ? (
        <button
          type="button"
          onClick={onPause}
          className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[12px] text-slate-100 hover:border-slate-500"
        >
          <Pause className="h-3.5 w-3.5" aria-hidden />
          Pause
        </button>
      ) : (
        <button
          type="button"
          onClick={onPlay}
          className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[12px] text-slate-100 hover:border-slate-500"
        >
          <Play className="h-3.5 w-3.5" aria-hidden />
          Play
        </button>
      )}
      <button
        type="button"
        onClick={onStepForward}
        className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[12px] text-slate-100 hover:border-slate-500"
      >
        <FastForward className="h-3.5 w-3.5" aria-hidden />
        Next
      </button>

      <div className="ml-2 flex items-center gap-1 text-[12px] text-slate-300">
        Speed:
        {speeds.map((speed) => (
          <button
            key={speed}
            type="button"
            onClick={() => onSpeedChange(speed)}
            className={`rounded px-2 py-1 ${
              state.speed === speed
                ? 'border border-emerald-500 text-emerald-100'
                : 'border border-slate-700 text-slate-200 hover:border-slate-500'
            }`}
          >
            {speed}
          </button>
        ))}
      </div>
    </div>
  )
}

export default RunReplayControls
