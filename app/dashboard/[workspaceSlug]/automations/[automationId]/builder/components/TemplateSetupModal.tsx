// Lightweight template setup modal (no persistence). Gated by plan via caller.
'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { CRMTemplate } from '@/lib/integrations/templates'

type IntegrationOption = { id: string; provider: string; status: string }

interface TemplateSetupModalProps {
  open: boolean
  template: CRMTemplate | null
  workspaceId: string
  plan: 'basic' | 'pro' | 'elite'
  onCancel: () => void
  onConfirm: (config: Record<string, any>) => void
}

export default function TemplateSetupModal({
  open,
  template,
  workspaceId,
  onCancel,
  onConfirm,
}: TemplateSetupModalProps) {
  const [integrations, setIntegrations] = useState<IntegrationOption[]>([])
  const [loading, setLoading] = useState(false)
  const [integrationId, setIntegrationId] = useState('')
  const [lifecycleStage, setLifecycleStage] = useState('lead')
  const [dealId, setDealId] = useState('')
  const [targetStage, setTargetStage] = useState('closedwon')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/integrations`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('Failed to load integrations')
        const json = await res.json()
        if (!cancelled) {
          setIntegrations(json.integrations ?? [])
          if (json.integrations?.[0]) setIntegrationId(json.integrations[0].id)
        }
      } catch {
        if (!cancelled) setIntegrations([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, workspaceId])

  useEffect(() => {
    if (!open) {
      setIntegrationId('')
      setLifecycleStage('lead')
      setDealId('')
      setTargetStage('closedwon')
    }
  }, [open])

  const tplId = template?.id ?? ''
  const isContactSync = tplId === 'hubspot-sync-contacts'
  const isDealUpdate = tplId === 'hubspot-update-deal-on-success'

  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      title={template ? `Setup: ${template.name}` : 'Setup CRM template'}
      description="Fill required fields; nothing will be saved until you insert the template."
      size="md"
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-slate-300">
            Integration
          </p>
          <Select
            value={integrationId}
            onValueChange={(v) => setIntegrationId(v)}
            disabled={loading || integrations.length === 0}
          >
            {integrations.map((i) => (
              <option key={i.id} value={i.id}>
                {i.provider} • {i.status}
              </option>
            ))}
            {integrations.length === 0 && (
              <option value="">No integrations</option>
            )}
          </Select>
        </div>

        {isContactSync && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-slate-300">
              Lifecycle stage
            </p>
            <Input
              value={lifecycleStage}
              onChange={(e) => setLifecycleStage(e.target.value)}
              placeholder="lead / opportunity / customer"
            />
          </div>
        )}

        {isDealUpdate && (
          <>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-slate-300">
                Deal ID
              </p>
              <Input
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                placeholder="HubSpot deal ID"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-slate-300">
                Target stage
              </p>
              <Input
                value={targetStage}
                onChange={(e) => setTargetStage(e.target.value)}
                placeholder="example: closedwon"
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="subtle" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!integrationId}
            onClick={() =>
              onConfirm({
                integrationId,
                lifecycleStage,
                dealId,
                targetStage,
              })
            }
          >
            Insert template
          </Button>
        </div>
      </div>
    </Modal>
  )
}
