// app/dashboard/[workspaceSlug]/members/page.tsx
'use client'

import { useEffect, useState } from 'react'

type Member = {
  id: string
  fullName?: string | null
  email?: string | null
  role: string
}

type PageProps = { params: { workspaceSlug: string } }

export default function MembersPage({ params }: PageProps) {
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    fetch(`/api/workspaces/${params.workspaceSlug}/members`)
      .then((r) => r.json())
      .then((d) => setMembers(d.members))
  }, [params.workspaceSlug])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Team Members</h1>

      {members.map((m) => (
        <div key={m.id} className="flex justify-between rounded border p-3">
          <div>
            <div>{m.fullName ?? 'Unnamed'}</div>
            <div className="text-muted-foreground text-sm">{m.email}</div>
          </div>
          <div className="rounded border px-2 py-1 text-xs">{m.role}</div>
        </div>
      ))}
    </div>
  )
}
