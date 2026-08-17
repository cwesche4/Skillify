// app/invites/accept/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function AcceptInvitePage() {
  const sp = useSearchParams()
  const router = useRouter()
  const token = sp.get('token')

  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Missing invite token.')
      return
    }

    ;(async () => {
      try {
        setStatus('loading')
        const res = await fetch('/api/workspaces/invites/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Failed to accept invite')

        setStatus('success')
        const slug = data?.workspace?.slug
        if (slug) router.replace(`/dashboard/${slug}`)
        else setMessage('Invite accepted, but workspace was not found.')
      } catch (e: any) {
        setStatus('error')
        setMessage(e?.message ?? 'Failed to accept invite')
      }
    })()
  }, [token, router])

  return (
    <div className="mx-auto max-w-md space-y-3 p-6">
      <h1 className="text-xl font-semibold">Accept Invite</h1>

      {status === 'loading' ? <p>Accepting invite…</p> : null}
      {status === 'success' ? <p>Invite accepted. Redirecting…</p> : null}
      {status === 'error' ? (
        <p className="text-sm text-red-600">{message}</p>
      ) : null}
    </div>
  )
}
