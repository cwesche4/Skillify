import type { TimelineItem } from '@/lib/runs/timeline/types'

export type ReplaySpeed = '1x' | '2x' | 'instant'

export interface ReplayState {
  isPlaying: boolean
  currentIndex: number
  speed: ReplaySpeed
}

export interface ReplayContext {
  items: TimelineItem[]
  state: ReplayState
}
