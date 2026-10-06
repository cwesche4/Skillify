import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OnboardingCheckoutClient } from '@/components/billing/OnboardingCheckoutClient'
import { OnboardingPlanSelection } from '@/components/billing/OnboardingPlanSelection'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import {
  SKILLIFY_CATEGORY_DESCRIPTOR,
  SKILLIFY_SHORT_TAGLINE,
} from '@/lib/branding/brandMessaging'
import {
  hasActiveSubscriptionAccess,
  resolveOnboardingAccessState,
} from '@/lib/billing/onboardingAccess'
import {
  resolveAccessCode,
  resolveDefaultAccess,
} from '@/lib/billing/accessCodes'
import { resolveCheckoutExecutionMode } from '@/lib/billing/stripeClient'
import { BILLING_PLANS } from '@/lib/billing/plans'
import {
  AccessCodeType,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@/lib/prisma/enums'

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}))

const prismaMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  workspaceFindFirst: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => routerMocks,
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: {
      findUnique: prismaMocks.findUnique,
      create: prismaMocks.create,
      update: prismaMocks.update,
    },
    workspace: {
      findFirst: prismaMocks.workspaceFindFirst,
    },
  },
}))

describe('onboarding and billing access foundation', () => {
  const now = new Date('2026-08-13T12:00:00.000Z')

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/billing/access-code')) {
        return {
          ok: true,
          json: async () => ({
            access: {
              message: '30-day trial applied.',
              trialDays: 30,
              paymentMethodRequired: false,
            },
          }),
        } as Response
      }
      if (url.includes('/api/billing/checkout/start-trial')) {
        return {
          ok: true,
          json: async () => ({ next: '/onboarding/create-workspace' }),
        } as Response
      }
      return { ok: false, json: async () => ({}) } as Response
    })
  })

  it('uses a centralized 14-day default trial', () => {
    const access = resolveDefaultAccess(SubscriptionPlan.Pro)

    expect(access.trialDays).toBe(14)
    expect(access.paymentMethodRequired).toBe(true)
  })

  it('uses centralized launch pricing for Basic, Pro, and Elite', () => {
    expect(
      Object.fromEntries(
        BILLING_PLANS.map((plan) => [plan.name, plan.monthlyPriceCents]),
      ),
    ).toMatchObject({
      Basic: 7900,
      Pro: 17900,
      Elite: 34900,
    })
  })

  it('routes a newly signed-up user with no entitlement to plan selection', () => {
    expect(
      resolveOnboardingAccessState({
        hasUserProfile: true,
        subscription: null,
        workspaceCount: 0,
        now,
      }),
    ).toBe('PLAN_REQUIRED')
  })

  it('routes an entitled user with no workspace to explicit workspace creation', () => {
    expect(
      resolveOnboardingAccessState({
        hasUserProfile: true,
        subscription: {
          status: SubscriptionStatus.trialing,
          trialEndsAt: '2026-08-27T12:00:00.000Z',
        },
        workspaceCount: 0,
        now,
      }),
    ).toBe('WORKSPACE_REQUIRED')
  })

  it('treats active, current trial, and complimentary access as access', () => {
    expect(
      hasActiveSubscriptionAccess({ status: SubscriptionStatus.active }, now),
    ).toBe(true)
    expect(
      hasActiveSubscriptionAccess(
        {
          status: SubscriptionStatus.trialing,
          trialEndsAt: '2026-08-27T12:00:00.000Z',
        },
        now,
      ),
    ).toBe(true)
    expect(
      hasActiveSubscriptionAccess(
        {
          status: SubscriptionStatus.trialing,
          complimentaryEndsAt: '2026-11-11T12:00:00.000Z',
        },
        now,
      ),
    ).toBe(true)
    expect(
      hasActiveSubscriptionAccess(
        {
          status: SubscriptionStatus.trialing,
          complimentaryEndsAt: now,
        },
        now,
      ),
    ).toBe(false)
  })

  it('resolves a BETA30-style trial override without a payment method', () => {
    const access = resolveAccessCode({
      code: 'BETA30',
      selectedPlan: SubscriptionPlan.Pro,
      now,
      record: {
        id: 'code-1',
        code: 'BETA30',
        active: true,
        type: AccessCodeType.TRIAL_EXTENSION,
        plan: SubscriptionPlan.Pro,
        trialDaysOverride: 30,
        paymentMethodRequired: false,
      },
    })

    expect(access.valid).toBe(true)
    expect(access.trialDays).toBe(30)
    expect(access.paymentMethodRequired).toBe(false)
    expect(access.message).toBe('30-day trial applied.')
  })

  it('keeps complimentary access distinct from trial access', () => {
    const access = resolveAccessCode({
      code: 'PARTNERFREE',
      selectedPlan: SubscriptionPlan.Pro,
      now,
      record: {
        id: 'code-2',
        code: 'PARTNERFREE',
        active: true,
        type: AccessCodeType.COMPLIMENTARY_ACCESS,
        complimentaryDays: 90,
        paymentMethodRequired: false,
      },
    })

    expect(access.valid).toBe(true)
    expect(access.trialDays).toBe(14)
    expect(access.complimentaryEndsAt?.toISOString()).toBe(
      '2026-11-11T12:00:00.000Z',
    )
  })

  it('rejects inactive, expired, usage-limited, and plan-restricted codes', () => {
    expect(
      resolveAccessCode({
        code: 'OFF',
        selectedPlan: SubscriptionPlan.Pro,
        now,
        record: {
          id: 'off',
          code: 'OFF',
          active: false,
          type: AccessCodeType.DISCOUNT,
        },
      }).valid,
    ).toBe(false)

    expect(
      resolveAccessCode({
        code: 'OLD',
        selectedPlan: SubscriptionPlan.Pro,
        now,
        record: {
          id: 'old',
          code: 'OLD',
          active: true,
          type: AccessCodeType.DISCOUNT,
          expiresAt: '2026-08-12T12:00:00.000Z',
        },
      }).invalidReason,
    ).toBe('expired')

    expect(
      resolveAccessCode({
        code: 'USED',
        selectedPlan: SubscriptionPlan.Pro,
        now,
        record: {
          id: 'used',
          code: 'USED',
          active: true,
          type: AccessCodeType.DISCOUNT,
          maxUses: 1,
          usesCount: 1,
        },
      }).invalidReason,
    ).toBe('usage_limit')

    expect(
      resolveAccessCode({
        code: 'BASIC',
        selectedPlan: SubscriptionPlan.Pro,
        now,
        record: {
          id: 'basic',
          code: 'BASIC',
          active: true,
          type: AccessCodeType.DISCOUNT,
          plan: SubscriptionPlan.Basic,
        },
      }).invalidReason,
    ).toBe('plan_restricted')
  })

  it('separates Stripe execution from Skillify entitlement rules', () => {
    expect(
      resolveCheckoutExecutionMode({
        planId: SubscriptionPlan.Pro,
        paymentMethodRequired: false,
        env: {},
      }),
    ).toBe('skillify_entitlement_only')

    expect(
      resolveCheckoutExecutionMode({
        planId: SubscriptionPlan.Pro,
        paymentMethodRequired: true,
        env: {},
      }),
    ).toBe('stripe_configuration_required')

    expect(
      resolveCheckoutExecutionMode({
        planId: SubscriptionPlan.Pro,
        paymentMethodRequired: true,
        env: {
          STRIPE_SECRET_KEY: 'sk_test_x',
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
          STRIPE_PRICE_PRO_MONTHLY: 'price_test',
        },
      }),
    ).toBe('stripe_test_mode_ready')
  })

  it('creates or updates UserProfile without creating a business workspace', async () => {
    const { ensureUserProfileFromClerkIdentity } =
      await import('@/lib/auth/userProfileLifecycle')
    prismaMocks.findUnique.mockResolvedValue(null)
    prismaMocks.create.mockResolvedValue({
      id: 'user-1',
      clerkId: 'clerk-1',
      email: 'corbin@example.com',
      fullName: 'Corbin Wesche',
    })

    await ensureUserProfileFromClerkIdentity({
      clerkId: 'clerk-1',
      firstName: 'Corbin',
      lastName: 'Wesche',
      email: 'corbin@example.com',
    })

    expect(prismaMocks.create).toHaveBeenCalledWith({
      data: {
        clerkId: 'clerk-1',
        role: 'user',
        fullName: 'Corbin Wesche',
        email: 'corbin@example.com',
      },
    })
    expect(prismaMocks.workspaceFindFirst).not.toHaveBeenCalled()
  })

  it('truthfully disables self-service trial and paid access', () => {
    render(
      React.createElement(OnboardingCheckoutClient, { selectedPlan: 'Pro' }),
    )

    expect(
      screen.getByRole('heading', {
        name: 'Self-service billing is unavailable',
      }),
    ).toBeTruthy()
    expect(
      screen.getByText(/no trial or paid entitlement can be activated/i),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Start Free Trial' }),
    ).toBeNull()
    expect(screen.queryByPlaceholderText('Enter access code')).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('selects a plan, keeps it selected, and expands checkout below the cards', async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.fn()
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    render(React.createElement(OnboardingPlanSelection))

    expect(screen.getByText('$79')).toBeTruthy()
    expect(screen.getByText('$179')).toBeTruthy()
    expect(screen.getByText('$349')).toBeTruthy()
    expect(
      screen.getByText(
        /for growing businesses managing more sales, scheduling, workflows, and team activity/i,
      ),
    ).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /continue with pro/i }))

    expect(
      screen
        .getByRole('button', { name: /pro selected/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen.getByRole('heading', {
        name: /self-service billing is unavailable/i,
      }),
    ).toBeTruthy()
    expect(screen.getByText(/pro pilot access/i)).toBeTruthy()
    expect(
      screen.queryByText(/team availability and calendar connections/i),
    ).toBeNull()
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
  })

  it('expands multiple compact plan detail sections without changing selection', async () => {
    const user = userEvent.setup()
    render(React.createElement(OnboardingPlanSelection))

    expect(screen.queryByText(/custom business terminology/i)).toBeNull()
    expect(
      screen.queryByText(/team availability and calendar connections/i),
    ).toBeNull()

    await user.click(
      screen.getAllByRole('button', { name: /see full features/i })[0],
    )

    expect(screen.getByText(/custom business terminology/i)).toBeTruthy()
    expect(
      screen.queryByText(/team availability and calendar connections/i),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: /basic selected/i })).toBeNull()

    await user.click(
      screen.getAllByRole('button', { name: /see full features/i })[0],
    )

    expect(screen.getByText(/custom business terminology/i)).toBeTruthy()
    expect(
      screen.getByText(/team availability and calendar connections/i),
    ).toBeTruthy()

    await user.click(
      screen.getAllByRole('button', { name: /see full features/i })[0],
    )

    expect(screen.getByText(/custom business terminology/i)).toBeTruthy()
    expect(
      screen.getByText(/team availability and calendar connections/i),
    ).toBeTruthy()

    await user.click(screen.getAllByRole('button', { name: /less/i })[1])

    expect(
      screen.queryByText(/team availability and calendar connections/i),
    ).toBeNull()
    expect(screen.getByText(/custom business terminology/i)).toBeTruthy()
  })

  it('does not expose access-code provisioning as a pilot workaround', () => {
    render(
      React.createElement(OnboardingCheckoutClient, { selectedPlan: 'Basic' }),
    )

    expect(screen.queryByPlaceholderText('Enter access code')).toBeNull()
    expect(screen.getByText(/controlled provisioning/i)).toBeTruthy()
  })

  it('keeps the controlled-launch message consistent across paid plans', () => {
    render(
      React.createElement(OnboardingCheckoutClient, { selectedPlan: 'Elite' }),
    )

    expect(screen.getByText(/elite pilot access/i)).toBeTruthy()
    expect(screen.getByText(/no payment has been collected/i)).toBeTruthy()
  })

  it('uses buyer-facing plan copy and keeps Pro marked Most Popular', () => {
    render(React.createElement(OnboardingPlanSelection))

    expect(screen.getByText('Lead and customer management')).toBeTruthy()
    expect(screen.getByText('Jobs and core scheduling')).toBeTruthy()
    expect(screen.getByText('Starter workflow automations')).toBeTruthy()
    expect(screen.getByText('Essential reporting')).toBeTruthy()

    expect(screen.getByText('Everything in Basic')).toBeTruthy()
    expect(screen.getByText('Advanced CRM and scheduling')).toBeTruthy()
    expect(screen.getByText('Visual Workflow Builder')).toBeTruthy()
    expect(screen.getByText('Workspace-aware AI assistant')).toBeTruthy()

    expect(screen.getByText('Everything in Pro')).toBeTruthy()
    expect(screen.getByText('Highest automation and AI capacity')).toBeTruthy()
    expect(screen.getByText('Advanced operational intelligence')).toBeTruthy()
    expect(screen.getByText('Priority rollout support')).toBeTruthy()
    expect(screen.getByText('Most Popular')).toBeTruthy()

    expect(screen.queryByText(/business-model based terminology/i)).toBeNull()
    expect(screen.queryByText(/governed AI responses/i)).toBeNull()
    expect(screen.queryByText(/operational intelligence readiness/i)).toBeNull()
    expect(screen.queryByText(/provider governance/i)).toBeNull()
  })

  it('uses enlarged matching branding on sign in and sign up shells', () => {
    const TestAuthPageShell = AuthPageShell as React.ComponentType<{
      mode: 'sign-in' | 'sign-up'
    }>
    const { rerender } = render(
      React.createElement(
        TestAuthPageShell,
        { mode: 'sign-in' },
        React.createElement('div', null, 'Auth form'),
      ),
    )

    expect(screen.getByAltText('Skillify').parentElement?.className).toContain(
      'h-24',
    )
    expect(screen.getByText(SKILLIFY_SHORT_TAGLINE)).toBeTruthy()

    rerender(
      React.createElement(
        TestAuthPageShell,
        { mode: 'sign-up' },
        React.createElement('div', null, 'Auth form'),
      ),
    )

    expect(screen.getByText(/create your account, choose a plan/i)).toBeTruthy()
    expect(screen.getByAltText('Skillify').parentElement?.className).toContain(
      'w-[22rem]',
    )
    expect(SKILLIFY_CATEGORY_DESCRIPTOR).toBe(
      'Business Operations & Intelligence Platform',
    )
  })
})
