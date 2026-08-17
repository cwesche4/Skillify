import { useEffect, useRef, useState } from 'react'
import type { FC } from 'react'
import SectionHeader from './SectionHeader'

type Rect = { x: number; y: number; width: number; height: number }

type Props = {
  id: string
  name: string
  rect: Rect
  onRectChange: (rect: Rect) => void
  onNameChange: (name: string) => void
  onRemove: () => void
  onFocus?: () => void
  focused?: boolean
  dimmed?: boolean
  pulse?: boolean
}

// Flow sections.
// Visual organization only.
// Must not affect execution, routing, or persistence.
export const FlowSection: FC<Props> = ({
  id,
  name,
  rect,
  onRectChange,
  onNameChange,
  onRemove,
  onFocus,
  focused = false,
  dimmed = false,
  pulse = false,
}) => {
  const [dragging, setDragging] = useState<boolean>(false)
  const [resizing, setResizing] = useState<boolean>(false)
  const dragStart = useRef<{ x: number; y: number; rect: Rect } | null>(null)

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragStart.current) return
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      if (resizing) {
        onRectChange({
          ...dragStart.current.rect,
          width: Math.max(200, dragStart.current.rect.width + dx),
          height: Math.max(150, dragStart.current.rect.height + dy),
        })
      } else if (dragging) {
        onRectChange({
          ...dragStart.current.rect,
          x: dragStart.current.rect.x + dx,
          y: dragStart.current.rect.y + dy,
        })
      }
    }
    const handleUp = () => {
      setDragging(false)
      setResizing(false)
      dragStart.current = null
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging, resizing, onRectChange])

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, rect }
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setResizing(true)
    dragStart.current = { x: e.clientX, y: e.clientY, rect }
  }

  return (
    <div
      aria-label={`section-${id}`}
      className={`pointer-events-none absolute ${
        pulse || focused ? 'animate-pulse ring-2 ring-emerald-600/40' : ''
      }`}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        zIndex: 0,
      }}
    >
      <div
        className={`relative h-full w-full rounded-lg border border-slate-800/60 bg-slate-900/40 ${
          dimmed ? 'opacity-40' : ''
        }`}
        onClick={onFocus}
      >
        <div className="absolute left-2 top-2" onMouseDown={startDrag}>
          <SectionHeader
            name={name}
            onNameChange={onNameChange}
            onRemove={onRemove}
          />
          <p className="pointer-events-none mt-1 text-[10px] text-slate-400">
            Sections are visual only. They do not affect execution.
          </p>
        </div>
        <div
          className="pointer-events-auto absolute -bottom-1 -right-1 h-4 w-4 cursor-se-resize rounded bg-slate-800/70"
          onMouseDown={startResize}
        />
      </div>
    </div>
  )
}

export default FlowSection
