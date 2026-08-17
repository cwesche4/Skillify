import type { NodeProps } from 'reactflow'
import { Handle, Position } from 'reactflow'
import { cn } from '@/lib/utils'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import { getWorkflowNodeIcon } from '@/lib/workflows/nodeIcons'

export default function CRMNode({ data }: NodeProps) {
  const definition =
    typeof data?.__registryNodeId === 'string'
      ? getWorkflowNodeDefinition(data.__registryNodeId)
      : undefined
  const title = data?.label || definition?.label || data?.action || 'CRM'
  const subtitle = data?.title
    ? data.title
    : data?.provider && data?.objectType
      ? `${data.provider} • ${data.objectType}`
      : data?.objectType ||
        data?.health ||
        data?.stage ||
        data?.provider ||
        'CRM'
  const warnings: string[] = []
  if (data?.planBlocked) warnings.push('Plan upgrade required')
  if (data?.integrationDisabled) warnings.push('Integration disabled')
  if (data?.circuitOpen) warnings.push('Circuit open (actions paused)')
  if (data?.actionError) warnings.push(`Last error: ${data.actionError}`)
  const handleClass = cn(
    '!h-7 !w-7 !border-0 !bg-transparent',
    'cursor-crosshair rounded-full transition',
    'after:absolute after:left-1/2 after:top-1/2 after:h-2.5 after:w-2.5 after:-translate-x-1/2 after:-translate-y-1/2',
    'after:rounded-full after:border after:border-sky-300/60 after:bg-slate-950 after:shadow-[0_0_0_2px_rgba(15,23,42,0.8)] after:transition',
    'hover:after:border-sky-200 hover:after:bg-sky-400 hover:after:shadow-[0_0_0_4px_rgba(56,189,248,0.16)]',
  )

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true
  const Icon = getWorkflowNodeIcon(
    data?.__iconKey ?? definition?.iconKey ?? 'database-zap',
  )

  return (
    <div
      className={cn(
        'min-w-[220px] select-none rounded-xl border border-sky-500/35 bg-slate-950/95 p-3.5 text-xs text-slate-100',
        'shadow-md shadow-sky-950/20 backdrop-blur-sm transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-slate-900/60',
        isActive &&
          'animate-pulse ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950',
        isHot && 'border-rose-500/70 shadow-[0_0_25px_rgba(248,113,113,0.55)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-sky-500/35 bg-slate-950/80 text-sky-200">
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          <span className="line-clamp-2 text-sm font-semibold leading-tight text-sky-200">
            {title}
          </span>
        </div>
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
          Pro/Elite
        </span>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
        CRM
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
        {definition?.description ??
          'Updates customer records, deals, or notes in your CRM.'}
      </p>
      <p className="mt-2 line-clamp-1 text-[10px] text-slate-500">{subtitle}</p>
      {warnings.length > 0 && (
        <div className="mt-2 space-y-1">
          {warnings.map((w) => (
            <div
              key={w}
              className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200"
            >
              {w}
            </div>
          ))}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className={handleClass}
        style={{ left: -10 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={handleClass}
        style={{ right: -10 }}
      />
    </div>
  )
}
