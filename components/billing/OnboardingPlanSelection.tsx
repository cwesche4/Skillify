'use client'

import React, { useRef, useState } from 'react'
import { CheckCircle2, ChevronDown } from 'lucide-react'

import { Card } from '@/components/ui/Card'
import { OnboardingCheckoutPanel } from '@/components/billing/OnboardingCheckoutClient'
import {
  BILLING_PLANS,
  DEFAULT_TRIAL_DAYS,
  formatPlanPrice,
  type BillingPlanId,
} from '@/lib/billing/plans'
import { cn } from '@/lib/utils'

export function OnboardingPlanSelection() {
  const [selectedPlanId, setSelectedPlanId] = useState<BillingPlanId | null>(
    null,
  )
  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<BillingPlanId>>(
    () => new Set(),
  )
  const checkoutRef = useRef<HTMLDivElement | null>(null)

  function selectPlan(planId: BillingPlanId) {
    setSelectedPlanId(planId)
    const scrollToCheckout = () => {
      checkoutRef.current?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'start',
      })
    }
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(scrollToCheckout)
    } else {
      scrollToCheckout()
    }
  }

  function togglePlanDetails(planId: BillingPlanId) {
    setExpandedPlanIds((current) => {
      const next = new Set(current)
      if (next.has(planId)) {
        next.delete(planId)
      } else {
        next.add(planId)
      }
      return next
    })
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/75">
            Skillify onboarding
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Choose your plan
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Start with a {DEFAULT_TRIAL_DAYS}-day trial. You will create your
            first business workspace after access is activated.
          </p>
        </section>

        <section className="mt-8 grid items-start gap-4 md:grid-cols-3">
          {BILLING_PLANS.map((plan) => {
            const selected = selectedPlanId === plan.id
            const expanded = expandedPlanIds.has(plan.id)

            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative flex flex-col self-start p-5 transition',
                  selected
                    ? 'border-cyan-300/65 bg-cyan-300/[0.06] shadow-cyan-500/10'
                    : 'hover:border-slate-700',
                  plan.recommended && !selected
                    ? 'border-indigo-300/40 shadow-indigo-950/40'
                    : null,
                )}
              >
                {plan.recommended ? (
                  <span className="absolute right-4 top-4 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-xs font-medium text-cyan-100">
                    Most Popular
                  </span>
                ) : null}
                <div className="flex-1">
                  <h2 className="pr-28 text-lg font-semibold text-white">
                    {plan.name}
                  </h2>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {formatPlanPrice(plan.monthlyPriceCents)}
                    <span className="text-sm font-medium text-slate-400">
                      {' '}
                      /mo
                    </span>
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {plan.audience}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    $0 today. Billing begins after the trial unless access rules
                    or a valid code change that behavior.
                  </p>
                  <ul className="mt-5 space-y-3 text-sm text-slate-300">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {expanded ? (
                    <ul className="mt-3 space-y-2 border-t border-white/10 pt-3 text-sm text-slate-400">
                      {plan.expandedFeatures.map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => togglePlanDetails(plan.id)}
                  className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {expanded ? 'Less' : 'See full features'}
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition',
                      expanded && 'rotate-180',
                    )}
                  />
                </button>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectPlan(plan.id)}
                  className={cn(
                    'focus-visible:ring-brand-primary/70 mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl border px-3.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                    selected
                      ? 'border-cyan-300/70 bg-cyan-300/15 text-cyan-50'
                      : 'border-brand-primary/80 hover:bg-brand-primary/90 bg-brand-primary text-white',
                  )}
                >
                  {selected
                    ? `${plan.name} selected`
                    : `Continue with ${plan.name}`}
                </button>
              </Card>
            )
          })}
        </section>

        {selectedPlanId ? (
          <div ref={checkoutRef} className="scroll-mt-8">
            <OnboardingCheckoutPanel
              selectedPlan={selectedPlanId}
              className="mt-8"
            />
          </div>
        ) : null}
      </div>
    </main>
  )
}
