import type { FC } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

type RunOption = {
  id: string
  label: string
}

type Props = {
  runs: RunOption[]
  value: string
  onChange: (id: string) => void
}

export const RunSelector: FC<Props> = ({ runs, value, onChange }) => {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-slate-100">
      <span className="text-[12px] text-slate-400">Viewing run:</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select run" />
        </SelectTrigger>
        <SelectContent>
          {runs.map((run) => (
            <SelectItem key={run.id} value={run.id}>
              {run.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default RunSelector
