'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Workspace = {
  id: string
  name: string
  slug: string
  memberRole?: 'OWNER' | 'ADMIN' | 'MEMBER'
}

export default function WorkspaceSwitcher({
  workspaces,
  current,
  currentSlug,
}: {
  workspaces?: Workspace[]
  current?: Workspace | null
  currentSlug?: string
}) {
  const [items, setItems] = useState<Workspace[]>(workspaces ?? [])
  const router = useRouter()

  useEffect(() => {
    if (workspaces) return
    fetch('/api/workspaces')
      .then((r) => r.json())
      .then((data: Workspace[]) => setItems(data))
  }, [workspaces])

  const activeSlug = useMemo(() => {
    if (current?.slug) return current.slug
    if (currentSlug) return currentSlug
    return items[0]?.slug ?? ''
  }, [current, currentSlug, items])

  return (
    <select
      value={activeSlug}
      onChange={(e) => router.push(`/dashboard/${e.target.value}`)}
      className="rounded-md border px-3 py-2 text-sm"
    >
      {items.map((w) => (
        <option key={w.id} value={w.slug}>
          {w.name} ({w.memberRole})
        </option>
      ))}
    </select>
  )
}
