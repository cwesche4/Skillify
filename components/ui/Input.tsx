// components/ui/Input.tsx
"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="space-y-1">
        <input
          ref={ref}
          className={cn(
            "text-neutral-text-primary placeholder:text-neutral-text-secondary/70 w-full rounded-xl border bg-slate-950/80 px-3 py-2 text-sm shadow-sm outline-none transition-colors",
            "focus:border-brand-primary/70 focus:ring-brand-primary/60 border-slate-700 focus:ring-1",
            error && "border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/60",
            className,
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-rose-300">{error}</p>}
      </div>
    )
  },
)

Input.displayName = "Input"
