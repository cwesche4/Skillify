import type { FC } from 'react'
import type { TimelineItem } from '@/lib/runs/timeline/types'

type Props = {
  item: TimelineItem
}

const formatDelta = (ms?: number) => {
  if (ms === undefined) return null
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

export const TimelineEventDetail: FC<Props> = ({ item }) => {
  const delta = formatDelta(item.timeDeltaMs)

  return (
    <div className="space-y-1 text-[12px] text-slate-300">
      {item.subtitle ? <div>{item.subtitle}</div> : null}
      {(item.actor || delta) && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
          {item.actor ? <span>Actor: {item.actor}</span> : null}
          {delta ? <span>+{delta} since previous event</span> : null}
        </div>
      )}
      {item.details ? (
        <details className="mt-1 text-[11px] text-slate-400">
          <summary className="cursor-pointer text-slate-300">Details</summary>
          <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-slate-200">
            {JSON.stringify(item.details, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  )
}

export default TimelineEventDetail
