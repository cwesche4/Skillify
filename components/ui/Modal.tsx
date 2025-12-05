// components/ui/Modal.tsx
"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface ModalProps {
  isOpen: boolean
  onClose?: () => void
  title?: string
  description?: string
  children?: React.ReactNode
  size?: "sm" | "md" | "lg"
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
}: ModalProps) {
  if (!isOpen) return null

  const maxWidth = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-3xl" : "max-w-lg"

  return (
    <div className="skillify-backdrop">
      <div className={cn("skillify-modal mx-auto w-full", maxWidth)}>
        <div className="modal-header">
          <div>
            {title && <h2 className="modal-title">{title}</h2>}
            {description && (
              <p className="body text-neutral-text-secondary mt-1 text-sm">
                {description}
              </p>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} className="btn-ghost px-2 py-1 text-sm">
              Close
            </button>
          )}
        </div>

        <div>{children}</div>
      </div>
    </div>
  )
}
