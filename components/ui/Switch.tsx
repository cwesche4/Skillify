// components/ui/Switch.tsx
"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface SwitchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  className,
  ...props
}: SwitchProps) {
  const [internal, setInternal] = React.useState<boolean>(defaultChecked ?? false)

  const isControlled = typeof checked === "boolean"
  const currentChecked = isControlled ? checked : internal

  function toggle() {
    if (disabled) return
    const next = !currentChecked
    if (!isControlled) setInternal(next)
    onCheckedChange?.(next)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={currentChecked}
      aria-disabled={disabled}
      data-state={currentChecked ? "checked" : "unchecked"}
      onClick={toggle}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors",
        disabled
          ? "cursor-not-allowed border-slate-700 bg-slate-900 opacity-60"
          : currentChecked
            ? "border-emerald-500/70 bg-emerald-500/20"
            : "border-slate-700 bg-slate-900",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
          currentChecked ? "translate-x-4" : "translate-x-1",
        )}
      />
    </button>
  )
}
