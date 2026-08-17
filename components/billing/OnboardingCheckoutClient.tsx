'use client'

import React from 'react'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TicketPercent } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import {
  DEFAULT_TRIAL_DAYS,
  PAYMENT_METHOD_REQUIRED_DURING_TRIAL,
  formatPlanPrice,
  getBillingPlan,
  type BillingPlanId,
} from '@/lib/billing/plans'
import { normalizeAccessCode } from '@/lib/billing/accessCodes'
import { cn } from '@/lib/utils'

type AppliedCode = {
  message: string
  trialDays: number
  paymentMethodRequired: boolean
  complimentaryEndsAt?: string | null
}

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

function formatBillingDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function OnboardingCheckoutClient({
  selectedPlan,
}: {
  selectedPlan: BillingPlanId
}) {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-white">
      <div className="mx-auto max-w-5xl">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/75">
            Checkout
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Start your trial
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Skillify records access rules first. Stripe executes billing when a
            payment method is required and configured.
          </p>
        </section>
        <OnboardingCheckoutPanel selectedPlan={selectedPlan} className="mt-6" />
      </div>
    </main>
  )
}

export function OnboardingCheckoutPanel({
  selectedPlan,
  className,
}: {
  selectedPlan: BillingPlanId
  className?: string
}) {
  const router = useRouter()
  const plan = useMemo(() => getBillingPlan(selectedPlan), [selectedPlan])
  const [code, setCode] = useState('')
  const [appliedCode, setAppliedCode] = useState<AppliedCode | null>(null)
  const [appliedCodeValue, setAppliedCodeValue] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [applyingCode, setApplyingCode] = useState(false)
  const [starting, setStarting] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const trialDays = appliedCode?.trialDays ?? DEFAULT_TRIAL_DAYS
  const paymentMethodRequired =
    appliedCode?.paymentMethodRequired ?? PAYMENT_METHOD_REQUIRED_DURING_TRIAL
  const normalizedCode = normalizeAccessCode(code)
  const canApplyCode = normalizedCode.length > 0 && !applyingCode
  const appliedCodeMessage = appliedCode?.message.toLowerCase() ?? ''
  const complimentaryAccess = Boolean(
    appliedCode?.complimentaryEndsAt ||
    appliedCodeMessage.includes('complimentary access') ||
    appliedCodeMessage.includes('internal access'),
  )
  const trialEndsAt = useMemo(() => addDays(new Date(), trialDays), [trialDays])
  const trialEndLabel = formatBillingDate(trialEndsAt)
  const complimentaryEndLabel = formatBillingDate(
    appliedCode?.complimentaryEndsAt,
  )
  const canStartTrial = acceptedTerms && !starting && !applyingCode

  async function applyCode() {
    if (!normalizedCode || applyingCode) return
    setApplyingCode(true)
    setCodeError(null)
    setAppliedCode(null)
    setAppliedCodeValue(null)
    try {
      const response = await fetch('/api/billing/access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode, plan: plan.id }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(
          data.error || 'That code is invalid or no longer available.',
        )
      setAppliedCode(data.access)
      setAppliedCodeValue(normalizedCode)
    } catch (error) {
      setCodeError(
        error instanceof Error
          ? error.message
          : 'That code is invalid or no longer available.',
      )
    } finally {
      setApplyingCode(false)
    }
  }

  async function startTrial() {
    if (!canStartTrial) return
    setStarting(true)
    setSubmitError(null)
    try {
      const response = await fetch('/api/billing/checkout/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: plan.id,
          code: appliedCode ? appliedCodeValue : null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not start trial.')
      router.push(data.next ?? '/onboarding/create-workspace')
      router.refresh()
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Could not start trial.',
      )
    } finally {
      setStarting(false)
    }
  }

  return (
    <section
      aria-label="Checkout"
      className={cn(
        'grid gap-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.035] p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_340px]',
        className,
      )}
    >
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/75">
          Checkout
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
          Start your {plan.name} trial
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Review your trial, optional access code, and payment-method
          requirement before continuing.
        </p>

        <Card className="mt-6 p-5">
          <h2 className="text-base font-semibold text-white">Access code</h2>
          <p className="mt-1 text-sm text-slate-400">
            Codes can adjust trial length, discounts, or complimentary access.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              value={code}
              onChange={(event) => {
                const nextCode = event.target.value
                setCode(nextCode)
                setCodeError(null)
                if (
                  appliedCodeValue &&
                  normalizeAccessCode(nextCode) !== appliedCodeValue
                ) {
                  setAppliedCode(null)
                  setAppliedCodeValue(null)
                }
              }}
              placeholder="Enter access code"
              className="uppercase"
            />
            <Button
              type="button"
              variant={canApplyCode ? 'primary' : 'secondary'}
              className={cn(
                'shrink-0',
                canApplyCode &&
                  'border-brand-primary/80 hover:bg-brand-primary/90 bg-brand-primary text-white',
              )}
              loading={applyingCode}
              disabled={!canApplyCode}
              onClick={applyCode}
            >
              Apply
            </Button>
          </div>
          {appliedCode ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">
              <TicketPercent className="h-4 w-4" />
              {appliedCode.message}
            </p>
          ) : null}
          {codeError ? (
            <p className="mt-3 text-sm text-rose-300">{codeError}</p>
          ) : null}
        </Card>
      </section>

      <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-base font-semibold text-white">Summary</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Plan</dt>
            <dd className="text-white">{plan.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Today</dt>
            <dd className="text-white">$0</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Trial</dt>
            <dd className="text-white">{trialDays} days</dd>
          </div>
          {complimentaryAccess ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Complimentary through</dt>
              <dd className="text-right text-white">
                {complimentaryEndLabel ?? 'Active access'}
              </dd>
            </div>
          ) : (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Billing starts</dt>
                <dd className="text-right text-white">{trialEndLabel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Cancel before</dt>
                <dd className="text-right text-white">{trialEndLabel}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">After trial</dt>
            <dd className="text-white">
              {formatPlanPrice(plan.monthlyPriceCents)}/mo
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Payment method</dt>
            <dd className="text-right text-white">
              {paymentMethodRequired ? 'Required' : 'Not required'}
            </dd>
          </div>
        </dl>
        <label className="mt-5 flex gap-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm leading-6 text-slate-300">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-950 text-cyan-300 focus:ring-2 focus:ring-cyan-300/70 focus:ring-offset-2 focus:ring-offset-slate-950"
          />
          <span>
            I agree to the{' '}
            <Link
              href="/marketing/terms"
              className="font-medium text-cyan-100 underline decoration-cyan-100/40 underline-offset-2 hover:text-cyan-50"
            >
              Terms of Service
            </Link>
            {' and '}
            <Link
              href="/marketing/privacy"
              className="font-medium text-cyan-100 underline decoration-cyan-100/40 underline-offset-2 hover:text-cyan-50"
            >
              Privacy Policy
            </Link>
            {complimentaryAccess
              ? ' and understand that this complimentary access does not automatically begin paid billing.'
              : ` and understand that my selected plan will begin billing after the ${trialDays}-day free trial unless I cancel before the trial ends.`}
          </span>
        </label>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {complimentaryAccess
            ? 'Paid billing can be configured later if you choose to continue on a paid plan.'
            : 'Cancel before the trial ends to avoid being charged.'}
        </p>
        {submitError ? (
          <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {submitError}
          </p>
        ) : null}
        <Button
          type="button"
          className={cn(
            'mt-5 w-full border-cyan-100/70 bg-cyan-50 text-slate-950 shadow-lg shadow-cyan-500/15 hover:bg-white',
            !canStartTrial &&
              'border-white/10 bg-white/[0.08] text-white/45 shadow-none hover:bg-white/[0.08]',
          )}
          loading={starting}
          disabled={!canStartTrial}
          onClick={startTrial}
        >
          Start Free Trial
        </Button>
      </aside>
    </section>
  )
}
