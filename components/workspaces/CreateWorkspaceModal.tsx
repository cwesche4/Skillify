"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export default function CreateWorkspaceModal({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function createWorkspace() {
    if (!name.trim() || name.trim().length < 3) {
      setError("Workspace name must be at least 3 characters.")
      return
    }

    setLoading(true)
    setError("")

    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || "Could not create workspace.")
      setLoading(false)
      return
    }

    setLoading(false)
    setOpen(false)
    setName("")

    // Refresh so workspace list updates
    router.refresh()
    if (onCreated) onCreated()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-primary px-3 py-2 text-white transition hover:bg-brand-indigo"
      >
        + New Workspace
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-dark">
            <h2 className="text-neutral-text-primary mb-4 text-xl font-semibold dark:text-white">
              Create Workspace
            </h2>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              className="dark:bg-neutral-card-dark w-full rounded-md border border-neutral-border bg-neutral-light p-3 dark:text-white"
            />

            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-neutral-border px-4 py-2 dark:border-neutral-700 dark:text-white"
              >
                Cancel
              </button>

              <button
                disabled={loading}
                onClick={createWorkspace}
                className="rounded-md bg-brand-primary px-4 py-2 text-white disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Workspace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
