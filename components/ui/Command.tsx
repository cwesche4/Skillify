'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export function Command({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col', className)} {...props}>
      {children}
    </div>
  )
}

export function CommandInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <input
      className={cn(
        'w-full border-b border-slate-800 bg-transparent px-3 py-2 text-sm outline-none',
        props.className,
      )}
      {...props}
    />
  )
}

export function CommandEmpty({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-3 py-2 text-sm text-slate-400', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CommandGroup({
  heading,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { heading?: React.ReactNode }) {
  return (
    <div className={cn('py-2', className)} {...props}>
      {heading ? (
        <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {heading}
        </div>
      ) : null}
      {children}
    </div>
  )
}

export function CommandItem({
  className,
  children,
  onSelect,
  ...props
}: React.HTMLAttributes<HTMLButtonElement> & { onSelect?: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-900',
        className,
      )}
      onClick={onSelect}
      {...props}
    >
      {children}
    </button>
  )
}
