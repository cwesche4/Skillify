'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export function Table({
  className,
  containerClassName,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & {
  containerClassName?: string
}) {
  return (
    <div className={cn('w-full overflow-x-auto', containerClassName)}>
      <table
        className={cn(
          'text-neutral-text-primary w-full border-collapse text-sm',
          className,
        )}
        {...props}
      />
    </div>
  )
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-app-surface-muted', className)} {...props} />
}

export function TBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('', className)} {...props} />
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-app hover:bg-app-surface-hover border-b transition-colors last:border-0',
        className,
      )}
      {...props}
    />
  )
}

export function TH({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'text-neutral-text-secondary px-3 py-2 text-left text-xs font-medium uppercase tracking-wide',
        className,
      )}
      {...props}
    />
  )
}

export function TD({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'text-neutral-text-primary px-3 py-2 align-middle text-sm',
        className,
      )}
      {...props}
    />
  )
}
