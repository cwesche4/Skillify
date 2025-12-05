"use client"

import type { Node } from "reactflow"

import type { NodeData } from "../node-types"

import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"

interface InspectorPanelProps {
  selectedNode: Node | null
  onChangeData: (partial: Partial<NodeData>) => void
  onAiImprove: () => void
  canAiImprove: boolean
}

export default function InspectorPanel({
  selectedNode,
  onChangeData,
  onAiImprove,
  canAiImprove,
}: InspectorPanelProps) {
  if (!selectedNode) {
    return (
      <div className="flex w-80 flex-col border-l border-slate-800 bg-slate-950/95 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-100">Node Inspector</h2>
        <p className="text-[12px] text-slate-400">
          Select a node in the canvas to edit its settings.
        </p>
      </div>
    )
  }

  const data = (selectedNode.data ?? {}) as NodeData

  const isAiNode =
    selectedNode.type === "ai-llm" ||
    selectedNode.type === "ai-classifier" ||
    selectedNode.type === "ai-splitter" ||
    selectedNode.type === "or-path"

  const isClassifier =
    selectedNode.type === "ai-classifier" || selectedNode.type === "ai-splitter"

  const isDelay = selectedNode.type === "delay"
  const isWebhook = selectedNode.type === "webhook"
  const isGroup = selectedNode.type === "group"

  return (
    <div className="flex w-80 flex-col border-l border-slate-800 bg-slate-950/95 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Node Inspector</h2>
        <Badge size="xs">{(selectedNode.type ?? "node").toUpperCase()}</Badge>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] text-slate-500">Configure behavior and AI prompts.</p>
        <Button variant="subtle" size="sm" onClick={onAiImprove} disabled={!canAiImprove}>
          AI Improve
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        <div>
          <label className="form-label text-[11px]">Label</label>
          <input
            className="form-input text-[12px]"
            value={data.label ?? ""}
            onChange={(e) => onChangeData({ label: e.target.value })}
          />
        </div>

        {isAiNode && (
          <div>
            <label className="form-label text-[11px]">Prompt / Description</label>
            <textarea
              className="form-textarea text-[12px]"
              value={data.prompt ?? ""}
              onChange={(e) => onChangeData({ prompt: e.target.value })}
            />
          </div>
        )}

        {isClassifier && (
          <div>
            <label className="form-label text-[11px]">Classes (comma separated)</label>
            <input
              className="form-input text-[12px]"
              value={(data.classes ?? []).join(", ")}
              onChange={(e) =>
                onChangeData({
                  classes: e.target.value
                    .split(",")
                    .map((c) => c.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        )}

        {isDelay && (
          <div>
            <label className="form-label text-[11px]">Delay (minutes)</label>
            <input
              type="number"
              className="form-input text-[12px]"
              value={data.durationMinutes ?? 10}
              onChange={(e) =>
                onChangeData({
                  durationMinutes: Number(e.target.value) || 0,
                })
              }
            />
          </div>
        )}

        {isWebhook && (
          <>
            <div>
              <label className="form-label text-[11px]">URL</label>
              <input
                className="form-input text-[12px]"
                value={data.url ?? ""}
                onChange={(e) => onChangeData({ url: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label text-[11px]">Method</label>
              <select
                className="form-select text-[12px]"
                value={data.method ?? "POST"}
                onChange={(e) => onChangeData({ method: e.target.value })}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </>
        )}

        {isGroup && (
          <p className="text-[11px] text-slate-400">
            Group nodes are organizational only. They don’t affect execution but help
            structure complex flows.
          </p>
        )}
      </div>
    </div>
  )
}
