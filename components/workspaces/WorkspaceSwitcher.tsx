'use client'

import { useRouter } from 'next/navigation'

export default function WorkspaceSwitcher({ workspaces, current }: any) {
  const router = useRouter()

  return (
    <select
      className="bg-neutral-card-dark/40 rounded-lg border border-neutral-border px-2 py-1 text-sm"
      value={current?.slug}
      onChange={(e) => router.push(`/dashboard/${e.target.value}`)}
    >
      {workspaces.map((ws: any) => (
        <option key={ws.id} value={ws.slug}>
          {ws.name}
        </option>
      ))}
    </select>
  )
}
