'use client'

import { useState } from 'react'
import CreateWorkspaceModal from './CreateWorkspaceModal'

export default function WorkspacePanel({
  workspaces,
  current,
}: {
  workspaces: { id: string; name: string; slug: string }[]
  current: { id: string; name: string; slug: string } | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-neutral-card-light dark:bg-neutral-card-dark hidden items-center gap-2 rounded-lg border border-neutral-border px-3 py-2 transition hover:bg-neutral-light dark:text-white dark:hover:bg-neutral-dark md:flex"
      >
        {current ? current.name : 'Workspace'}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
          <div className="bg-neutral-card-light flex h-full w-80 flex-col border-l border-neutral-border p-4 dark:bg-neutral-dark">
            <h2 className="mb-4 text-lg font-semibold dark:text-white">
              Workspaces
            </h2>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {workspaces.map((ws) => (
                <a
                  key={ws.id}
                  href={`/dashboard/${ws.slug}`}
                  className={`dark:hover:bg-neutral-card-dark block rounded-md px-3 py-2 hover:bg-neutral-light ${
                    current?.id === ws.id
                      ? 'dark:bg-neutral-card-dark bg-neutral-light font-medium'
                      : ''
                  }`}
                >
                  {ws.name}
                </a>
              ))}
            </div>

            <div className="border-t border-neutral-border pt-4">
              <CreateWorkspaceModal />
            </div>

            <button
              onClick={() => setOpen(false)}
              className="bg-neutral-border/30 dark:bg-neutral-card-dark/50 text-neutral-text-primary hover:bg-neutral-border/50 mt-4 rounded-md px-3 py-2 transition dark:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
