'use client'

export function requireAiActionConfirmation(message: string) {
  if (typeof window === 'undefined') return false
  return window.confirm(message)
}
