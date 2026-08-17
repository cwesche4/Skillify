// components/upsell/UpsellMicroCard.tsx
'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Textarea'
import { requestMicroUpsell } from '@/lib/upsell/client'

interface UpsellMicroCardProps {
  workspaceId: string
  automationId?: string
  feature: string
  title?: string
  description?: string
  priceHint?: string
  disabled?: boolean
  disabledReason?: string
}

export function UpsellMicroCard({
  workspaceId,
  automationId,
  feature,
  title = 'Need us to finish this for you?',
  description = 'Describe what you want us to set up or fix. Our team will jump in and build it for you.',
  priceHint = 'Most micro-builds are in the $49–$199 range.',
  disabled = false,
  disabledReason,
}: UpsellMicroCardProps) {
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async () => {
    if (disabled) return
    setError(null)
    setSuccess(false)

    if (!details.trim()) {
      const msg = 'Please tell us what you want help with.'
      setError(msg)
      toast.error(msg)
      return
    }

    setLoading(true)
    try {
      await requestMicroUpsell({
        workspaceId,
        automationId,
        feature,
        description: details,
      })

      setSuccess(true)
      setDetails('')

      toast.success("Request sent! We'll reach out by email shortly.")
    } catch (err: any) {
      const msg = err?.message ?? 'Something went wrong sending your request.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-status-info-surface space-y-3 border border-sky-500/30 p-4 shadow-lg shadow-sky-200/35 dark:shadow-sky-900/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/15">
              <Sparkles className="h-3.5 w-3.5 text-sky-700 dark:text-sky-300" />
            </span>
            <h3 className="text-app-primary text-sm font-semibold">{title}</h3>
          </div>
          <p className="text-app-secondary text-[11px]">{description}</p>
        </div>
        <Badge size="xs" variant="blue">
          Done-For-You
        </Badge>
      </div>

      {disabled && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-200">
          {disabledReason ?? 'Upgrade to request this service.'}
        </div>
      )}

      <Textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Example: Connect this flow to my CRM, add a lead scoring step, and create a follow-up email sequence."
        className="min-h-[80px] text-xs"
        disabled={disabled}
      />

      <div className="text-app-secondary flex items-center justify-between gap-3 text-[11px]">
        <span>{priceHint}</span>
        <Button
          size="sm"
          variant="primary"
          onClick={onSubmit}
          disabled={loading || disabled}
        >
          {loading ? 'Sending...' : 'Request build help'}
        </Button>
      </div>

      {error && (
        <p className="text-[11px] text-rose-700 dark:text-rose-400">{error}</p>
      )}
      {success && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
          Request sent! We&apos;ll reach out by email shortly with next steps.
        </p>
      )}
    </Card>
  )
}
