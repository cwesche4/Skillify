'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WorkspaceMemberRole } from '@/lib/prisma/enums'

export type TeamMember = {
  id: string
  role: WorkspaceMemberRole
  userId: string
  fullName: string | null
  email: string | null
  createdAt: string
}

export type WorkspaceInvite = {
  id: string
  email: string
  role: WorkspaceMemberRole
  token: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
}

export function useWorkspaceTeam(workspaceId: string) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [mRes, iRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/members`, { cache: 'no-store' }),
        fetch(`/api/workspaces/${workspaceId}/invite`, { cache: 'no-store' }),
      ])
      if (!mRes.ok) throw new Error(await mRes.text())
      if (!iRes.ok) throw new Error(await iRes.text())

      const mJson = await mRes.json()
      const iJson = await iRes.json()

      setMembers(mJson.members ?? [])
      setInvites(iJson.invites ?? [])
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const pendingInvites = useMemo(
    () => invites.filter((i) => !i.acceptedAt),
    [invites],
  )

  return { members, invites, pendingInvites, loading, error, refresh }
}
