'use client'

interface VersionBadgeProps {
  visible?: boolean
}

export default function VersionBadge({ visible = false }: VersionBadgeProps) {
  if (!visible) return null

  return (
    <div className="pointer-events-none absolute bottom-24 right-4 z-30 rounded-lg border border-slate-800/70 bg-slate-950/90 px-3 py-1.5 text-[11px] font-semibold text-slate-200 shadow-lg backdrop-blur">
      Versioning: Coming soon
    </div>
  )
}
