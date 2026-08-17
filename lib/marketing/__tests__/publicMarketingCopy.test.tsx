import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import { BILLING_PLANS } from '@/lib/billing/plans'

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('public marketing repositioning', () => {
  it('positions the homepage around service-business operations instead of old automation-only copy', () => {
    const home = source('app/marketing/page.tsx')
    const indexHome = source('app/marketing/index/page.tsx')

    expect(home).toContain('Run your business from one intelligent workspace.')
    expect(home).toContain('px-6 pb-24 pt-24 lg:pb-32 lg:pt-20')
    expect(indexHome).toContain('px-6 pb-20 pt-24 lg:pb-28 lg:pt-20')
    expect(home).toContain(
      'Business operations and intelligence for growing service businesses',
    )
    expect(home).toContain('Manage leads, customers, jobs, scheduling')
    expect(home).not.toContain(
      'Automate calendars, follow-ups, and content in one workspace.',
    )
    expect(home).not.toContain('No credit card required')
  })

  it('uses the final homepage service-business industry labels', () => {
    const home = source('app/marketing/page.tsx')

    for (const industry of [
      'Lawn & Landscaping',
      'Plumbing',
      'HVAC',
      'Electrical',
      'Cleaning',
      'Home Services',
    ]) {
      expect(home).toContain(industry)
    }
  })

  it('uses broader homepage pillars and removes unverified testimonial proof', () => {
    const home = source('app/marketing/page.tsx')

    expect(home).toContain('Customers & Leads')
    expect(home).toContain('Jobs & Scheduling')
    expect(home).toContain('Automations & AI')
    expect(home).toContain(
      'Built around the way service businesses actually work',
    )
    expect(home).not.toContain('Teams already running on Skillify')
    expect(home).not.toContain('customer quotes')
  })

  it('keeps homepage CTAs routed to existing signup and demo paths', () => {
    const home = source('app/marketing/page.tsx')

    expect(home).toContain('href="/sign-up"')
    expect(home).toContain('href="/marketing/demo"')
    expect(home).toContain('Start 14-day free trial')
    expect(home).toContain('Book a walkthrough')
    expect(home).not.toContain('Start free')
    expect(home).not.toContain('Start your trial')
    expect(home).not.toContain('Get started free')
    expect(home).not.toContain('Book a live demo')
    expect(home).not.toContain('Book a live walkthrough')
    expect(home).not.toContain('Get started in minutes')
  })

  it('uses larger rendered logo sizing in the header and footer without changing logo assets', () => {
    const nav = source('components/marketing/MarketingNav.tsx')
    const footer = source('components/marketing/MarketingFooter.tsx')
    const logo = source('components/branding/BrandLogo.tsx')

    expect(nav).toContain('px-6 py-4 md:py-3')
    expect(nav).toContain(
      'className="h-12 w-44 sm:h-14 sm:w-52 lg:h-20 lg:w-[17rem] xl:h-24 xl:w-80 2xl:w-[22rem]"',
    )
    expect(nav).toContain('className="h-12 w-44"')
    expect(footer).toContain('className="h-14 w-52"')
    expect(logo).toContain('/branding/logos/skillify-logo-horizontal-light.svg')
    expect(logo).toContain('/branding/logos/skillify-logo-horizontal-dark.svg')
  })

  it('keeps nav inactive, hover, and active states visually distinct', () => {
    const nav = source('components/marketing/MarketingNav.tsx')

    expect(nav).toContain('usePathname')
    expect(nav).toContain('aria-current={isActive ?')
    expect(nav).toContain('gap-6')
    expect(nav).toContain('xl:gap-8')
    expect(nav).toContain('text-blue-950/75')
    expect(nav).toContain('dark:text-blue-100/80')
    expect(nav).toContain('hover:text-blue-600')
    expect(nav).toContain('after:bg-blue-600')
    expect(nav).toContain('text-blue-700 after:scale-x-100')
    expect(nav).not.toContain('border-b-2')
    expect(nav).not.toContain('border-blue-600 text-blue-700')
    expect(nav).toContain('focus-visible:ring-2 focus-visible:ring-cyan-400')
  })

  it('keeps desktop auth actions split by Clerk signed-in state', () => {
    const nav = source('components/marketing/MarketingNav.tsx')

    expect(nav).toContain('<SignedOut>')
    expect(nav).toContain('<SignedIn>')
    expect(nav).toContain('href="/sign-in"')
    expect(nav).toContain('Log in')
    expect(nav).toContain('href="/sign-up"')
    expect(nav).toContain('Start 14-day free trial')
    expect(nav).toContain('href="/dashboard"')
    expect(nav).toContain('Dashboard')
    expect(nav).toContain('<SkillifyUserMenu compact />')
  })

  it('renders an accessible right-side mobile navigation drawer', () => {
    const nav = source('components/marketing/MarketingNav.tsx')

    expect(nav).toContain('aria-label={open ?')
    expect(nav).toContain('aria-expanded={open}')
    expect(nav).toContain('aria-controls="marketing-mobile-navigation"')
    expect(nav).toContain('role="dialog"')
    expect(nav).toContain('aria-modal="true"')
    expect(nav).toContain('aria-label="Marketing navigation menu"')
    expect(nav).toContain('fixed inset-0 z-[60] md:hidden')
    expect(nav).toContain('absolute inset-0 bg-slate-950/35')
    expect(nav).toContain('right-0 top-0 flex h-full')
    expect(nav).toContain('w-[min(22rem,calc(100vw-1.5rem))]')
    expect(nav).toContain("event.key === 'Escape'")
    expect(nav).toContain("document.body.style.overflow = 'hidden'")
    expect(nav).toContain('closeButtonRef.current?.focus()')
    expect(nav).toContain('const menuButton = menuButtonRef.current')
    expect(nav).toContain('menuButton?.focus()')
  })

  it('keeps all primary marketing links inside the mobile drawer with active state', () => {
    const nav = source('components/marketing/MarketingNav.tsx')

    for (const link of [
      'Overview',
      'Features',
      'Solutions',
      'Pricing',
      'Demo',
      'Blog',
    ]) {
      expect(nav).toContain(`label: '${link}'`)
    }

    expect(nav).toContain('onClick={() => setOpen(false)}')
    expect(nav).toContain('border-blue-600 bg-blue-50/70 text-blue-700')
  })

  it('renders the current product pillars on the Features page', () => {
    const features = source('app/marketing/features/page.tsx')

    for (const pillar of [
      'Customers & CRM',
      'Jobs & Operations',
      'Scheduling',
      'Automations',
      'Analytics & Reporting',
      'Workspace AI',
    ]) {
      expect(features).toContain(pillar)
    }

    expect(features).not.toContain('Content & Campaigns')
    expect(features).not.toContain(
      'Everything you need to automate your operations',
    )
    expect(features).not.toContain('Recurring-work compatible operations')
    expect(features).not.toContain('Operational intelligence foundation')
    expect(features).toContain('Support recurring service work')
    expect(features).toContain(
      'AI insights that help surface what needs attention',
    )
  })

  it('focuses Solutions on service-business segments', () => {
    const solutions = source('app/marketing/solutions/page.tsx')

    expect(solutions).toContain(
      'Built for service businesses that run on customers, crews, and schedules.',
    )

    for (const segment of [
      'Lawn & Landscaping',
      'Plumbing & HVAC',
      'Electrical & Home Services',
      'Cleaning & Field Services',
    ]) {
      expect(solutions).toContain(segment)
    }

    expect(solutions).not.toContain('Marketing & Growth Agencies')
    expect(solutions).not.toContain('Coaches & Consultants')
  })

  it('preserves centralized pricing values and plan CTA routing', () => {
    const pricing = source('app/marketing/pricing/page.tsx')

    expect(pricing).toContain('BILLING_PLANS.map')
    expect(pricing).toContain('formatPlanPrice(plan.monthlyPriceCents)')

    expect(BILLING_PLANS.map((plan) => plan.monthlyPriceCents)).toEqual([
      7900, 17900, 34900,
    ])
    expect(pricing).toContain('href={`/sign-up?plan=${plan.id.toLowerCase()}`}')
    expect(pricing).toContain('label={`Start ${plan.name}`}')
  })

  it('removes unsupported white-label claims from pricing copy', () => {
    const pricing = source('app/marketing/pricing/page.tsx')

    expect(pricing).toContain(
      'White-labeling is not listed as a standard self-serve feature today.',
    )
    expect(pricing).not.toContain('Yes — available for Elite plans')
  })

  it('keeps the demo form while improving walkthrough framing', () => {
    const demo = source('app/marketing/demo/page.tsx')

    expect(demo).toContain('Book a Skillify walkthrough')
    expect(demo).toContain('What we can review')
    expect(demo).toContain('Customer acquisition flow')
    expect(demo).toContain('placeholder="Full name"')
    expect(demo).toContain('placeholder="Work email"')
    expect(demo).toContain('placeholder="Company name"')
    expect(demo).toContain('See what needs attention across the business')
    expect(demo).not.toContain('Dashboards and operational visibility')
  })

  it('uses higher-contrast cool industry chips and cooler marketing surfaces', () => {
    const home = source('app/marketing/page.tsx')
    const coveredMarketing = [
      home,
      source('app/marketing/index/page.tsx'),
      source('app/marketing/features/page.tsx'),
      source('app/marketing/solutions/page.tsx'),
      source('app/marketing/pricing/page.tsx'),
      source('app/marketing/demo/page.tsx'),
    ].join('\n')

    expect(home).toContain('text-slate-800')
    expect(home).toContain('border border-sky-200 bg-sky-50/70')
    expect(home).toContain('shadow-md shadow-slate-200/60')
    expect(home).toContain(
      'rounded-xl border border-sky-200 bg-sky-50/70 py-3 shadow-sm shadow-sky-100/50',
    )
    expect(coveredMarketing).not.toMatch(
      /(bg|border|text|from|via|to|shadow)-(amber|yellow|orange|stone|neutral)-/,
    )
    expect(coveredMarketing).not.toMatch(/(cream|beige|warm)/i)
  })

  it('keeps public marketing separators and card borders in a cool hierarchy', () => {
    const home = source('app/marketing/page.tsx')
    const index = source('app/marketing/index/page.tsx')
    const features = source('app/marketing/features/page.tsx')
    const solutions = source('app/marketing/solutions/page.tsx')
    const pricing = source('app/marketing/pricing/page.tsx')
    const demo = source('app/marketing/demo/page.tsx')

    expect(home).toContain('border-t border-slate-200/80')
    expect(index).toContain('border-t border-slate-200/80')
    expect(features).toContain('border border-slate-200 bg-white')
    expect(solutions).toContain('border border-slate-200 bg-white')
    expect(pricing).toContain('border-t border-slate-200')
    expect(pricing).toContain('border-blue-600')
    expect(pricing).toContain('border-slate-200 dark:border-zinc-800')
    expect(demo).toContain('border border-slate-200 bg-white')
    expect(demo).toContain('bg-slate-200 dark:bg-zinc-800')
  })

  it('uses readable Demo input and button states', () => {
    const demo = source('app/marketing/demo/page.tsx')

    expect(demo).toContain('border border-slate-300 bg-slate-50')
    expect(demo).toContain('placeholder:text-slate-500')
    expect(demo).toContain('focus:border-blue-500')
    expect(demo).toContain('focus:ring-2 focus:ring-blue-500/20')
    expect(demo).toContain('disabled:cursor-not-allowed')
    expect(demo).toContain('disabled:bg-slate-300')
    expect(demo).toContain('Confirm walkthrough')
  })

  it('keeps the Blog page file available and does not move the route', () => {
    expect(
      fs.existsSync(path.join(process.cwd(), 'app/marketing/blog/page.tsx')),
    ).toBe(true)
  })

  it('updates footer positioning while preserving legal links', () => {
    const footer = source('components/marketing/MarketingFooter.tsx')

    expect(footer).toContain(
      'Business operations and intelligence for growing service businesses.',
    )
    expect(footer).toContain('className="h-14 w-52"')
    expect(footer).toContain('border-t border-slate-200 bg-white')
    expect(footer).toContain('[&_a:hover]:text-blue-600')
    expect(footer).toContain('href="/marketing/privacy"')
    expect(footer).toContain('href="/marketing/terms"')
  })

  it('updates marketing metadata for the service-business positioning', () => {
    const layout = source('app/marketing/layout.tsx')

    expect(layout).toContain(
      'Skillify | Business Operations & Intelligence for Service Businesses',
    )
    expect(layout).toContain(
      'Manage leads, customers, jobs, scheduling, automations, and business operations',
    )
  })
})
