'use client'

export type AIAnnotation = {
  id: string
  targetId: string
  position: { x: number; y: number }
  message: string
  severity?: 'info' | 'warn' | 'error'
  type?: 'node' | 'edge'
}

interface AICoachOverlayProps {
  visible: boolean
  annotations: AIAnnotation[]
  className?: string
}

export default function AICoachOverlay({
  visible,
  annotations,
  className,
}: AICoachOverlayProps) {
  if (!visible || !annotations.length) return null

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-40 ${className ?? ''}`}
      aria-label="AI Coach Annotations"
    >
      {annotations.map((a) => {
        const color =
          a.severity === 'error'
            ? 'border-rose-400/60 bg-rose-500/10 text-rose-50'
            : a.severity === 'warn'
              ? 'border-amber-400/60 bg-amber-500/10 text-amber-50'
              : 'border-cyan-400/60 bg-cyan-500/10 text-cyan-50'

        return (
          <div
            key={a.id}
            className="absolute -translate-y-5 translate-x-3"
            style={{ left: a.position.x, top: a.position.y }}
          >
            <div
              className={`pointer-events-auto min-w-[160px] max-w-[260px] rounded-lg border px-3 py-2 text-[11px] font-medium shadow-lg backdrop-blur ${color}`}
            >
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em]">
                <span>AI Coach</span>
                <span className="text-[9px] text-slate-200/70">
                  {a.type === 'edge' ? 'Edge' : 'Node'}
                </span>
              </div>
              <div>{a.message}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
