'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AutomationVersion } from '@/lib/versioning/types'

type UseAutomationVersionsOptions = {
  enabled?: boolean
}

// Read-only-first: no auto-save, no implicit mutations.
export function useAutomationVersions(
  workspaceId: string,
  automationId: string,
  options: UseAutomationVersionsOptions = {},
) {
  const enabled = options.enabled ?? false
  const [versions, setVersions] = useState<AutomationVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchVersions = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/automations/${automationId}/versions`,
      )
      if (!res.ok) throw new Error(`Failed to load versions (${res.status})`)
      const data = await res.json()
      setVersions(data.versions ?? [])
    } catch (err: any) {
      setError(err?.message || 'Unable to load versions')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, automationId, enabled])

  useEffect(() => {
    if (!enabled) return
    fetchVersions()
  }, [enabled, fetchVersions])

  const createVersion = useCallback(async (label?: string) => {
    // Read-only placeholder: no persistence yet.
    return { ok: false, message: 'Version creation not implemented', label }
  }, [])

  const restoreVersion = useCallback(async (_versionId: string) => {
    return { ok: false, message: 'Restore is manual only (not implemented)' }
  }, [])

  const deleteVersion = useCallback(async (_versionId: string) => {
    return { ok: false, message: 'Delete not implemented (read-only)' }
  }, [])

  return useMemo(
    () => ({
      versions,
      loading,
      error,
      refresh: fetchVersions,
      createVersion,
      restoreVersion,
      deleteVersion,
    }),
    [
      versions,
      loading,
      error,
      fetchVersions,
      createVersion,
      restoreVersion,
      deleteVersion,
    ],
  )
}
