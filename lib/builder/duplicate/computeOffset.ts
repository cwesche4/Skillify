const BASE_OFFSET = 24
const RESET_WINDOW_MS = 1500

let lastDuplication = 0
let repeatCount = 0

export function computeOffset(): { dx: number; dy: number } {
  const now = Date.now()
  if (now - lastDuplication > RESET_WINDOW_MS) {
    repeatCount = 0
  } else {
    repeatCount += 1
  }
  lastDuplication = now
  const factor = 1 + repeatCount
  const delta = BASE_OFFSET * factor
  return { dx: delta, dy: delta }
}
