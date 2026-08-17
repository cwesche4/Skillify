'use client'

import { useMemo } from 'react'

import { validateNodeData } from '@/lib/builder/node-schemas'
import { type BuilderNodeType, type NodeData } from '@/lib/builder/node-types'
import { useEffect, useRef } from 'react'
import { useInspectorTelemetry } from './useInspectorTelemetry'
import { buildValidationGraph } from '@/lib/inspector/analytics/validationGraph'

export function useInspectorValidation(
  nodeType: BuilderNodeType | undefined,
  data: NodeData,
  telemetry?: {
    workspaceId?: string
    automationId?: string
    // enableTelemetry is accepted for parity with inspector hooks
    enableTelemetry?: boolean
  },
) {
  const result = useMemo(() => {
    if (!nodeType) return null
    // validateNodeData is pure; ensure we never mutate input data
    return validateNodeData(nodeType, { ...data })
  }, [nodeType, data])

  const graph = useMemo(
    () => buildValidationGraph(nodeType, data),
    [nodeType, data],
  )

  const { logEvent } = useInspectorTelemetry(telemetry?.enableTelemetry)
  const prevOk = useRef<boolean | null>(null)

  useEffect(() => {
    if (!result || telemetry?.enableTelemetry !== true) return
    if (prevOk.current === null) {
      prevOk.current = result.ok
      return
    }
    if (result.ok === prevOk.current) return
    logEvent(
      result.ok
        ? 'inspector_validation_cleared'
        : 'inspector_validation_failed',
      {
        workspaceId: telemetry?.workspaceId,
        automationId: telemetry?.automationId,
        nodeType,
      },
    )
    prevOk.current = result.ok
  }, [
    result,
    logEvent,
    telemetry?.workspaceId,
    telemetry?.automationId,
    nodeType,
    telemetry?.enableTelemetry,
  ])

  return { result, graph }
}
