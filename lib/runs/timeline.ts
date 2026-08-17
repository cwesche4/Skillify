import type { RunTimelineData, RunSegment } from './types'

export function getActiveSegment(
  runs: RunTimelineData[],
  currentTime: number,
): RunSegment | null {
  for (const run of runs) {
    const seg = run.segments.find(
      (s) => currentTime >= s.start && currentTime <= s.end,
    )
    if (seg) return seg
  }
  return null
}

export function totalDuration(runs: RunTimelineData[]): number {
  const max = runs.reduce((acc, run) => {
    const end = run.segments.reduce((m, s) => Math.max(m, s.end), 0)
    return Math.max(acc, end)
  }, 0)
  return max
}
