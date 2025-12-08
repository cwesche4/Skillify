// components/upsell/UpsellDFYModal.tsx
'use client'

import { useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { requestMicroUpsell } from '@/lib/upsell/client'

interface UpsellDFYModalProps {
  open: boolean
  onClose: () => void
  workspaceId: string
  automationId?: string
  feature: string
}

export function UpsellDFYModal({
  open,
  onClose,
  workspaceId,
  automationId,
  feature,
}: UpsellDFYModalProps) {
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!open) return null

  const onSubmit = async () => {
    setError(null)
    setSuccess(false)
    if (!details.trim()) {
      setError('Please describe what you want us to build.')
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
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl border border-sky-500/40 bg-slate-950 p-5 shadow-2xl shadow-sky-900/40">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15">
              <Sparkles className="h-4 w-4 text-sky-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-50">
                Done-For-You help
              </h2>
              <p className="text-[11px] text-slate-400">
                Tell us what you want this automation to do. We&apos;ll build or
                fix it for you.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Example: Build a full lead nurture flow that connects our forms, CRM, and email tool."
          className="mb-3 min-h-[100px] text-xs"
        />

        {error && <p className="mb-2 text-[11px] text-rose-400">{error}</p>}
        {success && (
          <p className="mb-2 text-[11px] text-emerald-400">
            Request sent! We&apos;ll email you with next steps.
          </p>
        )}

        <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
          <span>Most DFY builds are delivered in a few days.</span>
          <Button
            size="sm"
            variant="primary"
            onClick={onSubmit}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Submit request'}
          </Button>
        </div>
      </div>
    </div>
  )
}
