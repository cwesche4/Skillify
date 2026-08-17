'use client'

import { useState } from 'react'

export function InviteForm({ workspaceId }: { workspaceId: string }) {
  const [email, setEmail] = useState('')

  async function submit() {
    await fetch(`/api/workspaces/${workspaceId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    setEmail('')
  }

  return (
    <div className="flex gap-2">
      <input
        className="rounded border px-2 py-1"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <button onClick={submit} className="btn-primary">
        Invite
      </button>
    </div>
  )
}
