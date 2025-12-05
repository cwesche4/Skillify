// components/charts/ChartGradients.tsx
"use client"

import type { FC } from "react"

type ChartGradientsProps = {
  /**
   * Prefix used to make gradient ids unique when multiple charts
   * appear on the same page.
   */
  idPrefix?: string
}

export const ChartGradients: FC<ChartGradientsProps> = ({ idPrefix = "skillify" }) => {
  const primary = `${idPrefix}-primary`
  const success = `${idPrefix}-success`
  const danger = `${idPrefix}-danger`
  const subtle = `${idPrefix}-subtle`

  return (
    <defs>
      {/* Primary area gradient */}
      <linearGradient id={primary} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopOpacity={0.9} stopColor="var(--brand-primary)" />
        <stop offset="100%" stopOpacity={0.05} stopColor="var(--brand-primary)" />
      </linearGradient>

      {/* Success */}
      <linearGradient id={success} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopOpacity={0.9} stopColor="#22c55e" />
        <stop offset="100%" stopOpacity={0.05} stopColor="#22c55e" />
      </linearGradient>

      {/* Danger */}
      <linearGradient id={danger} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopOpacity={0.9} stopColor="#f97373" />
        <stop offset="100%" stopOpacity={0.05} stopColor="#f97373" />
      </linearGradient>

      {/* Subtle background */}
      <linearGradient id={subtle} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopOpacity={0.25} stopColor="#64748b" />
        <stop offset="100%" stopOpacity={0.05} stopColor="#0f172a" />
      </linearGradient>
    </defs>
  )
}
