// lib/marketing/caseStudies.ts

export type CaseStudy = {
  slug: string
  title: string
  subtitle: string
  industry: string
  headlineMetric: string
  headlineMetricLabel: string
  summary: string
  logoText: string
  challenges: string[]
  solutions: string[]
  results: { label: string; value: string }[]
  quote: {
    text: string
    name: string
    role: string
  }
}

export const caseStudies: CaseStudy[] = [
  {
    slug: 'agency-cut-manual-work-70',
    title: 'Agency automates client onboarding and cuts manual work by 70%',
    subtitle: 'From scattered tools to one automation command center.',
    industry: 'Marketing Agency',
    headlineMetric: '-70%',
    headlineMetricLabel: 'Manual work per client',
    summary:
      'A 12-person agency replaced 6 different tools for onboarding, follow-ups, and reporting with a single Skillify workspace.',
    logoText: 'Northline Digital',
    challenges: [
      'Clients were onboarded through 4–5 different tools with no single source of truth.',
      'Follow-ups relied on manual reminders and spreadsheets.',
      'Founders were stuck doing operations instead of strategy and growth.',
    ],
    solutions: [
      'Centralized all onboarding flows into one visual automation builder.',
      'Configured calendar + missed-call follow-ups in under a week.',
      'Set up AI-powered content prompts tailored to each client niche.',
    ],
    results: [
      { label: 'Time per client onboarding', value: '-70%' },
      { label: 'Client responsiveness', value: '+42%' },
      { label: 'Ops hours reclaimed / week', value: '18+ hours' },
    ],
    quote: {
      text: 'Our operations feel like they’re finally on rails. We can bring on 2–3 clients a week without the team breaking.',
      name: 'Emma Collins',
      role: 'Founder, Northline Digital',
    },
  },
  {
    slug: 'coaching-firm-doubles-show-up',
    title: 'Coaching firm doubles show-up rate for sales calls',
    subtitle: 'Automated reminders and AI follow-ups on every missed call.',
    industry: 'Coaching',
    headlineMetric: '2.1x',
    headlineMetricLabel: 'Increase in show-up rate',
    summary:
      'This coaching brand relies on high-intent calls. Skillify automated every reminder, reschedule, and post-call follow-up.',
    logoText: 'Lumina Performance',
    challenges: [
      'Leads were booking and then ghosting scheduled calls.',
      'No systematic follow-up when someone missed or rescheduled.',
      'Coaches wasted time confirming bookings and chasing no-shows.',
    ],
    solutions: [
      'Native scheduling flows powered by Skillify’s booking models.',
      'AI-crafted reminders across email + SMS, branded to their voice.',
      'Automatic reschedule links and post-call sequences for nurturing.',
    ],
    results: [
      { label: 'Show-up rate', value: '2.1x' },
      { label: 'Sales calls booked per month', value: '+63%' },
      { label: 'Manual reminders sent', value: '-95%' },
    ],
    quote: {
      text: 'We didn’t realize how many deals we were losing to simple logistics until Skillify fixed it for us.',
      name: 'Jared Lane',
      role: 'CEO, Lumina Performance',
    },
  },
]
