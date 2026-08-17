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
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

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
    const response = await fetch(`/api/workspaces/${workspaceId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: deleteConfirmation }),
    })

    if (response.ok) {
      router.push('/dashboard/workspaces')
    }
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
        {confirmingDelete ? (
          <div className="mt-4 space-y-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
            <p className="text-sm text-red-100">
              Type the workspace name to confirm permanent deletion.
            </p>
            <input
              className="form-input"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={initialName}
              aria-label={`Type ${initialName} to confirm workspace deletion`}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                className="btn-danger"
                onClick={remove}
                disabled={deleteConfirmation.trim() !== initialName}
              >
                Delete workspace
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirmingDelete(false)
                  setDeleteConfirmation('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="btn-danger"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete workspace
          </Button>
        )}
      </div>
    </div>
  )
}
