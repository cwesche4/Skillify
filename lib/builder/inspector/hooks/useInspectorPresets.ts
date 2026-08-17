'use client'

import { useCallback, useEffect, useState } from 'react'

export function useInspectorPresets(
  workspaceId: string | undefined,
  nodeType: string | undefined,
) {
  const [presets, setPresets] = useState<
    Record<string, { id?: string; name: string; data: any }>
  >({})
  const [presetName, setPresetName] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!workspaceId || !nodeType) {
        setPresets({})
        return
      }
      try {
        const res = await fetch(
          `/api/inspector/presets?workspaceId=${workspaceId}&nodeType=${nodeType}`,
        )
        if (!res.ok) throw new Error('fetch failed')
        const json = await res.json()
        if (cancelled) return
        const fromApi: Record<
          string,
          { id?: string; name: string; data: any }
        > = {}
        for (const p of json.presets ?? []) {
          fromApi[p.name] = { id: p.id, name: p.name, data: p.data }
        }
        setPresets(fromApi)
      } catch {
        try {
          const raw =
            workspaceId && typeof window !== 'undefined'
              ? window.localStorage.getItem(
                  `skillify.inspector.presets.${workspaceId}.${nodeType}`,
                )
              : null
          setPresets(raw ? (JSON.parse(raw) as any) : {})
        } catch {
          setPresets({})
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, nodeType])

  const persist = useCallback(
    (next: Record<string, { name: string; data: any }>) => {
      if (!workspaceId || !nodeType) return
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(
          `skillify.inspector.presets.${workspaceId}.${nodeType}`,
          JSON.stringify(next),
        )
      } catch {
        /* noop */
      }
    },
    [workspaceId, nodeType],
  )

  const savePreset = useCallback(
    (data: any): boolean => {
      if (!presetName.trim()) return false
      if (!workspaceId || !nodeType) return false
      const sanitized =
        data && typeof data === 'object'
          ? Object.fromEntries(
              Object.entries(data).filter(
                ([key]) =>
                  ![
                    '__simActive',
                    '__replayActive',
                    '__internal',
                    '__logs',
                  ].includes(key),
              ),
            )
          : data
      const next = {
        ...presets,
        [presetName.trim()]: { name: presetName.trim(), data: sanitized },
      }
      setPresets(next)
      persist(next)
      fetch('/api/inspector/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          nodeType,
          name: presetName.trim(),
          data: sanitized,
        }),
      }).catch(() => {})
      setPresetName('')
      return true
    },
    [persist, presetName, presets],
  )

  const applyPreset = useCallback(
    (name: string) => {
      if (!workspaceId || !nodeType) return undefined
      const preset = presets[name]
      return preset?.data
    },
    [presets, workspaceId, nodeType],
  )

  const deletePreset = useCallback(
    (name: string): boolean => {
      if (!name.trim()) return false
      if (!workspaceId || !nodeType) return false
      const next = { ...presets }
      delete next[name.trim()]
      setPresets(next)
      persist(next)
      const target = presets[name.trim()]
      if (target?.id) {
        fetch(
          `/api/inspector/presets/${target.id}?workspaceId=${workspaceId}&nodeType=${nodeType}`,
          {
            method: 'DELETE',
          },
        ).catch(() => {})
      }
      return true
    },
    [persist, presets, workspaceId, nodeType],
  )

  return {
    presets,
    presetName,
    setPresetName,
    savePreset,
    applyPreset,
    deletePreset,
  }
}
