'use client'

import type { FC } from 'react'

type Secret = {
  id: string
  alias: string
  lastFour: string
}

type Props = {
  secrets: Secret[]
  value?: string
  onChange: (id: string) => void
}

// Secrets vault.
// Never return plaintext secrets after creation.
// References only in flows.
export const SecretReferenceField: FC<Props> = ({
  secrets,
  value,
  onChange,
}) => {
  return (
    <div className="space-y-1 text-xs text-slate-100">
      <label className="text-[11px] text-slate-400">
        Secret reference (id only)
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
      >
        <option value="">Select secret</option>
        {secrets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.alias} (…{s.lastFour})
          </option>
        ))}
      </select>
      <p className="text-[10px] text-slate-500">
        Plaintext is never returned. Nodes store references only.
      </p>
    </div>
  )
}

export default SecretReferenceField
