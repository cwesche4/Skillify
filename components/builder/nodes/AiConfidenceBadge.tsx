import type { FC } from 'react'
import { Badge } from '@/components/ui/Badge'

type Confidence = 'low' | 'medium' | 'high'

type Props = {
  confidence: Confidence
  decision: string
  explanation?: string
  onClick?: () => void
}

const colorFor = (confidence: Confidence) => {
  switch (confidence) {
    case 'high':
      return {
        bg: 'bg-emerald-500/15',
        border: 'border-emerald-500/60',
        text: 'text-emerald-100',
      }
    case 'medium':
      return {
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/60',
        text: 'text-amber-100',
      }
    default:
      return {
        bg: 'bg-rose-500/15',
        border: 'border-rose-500/60',
        text: 'text-rose-100',
      }
  }
}

export const AiConfidenceBadge: FC<Props> = ({
  confidence,
  decision,
  explanation,
  onClick,
}) => {
  const colors = colorFor(confidence)
  return (
    <button
      type="button"
      onClick={onClick}
      title={explanation}
      className={`flex items-center gap-2 rounded border px-2 py-1 text-[11px] ${colors.bg} ${colors.border} ${colors.text}`}
    >
      <Badge size="xs" variant="slate">
        {confidence.toUpperCase()}
      </Badge>
      <span className="truncate">{decision}</span>
    </button>
  )
}

export default AiConfidenceBadge
