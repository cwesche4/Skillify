'use client'

import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { PublicEstimateDto } from '@/lib/estimates/customerExperience'

type DetailedPublicEstimate = Exclude<
  PublicEstimateDto,
  { state: 'REPLACED' | 'UNAVAILABLE' }
>

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
  }).format(cents / 100)
}

function addressLines(address: {
  line1: string | null
  line2: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  country: string | null
}) {
  return [
    address.line1,
    address.line2,
    [address.city, address.region, address.postalCode]
      .filter(Boolean)
      .join(', '),
    address.country,
  ].filter(Boolean) as string[]
}

export function PublicEstimateClient({
  publicId,
  initialEstimate,
}: {
  publicId: string
  initialEstimate: PublicEstimateDto
}) {
  const [estimate, setEstimate] = useState(initialEstimate)
  const [decision, setDecision] = useState<'ACCEPTED' | 'DECLINED' | null>(null)
  const [name, setName] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  if (estimate.state === 'REPLACED' || estimate.state === 'UNAVAILABLE') {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-12 sm:px-6">
        <section className="border-app w-full rounded-2xl border bg-white p-6 shadow-sm sm:p-10">
          <p className="text-sm font-medium text-brand-primary">
            {estimate.businessDisplayName}
          </p>
          <h1 className="text-app-primary mt-3 text-2xl font-semibold">
            Estimate unavailable
          </h1>
          <p className="text-app-muted mt-3">{estimate.message}</p>
        </section>
      </main>
    )
  }

  const detailedEstimate = estimate as DetailedPublicEstimate

  const oneTime = detailedEstimate.lineItems.filter(
    (line) => line.billingBasis === 'ONE_TIME',
  )
  const perVisit = detailedEstimate.lineItems.filter(
    (line) => line.billingBasis === 'PER_VISIT',
  )

  async function submitDecision() {
    if (!decision) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/public/estimates/${encodeURIComponent(publicId)}/decision`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            acknowledgmentName: name,
            declineReason: decision === 'DECLINED' ? reason || null : null,
            declineNote: decision === 'DECLINED' ? note || null : null,
            csrfToken: detailedEstimate.csrfToken,
          }),
        },
      )
      const body = (await response.json().catch(() => null)) as {
        estimate?: PublicEstimateDto
        message?: string
      } | null
      if (!response.ok || !body?.estimate) {
        throw new Error(
          body?.message || 'Your decision could not be recorded. Try again.',
        )
      }
      setEstimate(body.estimate)
      setDecision(null)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Your decision could not be recorded.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <article className="border-app overflow-hidden rounded-2xl border bg-white shadow-sm">
        <header className="border-app border-b p-6 sm:p-8">
          <p className="text-sm font-semibold text-brand-primary">
            {detailedEstimate.business.displayName}
          </p>
          <h1 className="text-app-primary mt-2 text-2xl font-semibold sm:text-3xl">
            {detailedEstimate.title}
          </h1>
          <p className="text-app-muted mt-2 text-sm">
            Estimate {detailedEstimate.referenceNumber} · Revision{' '}
            {detailedEstimate.revisionNumber}
          </p>
          {detailedEstimate.contactDisplayName ? (
            <p className="text-app-muted mt-1 text-sm">
              Prepared for {detailedEstimate.contactDisplayName}
            </p>
          ) : null}
        </header>

        <div className="space-y-8 p-6 sm:p-8">
          {detailedEstimate.message ? (
            <Alert
              variant={
                detailedEstimate.state === 'ACCEPTED'
                  ? 'success'
                  : detailedEstimate.state === 'EXPIRED'
                    ? 'warning'
                    : 'info'
              }
            >
              {detailedEstimate.message}
            </Alert>
          ) : null}

          {detailedEstimate.scopeDescription ? (
            <section aria-labelledby="estimate-scope">
              <h2 id="estimate-scope" className="text-app-primary font-medium">
                Proposed work
              </h2>
              <p className="text-app-muted mt-2 whitespace-pre-wrap text-sm">
                {detailedEstimate.scopeDescription}
              </p>
            </section>
          ) : null}

          {oneTime.length ? (
            <PricingSection
              id="one-time-services"
              title="One-time services"
              lines={oneTime}
              subtotal={detailedEstimate.oneTimeSubtotalCents}
              currency={detailedEstimate.currency}
              subtotalLabel="One-time subtotal"
            />
          ) : null}

          {perVisit.length ? (
            <PricingSection
              id="per-visit-services"
              title="Per-visit services"
              lines={perVisit}
              subtotal={detailedEstimate.recurringPerVisitSubtotalCents}
              currency={detailedEstimate.currency}
              subtotalLabel="Per-visit subtotal"
            />
          ) : null}

          <section className="border-app grid gap-4 border-t pt-6 text-sm sm:grid-cols-2">
            <div>
              <h2 className="text-app-primary font-medium">Expiration</h2>
              <p className="text-app-muted mt-1">
                {detailedEstimate.expiresOn || 'No expiration date'}
              </p>
            </div>
            {detailedEstimate.serviceAddress ? (
              <div>
                <h2 className="text-app-primary font-medium">
                  Service location
                </h2>
                <p className="text-app-muted mt-1 whitespace-pre-line">
                  {addressLines(detailedEstimate.serviceAddress).join('\n')}
                </p>
              </div>
            ) : null}
          </section>

          {detailedEstimate.canAccept && detailedEstimate.canDecline ? (
            <section
              aria-labelledby="estimate-response"
              className="border-app border-t pt-6"
            >
              <h2
                id="estimate-response"
                className="text-app-primary font-medium"
              >
                Your response
              </h2>
              <p className="text-app-muted mt-1 text-sm">
                Review the complete estimate before recording your final choice.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button
                  className="min-h-11 flex-1"
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => setDecision('ACCEPTED')}
                >
                  Accept estimate
                </Button>
                <Button
                  className="min-h-11 flex-1"
                  variant="outline"
                  leftIcon={<XCircle className="h-4 w-4" />}
                  onClick={() => setDecision('DECLINED')}
                >
                  Decline estimate
                </Button>
              </div>
            </section>
          ) : null}

          {decision ? (
            <section
              aria-labelledby="decision-confirmation"
              className="border-app rounded-xl border p-4 sm:p-5"
            >
              <h2
                id="decision-confirmation"
                className="text-app-primary font-medium"
              >
                Confirm your decision
              </h2>
              <p className="text-app-muted mt-1 text-sm">
                You are choosing to{' '}
                {decision === 'ACCEPTED' ? 'accept' : 'decline'} this exact
                estimate revision. This records commercial approval only; the
                business will coordinate any next steps.
              </p>
              {error ? (
                <div ref={errorRef} tabIndex={-1} className="mt-4 outline-none">
                  <Alert variant="error">{error}</Alert>
                </div>
              ) : null}
              <label
                htmlFor="estimate-acknowledgment-name"
                className="text-app-primary mt-4 block text-sm font-medium"
              >
                Your name
              </label>
              <Input
                id="estimate-acknowledgment-name"
                className="mt-1 min-h-11"
                value={name}
                maxLength={200}
                required
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
              />
              {decision === 'DECLINED' ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <label
                      htmlFor="estimate-decline-reason"
                      className="text-app-primary block text-sm font-medium"
                    >
                      Reason (optional)
                    </label>
                    <Select
                      id="estimate-decline-reason"
                      className="mt-1 min-h-11"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    >
                      <option value="">Choose a reason</option>
                      <option value="PRICE">Price</option>
                      <option value="TIMING">Timing</option>
                      <option value="SCOPE">Scope</option>
                      <option value="OTHER">Other</option>
                    </Select>
                  </div>
                  <div>
                    <label
                      htmlFor="estimate-decline-note"
                      className="text-app-primary block text-sm font-medium"
                    >
                      Note (optional)
                    </label>
                    <Textarea
                      id="estimate-decline-note"
                      className="mt-1"
                      value={note}
                      maxLength={1000}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  className="min-h-11"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => {
                    setDecision(null)
                    setError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="min-h-11"
                  variant={decision === 'DECLINED' ? 'danger' : 'primary'}
                  loading={submitting}
                  disabled={!name.trim()}
                  onClick={() => void submitDecision()}
                >
                  Confirm {decision === 'ACCEPTED' ? 'acceptance' : 'decline'}
                </Button>
              </div>
            </section>
          ) : null}

          <footer className="border-app text-app-muted border-t pt-6 text-xs">
            Contact {detailedEstimate.business.displayName}
            {detailedEstimate.business.phone
              ? ` at ${detailedEstimate.business.phone}`
              : ''}{' '}
            with questions about this estimate.
          </footer>
        </div>
      </article>
    </main>
  )
}

function PricingSection({
  id,
  title,
  lines,
  subtotal,
  currency,
  subtotalLabel,
}: {
  id: string
  title: string
  lines: Array<{
    title: string
    description: string | null
    amountCents: number
  }>
  subtotal: number
  currency: string
  subtotalLabel: string
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-app-primary font-medium">
        {title}
      </h2>
      <div className="border-app mt-3 divide-y overflow-hidden rounded-xl border">
        {lines.map((line, index) => (
          <div
            key={`${line.title}:${index}`}
            className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
          >
            <div>
              <p className="text-app-primary text-sm font-medium">
                {line.title}
              </p>
              {line.description ? (
                <p className="text-app-muted mt-1 text-sm">
                  {line.description}
                </p>
              ) : null}
            </div>
            <p className="text-app-primary shrink-0 text-sm font-medium">
              {money(line.amountCents, currency)}
              {title === 'Per-visit services' ? ' per visit' : ''}
            </p>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 bg-gray-50 p-4 text-sm">
          <span className="text-app-muted">{subtotalLabel}</span>
          <strong className="text-app-primary">
            {money(subtotal, currency)}
            {title === 'Per-visit services' ? ' per visit' : ''}
          </strong>
        </div>
      </div>
    </section>
  )
}
