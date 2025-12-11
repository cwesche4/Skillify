// components/ui/SidebarTooltip.tsx
'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SidebarTooltipProps {
  label: string
  section?: string
  children: React.ReactNode
  side?: 'right' | 'left'
}

export function SidebarTooltip({
  label,
  section,
  children,
  side = 'right',
}: SidebarTooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: side === 'right' ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: side === 'right' ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className={cn(
              'pointer-events-none absolute top-1/2 z-50 -translate-y-1/2',
              side === 'right'
                ? 'left-full ml-3'
                : 'right-full mr-3 text-right',
            )}
          >
            <div className="rounded-xl border border-neutral-800/80 bg-black/95 px-3 py-2 text-[11px] text-neutral-100 shadow-xl shadow-black/60">
              {section && (
                <div className="mb-0.5 text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                  {section}
                </div>
              )}
              <div className="font-medium">{label}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
