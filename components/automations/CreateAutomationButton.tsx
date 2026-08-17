'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export function CreateAutomationButton({
  workspaceId,
  workspaceSlug,
  label = 'Create Automation',
  template,
}: {
  workspaceId: string
  workspaceSlug: string
  label?: string
  template?: { name: string; description?: string; flow?: unknown }
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const create = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template?.name,
          description: template?.description,
          flow: template?.flow,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.automationId) {
        throw new Error(data.error || 'Failed to create automation')
      }
      router.push(
        `/dashboard/${workspaceSlug}/automations/${data.automationId}/builder`,
      )
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" onClick={create} disabled={loading}>
      {loading ? 'Creating…' : label}
    </Button>
  )
}
