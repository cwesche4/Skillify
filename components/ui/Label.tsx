// components/ui/Label.tsx
import * as React from "react"

import { cn } from "@/lib/utils"

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "form-label", // from globals.css
        className,
      )}
      {...props}
    />
  )
}
