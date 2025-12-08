// components/upsell/BuildRequestForm.tsx
'use client'

import { useState, useTransition, FormEvent } from 'react'
import { z } from 'zod'

import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

const BuildRequestSchema = z.object({
  name: z.string().min(1, 'Please enter your name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  size: z.string().optional(),
  projectType: z.string().optional(),
  projectSummary: z.string().min(10, 'Give us at least a few details'),
  automationCount: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : undefined)),
  budgetRange: z.string().optional(),
  timeline: z.string().optional(),
})

export type BuildRequestFormValues = z.infer<typeof BuildRequestSchema>

export interface BuildRequestFormProps {
  workspaceId?: string
  variant?: 'marketing' | 'dashboard'
  className?: string
}

export function BuildRequestForm({
  workspaceId,
  variant = 'marketing',
  className,
}: BuildRequestFormProps) {
  const [values, setValues] = useState<BuildRequestFormValues>({
    name: '',
    email: '',
    phone: '',
    company: '',
    website: '',
    size: '',
    projectType: '',
    projectSummary: '',
    automationCount: undefined,
    budgetRange: '',
    timeline: '',
  })

  const [errors, setErrors] = useState<
    Partial<Record<keyof BuildRequestFormValues, string>>
  >({})
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleChange =
    (field: keyof BuildRequestFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value
      setValues((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))
      setFormError(null)
      setSuccess(null)
    }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSuccess(null)

    const parsed = BuildRequestSchema.safeParse(values)
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof BuildRequestFormValues, string>> =
        {}
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as keyof BuildRequestFormValues
        if (!fieldErrors[path]) {
          fieldErrors[path] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/upsell/request-build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...values,
            automationCount: values.automationCount ?? undefined,
            workspaceId,
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || 'Something went wrong')
        }

        setSuccess(
          variant === 'marketing'
            ? 'Got it — we’ll review your project and reach out shortly.'
            : 'Request sent — our team will follow up with you about this build.',
        )
        setValues({
          name: '',
          email: '',
          phone: '',
          company: '',
          website: '',
          size: '',
          projectType: '',
          projectSummary: '',
          automationCount: undefined,
          budgetRange: '',
          timeline: '',
        })
      } catch (err: any) {
        setFormError(err.message || 'Failed to submit request')
      }
    })
  }

  const labelClass =
    'text-[11px] font-medium text-slate-300 flex items-center justify-between gap-2'
  const inputHelpClass = 'text-[11px] text-slate-500'
  const errorClass = 'mt-1 text-[11px] text-rose-400'

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'space-y-4 rounded-2xl border border-slate-800/80 bg-slate-950/90 p-4 shadow-sm shadow-slate-950/40',
        className,
      )}
    >
      {/* Header / context */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge size="xs" variant="blue">
            DFY Build
          </Badge>
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Step 1 — Tell us about your system
          </span>
        </div>
        <p className="text-sm font-medium text-slate-50">
          {variant === 'marketing'
            ? 'Share what you want Skillify to build for your business.'
            : 'Describe the automation system you want us to build inside this workspace.'}
        </p>
        <p className="text-[11px] text-slate-500">
          The more detail you give us, the better we can scope timelines and
          pricing.
        </p>
      </div>

      {/* Name + Email */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelClass}>
            Name
            <span className="text-[10px] text-slate-500">Required</span>
          </label>
          <Input
            value={values.name}
            onChange={handleChange('name')}
            placeholder="Jane Doe"
            className="h-8 text-[12px]"
          />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Email</label>
          <Input
            type="email"
            value={values.email}
            onChange={handleChange('email')}
            placeholder="you@company.com"
            className="h-8 text-[12px]"
          />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>
      </div>

      {/* Company / Website */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelClass}>Company</label>
          <Input
            value={values.company ?? ''}
            onChange={handleChange('company')}
            placeholder="Acme Inc."
            className="h-8 text-[12px]"
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Website</label>
          <Input
            value={values.website ?? ''}
            onChange={handleChange('website')}
            placeholder="https://your-site.com"
            className="h-8 text-[12px]"
          />
        </div>
      </div>

      {/* Size / Phone */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelClass}>Team size</label>
          <Input
            value={values.size ?? ''}
            onChange={handleChange('size')}
            placeholder="e.g. 3–10, 50+, etc."
            className="h-8 text-[12px]"
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Phone (optional)</label>
          <Input
            value={values.phone ?? ''}
            onChange={handleChange('phone')}
            placeholder="+1 555 123 4567"
            className="h-8 text-[12px]"
          />
        </div>
      </div>

      {/* Project type / automation count */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelClass}>Project type</label>
          <Input
            value={values.projectType ?? ''}
            onChange={handleChange('projectType')}
            placeholder="New build, migration, full revamp…"
            className="h-8 text-[12px]"
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Approx. # of automations</label>
          <Input
            type="number"
            min={1}
            max={500}
            value={values.automationCount?.toString() ?? ''}
            onChange={handleChange('automationCount')}
            placeholder="e.g. 5, 12, 30"
            className="h-8 text-[12px]"
          />
          <p className={inputHelpClass}>Rough estimate is fine.</p>
        </div>
      </div>

      {/* Budget / timeline */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelClass}>Budget range</label>
          <Input
            value={values.budgetRange ?? ''}
            onChange={handleChange('budgetRange')}
            placeholder="$3k–$7k, $10k+, etc."
            className="h-8 text-[12px]"
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Timeline</label>
          <Input
            value={values.timeline ?? ''}
            onChange={handleChange('timeline')}
            placeholder="ASAP, 30–60 days, this quarter…"
            className="h-8 text-[12px]"
          />
        </div>
      </div>

      {/* Project Summary */}
      <div className="space-y-1.5">
        <label className={labelClass}>
          What do you want Skillify to build?
          <span className="text-[10px] text-slate-500">Min 10 characters</span>
        </label>
        <Textarea
          value={values.projectSummary}
          onChange={handleChange('projectSummary')}
          rows={5}
          className="resize-none text-[12px]"
          placeholder="Describe your current tools, where leads come from, what you want automated, and the outcome you care about..."
        />
        {errors.projectSummary && (
          <p className={errorClass}>{errors.projectSummary}</p>
        )}
      </div>

      {/* Status */}
      {(formError || success) && (
        <div
          className={cn(
            'rounded-md border px-3 py-2 text-[11px]',
            formError
              ? 'border-rose-500/50 bg-rose-950/40 text-rose-100'
              : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-100',
          )}
        >
          {formError || success}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-slate-500">
          We’ll review your request and reply with options for scope, pricing,
          and timeline.
        </p>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Sending…' : 'Send build request'}
        </Button>
      </div>
    </form>
  )
}
