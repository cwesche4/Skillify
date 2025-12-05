// components/ui/Alert.tsx
"use client"

import { cn } from "@/lib/utils"
import * as React from "react"

export type AlertVariant = "success" | "error" | "info" | "warning"

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
}

const VARIANT_STYLES: Record<AlertVariant, string> = {
  success: "border-emerald-500/40 bg-emerald-500/5 text-emerald-100",
  error: "border-rose-500/40 bg-rose-500/5 text-rose-100",
  info: "border-sky-500/40 bg-sky-500/5 text-sky-100",
  warning: "border-amber-500/40 bg-amber-500/5 text-amber-100",
}

export function Alert({ variant = "info", className, ...props }: AlertProps) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-xs",
        VARIANT_STYLES[variant],
        className,
      )}
      {...props}
    />
  )
}
