// components/ui/typography.tsx
"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {}

export function H1({ className, ...props }: TypographyProps) {
  return (
    <h1
      className={cn(
        "text-neutral-text-primary text-3xl font-semibold tracking-tight sm:text-4xl",
        className,
      )}
      {...props}
    />
  )
}

export function H2({ className, ...props }: TypographyProps) {
  return (
    <h2
      className={cn(
        "text-neutral-text-primary text-2xl font-semibold tracking-tight sm:text-3xl",
        className,
      )}
      {...props}
    />
  )
}

export function H3({ className, ...props }: TypographyProps) {
  return (
    <h3
      className={cn(
        "text-neutral-text-primary text-lg font-semibold sm:text-xl",
        className,
      )}
      {...props}
    />
  )
}

export function H4({ className, ...props }: TypographyProps) {
  return (
    <h4
      className={cn(
        "text-neutral-text-primary text-base font-semibold sm:text-lg",
        className,
      )}
      {...props}
    />
  )
}

export function Muted({ className, ...props }: TypographyProps) {
  return <p className={cn("text-neutral-text-secondary text-sm", className)} {...props} />
}

export function Lead({ className, ...props }: TypographyProps) {
  return (
    <p
      className={cn("text-neutral-text-secondary text-sm sm:text-base", className)}
      {...props}
    />
  )
}
