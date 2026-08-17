export type CanvasWheelIntent =
  | { type: 'zoom'; delta: number }
  | { type: 'pan-x'; delta: number }
  | { type: 'pan-y'; delta: number }

export type CanvasWheelEventLike = {
  deltaX: number
  deltaY: number
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
}

export function getCanvasWheelIntent(
  event: CanvasWheelEventLike,
): CanvasWheelIntent {
  const absX = Math.abs(event.deltaX)
  const absY = Math.abs(event.deltaY)

  if (event.metaKey || event.ctrlKey) {
    return { type: 'pan-y', delta: event.deltaY || event.deltaX }
  }

  if (event.shiftKey) {
    return { type: 'pan-x', delta: event.deltaX || event.deltaY }
  }

  if (absX > absY) {
    return { type: 'pan-x', delta: event.deltaX }
  }

  return { type: 'zoom', delta: event.deltaY }
}
