'use client'

import { useEffect, useState, useCallback } from 'react'

interface Heatmap {
  [nodeId: string]: number
}

export function useHeatmapOverlay(automationId: string) {
  const [heatmap, setHeatmap] = useState<Heatmap>({})

  const loadHeatmap = useCallback(async () => {
    try {
      const res = await fetch(`/api/automations/${automationId}/heatmap`)
      if (!res.ok) return
      const json = await res.json()
      setHeatmap(json.heatmap ?? {})
    } catch (err) {
      console.error('Failed to load heatmap', err)
    }
  }, [automationId])

  useEffect(() => {
    loadHeatmap()
  }, [loadHeatmap])

  const getIntensity = useCallback(
    (nodeId: string) => {
      const failures = heatmap[nodeId] ?? 0
      if (failures <= 0) return 0
      if (failures === 1) return 0.3
      if (failures === 2) return 0.6
      return 1
    },
    [heatmap],
  )

  return {
    heatmap,
    getIntensity,
    refreshHeatmap: loadHeatmap,
  }
}
