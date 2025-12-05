"use client"

import type { NodeProps } from "reactflow"

export function WebhookNode({ data }: NodeProps<any>) {
  return (
    <div className="node-base border border-slate-500 bg-slate-600/20 text-slate-200">
      Webhook
      <br />
      {data.method ?? "POST"} → {data.url ?? "URL"}
    </div>
  )
}
