import type { TimelineItem } from '@/lib/runs/timeline/types'
import type { ReplaySpeed, ReplayState } from './types'

const SPEED_MS: Record<ReplaySpeed, number> = {
  '1x': 1000,
  '2x': 500,
  instant: 0,
}

export type ReplayHandlers = {
  onUpdate: (state: ReplayState) => void
  onHighlight?: (item: TimelineItem, index: number) => void
}

export function createReplayController(
  items: TimelineItem[],
  handlers: ReplayHandlers,
) {
  let state: ReplayState = { isPlaying: false, currentIndex: 0, speed: '1x' }
  let timer: NodeJS.Timeout | null = null

  const stopTimer = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const emit = () => {
    handlers.onUpdate(state)
    const current = items[state.currentIndex]
    if (current && handlers.onHighlight) {
      handlers.onHighlight(current, state.currentIndex)
    }
  }

  const step = () => {
    if (state.currentIndex < items.length - 1) {
      state = { ...state, currentIndex: state.currentIndex + 1 }
      emit()
      schedule()
    } else {
      pause()
    }
  }

  const schedule = () => {
    stopTimer()
    if (!state.isPlaying) return
    const delay = SPEED_MS[state.speed]
    if (delay === 0) {
      // instant
      state = { ...state, currentIndex: items.length - 1 }
      emit()
      pause()
      return
    }
    timer = setTimeout(step, delay)
  }

  const play = () => {
    if (items.length === 0) return
    state = { ...state, isPlaying: true }
    emit()
    schedule()
  }

  const pause = () => {
    state = { ...state, isPlaying: false }
    stopTimer()
    emit()
  }

  const setSpeed = (speed: ReplaySpeed) => {
    state = { ...state, speed }
    if (state.isPlaying) schedule()
    else emit()
  }

  const jumpTo = (index: number) => {
    const clamped = Math.min(Math.max(index, 0), items.length - 1)
    state = { ...state, currentIndex: clamped }
    emit()
  }

  return {
    play,
    pause,
    setSpeed,
    jumpTo,
    dispose: stopTimer,
    getState: () => state,
  }
}
