import { describe, expect, it } from 'vitest'

import { getCanvasWheelIntent } from '@/lib/workflows/canvasWheel'

describe('canvas wheel intent', () => {
  it('treats normal vertical wheel movement as zoom', () => {
    expect(getCanvasWheelIntent({ deltaX: 0, deltaY: 80 })).toEqual({
      type: 'zoom',
      delta: 80,
    })
  })

  it('treats shift wheel as horizontal pan', () => {
    expect(
      getCanvasWheelIntent({ deltaX: 0, deltaY: 80, shiftKey: true }),
    ).toEqual({
      type: 'pan-x',
      delta: 80,
    })
  })

  it('treats command or control wheel as vertical pan', () => {
    expect(
      getCanvasWheelIntent({ deltaX: 0, deltaY: 80, metaKey: true }),
    ).toEqual({
      type: 'pan-y',
      delta: 80,
    })
    expect(
      getCanvasWheelIntent({ deltaX: 0, deltaY: 80, ctrlKey: true }),
    ).toEqual({
      type: 'pan-y',
      delta: 80,
    })
  })

  it('treats dominant horizontal trackpad movement as horizontal pan', () => {
    expect(getCanvasWheelIntent({ deltaX: 90, deltaY: 12 })).toEqual({
      type: 'pan-x',
      delta: 90,
    })
  })
})
