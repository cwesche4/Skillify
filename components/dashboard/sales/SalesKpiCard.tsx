'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

type SalesKpiCardProps = {
  id: string
  label: string
  value: string
  helper: string
  tooltip: string
  isActive?: boolean
  toneClass?: string
  onClick: () => void
}

export function SalesKpiCard({
  id,
  label,
  value,
  helper,
  tooltip,
  isActive = false,
  toneClass = 'border-cyan-300/50 bg-cyan-300/[0.065] shadow-cyan-400/[0.08]',
  onClick,
}: SalesKpiCardProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  useEffect(() => {
    if (!isTooltipVisible) return

    const updateTooltipPosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return

      const viewportPadding = 16
      const width = Math.min(320, window.innerWidth - viewportPadding * 2)
      const preferredLeft = rect.left + rect.width / 2 - width / 2

      setTooltipStyle({
        top: rect.bottom + 8,
        left: Math.max(
          viewportPadding,
          Math.min(preferredLeft, window.innerWidth - width - viewportPadding),
        ),
        width,
      })
    }

    updateTooltipPosition()
    window.addEventListener('resize', updateTooltipPosition)
    window.addEventListener('scroll', updateTooltipPosition, true)

    return () => {
      window.removeEventListener('resize', updateTooltipPosition)
      window.removeEventListener('scroll', updateTooltipPosition, true)
    }
  }, [isTooltipVisible])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-pressed={isActive}
        aria-describedby={`${id}-helper`}
        onClick={onClick}
        onFocus={() => setIsTooltipVisible(true)}
        onBlur={() => setIsTooltipVisible(false)}
        onMouseEnter={() => setIsTooltipVisible(true)}
        onMouseLeave={() => setIsTooltipVisible(false)}
        className={cn(
          'rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-300/[0.04] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
          isActive && toneClass,
        )}
      >
        <span className="text-neutral-text-secondary text-xs">{label}</span>
        <span className="mt-2 block text-2xl font-semibold text-neutral-100">
          {value}
        </span>
        <span className="text-neutral-text-secondary mt-1 block text-xs">
          {helper}
        </span>
      </button>

      {isTooltipVisible && tooltipStyle
        ? createPortal(
            <div
              id={`${id}-helper`}
              role="tooltip"
              style={{
                top: tooltipStyle.top,
                left: tooltipStyle.left,
                width: tooltipStyle.width,
              }}
              className="pointer-events-none fixed z-[1000] rounded-xl border border-cyan-300/20 bg-slate-950/95 px-3 py-2 text-xs leading-relaxed text-cyan-50 opacity-100 shadow-2xl shadow-black/40 backdrop-blur"
            >
              {tooltip}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
