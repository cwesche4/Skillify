// components/upsell/UpsellEnterpriseConsult.tsx
'use client'

import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { toast } from 'sonner'

import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { requestEnterpriseConsult } from '@/lib/upsell/client'

interface UpsellEnterpriseConsultProps {
  workspaceId: string
  defaultEmail?: string
}

export function UpsellEnterpriseConsult({
  workspaceId,
  defaultEmail,
}: UpsellEnterpriseConsultProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [phone, setPhone] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [projectGoal, setProjectGoal] = useState('')
  const [description, setDescription] = useState('')

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!name.trim() || !email.trim() || !description.trim()) {
      const msg = 'Name, email and description are required.'
      setError(msg)
      toast.error(msg)
      return
    }

    setLoading(true)
    try {
      await requestEnterpriseConsult({
        workspaceId,
        name,
        email,
        phone: phone || undefined,
        companySize: companySize || undefined,
        projectGoal: projectGoal || undefined,
        description,
      })

      setSuccess(true)
      toast.success(
        'Enterprise consult request submitted! We will follow up shortly.',
      )

      // Optionally reset some fields (keep name/email if you want)
      setDescription('')
    } catch (err: any) {
      const msg =
        err?.message ?? 'Something went wrong submitting your request.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="space-y-4 border border-purple-500/40 bg-slate-950/80 p-5 shadow-xl shadow-purple-900/40">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15">
          <Building2 className="h-4 w-4 text-purple-300" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-50">
            Need a full build-out?
          </h2>
          <p className="text-[11px] text-slate-400">
            Tell us about your automation project. We&apos;ll review your
            request, audit your current flows, and come back with a concrete
            proposal.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3 text-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="enterprise-name">Your name</Label>
            <Input
              id="enterprise-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Johnson"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="enterprise-email">Work email</Label>
            <Input
              id="enterprise-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="enterprise-phone">Phone (optional)</Label>
            <Input
              id="enterprise-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="enterprise-size">Company size</Label>
            <Input
              id="enterprise-size"
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              placeholder="e.g. 10–50, 50–200, 200+"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="enterprise-goal">Main goal</Label>
          <Input
            id="enterprise-goal"
            value={projectGoal}
            onChange={(e) => setProjectGoal(e.target.value)}
            placeholder="Example: Automate lead intake, scoring, and follow-up across our stack."
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="enterprise-description">Project details</Label>
          <Textarea
            id="enterprise-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What systems do you use today? What are the biggest bottlenecks? Where do you want to be in 90 days?"
            className="min-h-[120px]"
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 text-[11px] text-slate-400">
          <span>We&apos;ll respond within 1–2 business days.</span>
          <Button type="submit" size="sm" variant="primary" disabled={loading}>
            {loading ? 'Submitting...' : 'Request enterprise consult'}
          </Button>
        </div>

        {error && <p className="text-[11px] text-rose-400">{error}</p>}
        {success && (
          <p className="text-[11px] text-emerald-400">
            Request received! We&apos;ll reach out with next steps.
          </p>
        )}
      </form>
    </Card>
  )
}
