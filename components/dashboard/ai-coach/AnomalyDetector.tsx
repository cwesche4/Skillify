// components/dashboard/ai-coach/AnomalyDetector.tsx
'use client'

import { AlertTriangle, Activity } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

interface Anomaly {
  id: string
  severity: 'low' | 'medium' | 'high'
  message: string
  time: string
}

interface AnomalyDetectorProps {
  anomalies: Anomaly[]
}

export function AnomalyDetector({ anomalies }: AnomalyDetectorProps) {
  return (
    <Card className="card-analytics">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-lg text-white">
          AI Coach – Anomaly Detector
        </h3>
        <Badge variant="red">{anomalies.length} Alerts</Badge>
      </div>

      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
        {anomalies.length === 0 && (
          <p className="text-neutral-text-secondary text-xs">
            No anomalies detected. Everything is running smoothly ✔️
          </p>
        )}

        {anomalies.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3"
          >
            <AlertTriangle
              className={`h-4 w-4 ${
                a.severity === 'high'
                  ? 'text-rose-400'
                  : a.severity === 'medium'
                    ? 'text-amber-300'
                    : 'text-slate-400'
              }`}
            />
            <div className="flex-1">
              <p className="text-sm text-white">{a.message}</p>
              <p className="text-neutral-text-secondary mt-1 text-[11px]">
                {a.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
