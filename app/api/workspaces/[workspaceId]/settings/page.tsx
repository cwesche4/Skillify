// app/dashboard/workspaces/[workspaceId]/settings/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'

export default function WorkspaceSettingsPage({ params }: any) {
  const { workspaceId } = params
  const router = useRouter()

  const [name, setName] = useState('')
  const [initialName, setInitialName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/workspaces/${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        setName(data.data.name)
        setInitialName(data.data.name)
      })
      .finally(() => setLoading(false))
  }, [workspaceId])

  const save = async () => {
    await fetch(`/api/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
    setInitialName(name)
  }

  const remove = async () => {
    if (!confirm('Are you sure? This will delete the workspace for everyone.'))
      return

    await fetch(`/api/workspaces/${workspaceId}`, {
      method: 'DELETE',
    })

    router.push('/dashboard/workspaces')
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="h2 mb-2">Workspace Settings</h1>
        <p className="body">
          Manage this workspace’s name and dangerous actions.
        </p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="form-label">Workspace Name</label>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workspace name"
          />
        </div>

        <Button
          disabled={name.trim() === '' || name === initialName}
          onClick={save}
        >
          Save changes
        </Button>
      </div>

      <div className="card border-red-500/60">
        <h2 className="h3 mb-2 text-red-400">Danger Zone</h2>
        <p className="body mb-4">
          Deleting this workspace will remove access for all members and delete
          associated data.
        </p>

        <Button className="btn-danger" onClick={remove}>
          Delete workspace
        </Button>
      </div>
    </div>
  )
}
