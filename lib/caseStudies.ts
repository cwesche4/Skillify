// lib/caseStudies.ts

export type CaseStudy = {
  slug: string
  customer: string
  title: string
  industry: string
  headlineStat: string
  summary: string
  logoText?: string
  tags: string[]
  metrics: { label: string; value: string; caption?: string }[]
  sections: { heading: string; body: string }[]
  quote?: {
    text: string
    person: string
    role: string
  }
}

export const caseStudies: CaseStudy[] = [
  {
    slug: 'agency-40-more-demos',
    customer: 'SignalWave Agency',
    title: 'Agency increases qualified demos by 40% in 60 days',
    industry: 'Marketing Agency',
    headlineStat: '+40% qualified demos',
    summary:
      'SignalWave used Skillify to automate lead routing, follow-ups, and calendar scheduling — turning warm traffic into booked calls automatically.',
    logoText: 'SignalWave',
    tags: ['Agency', 'Calendars', 'Follow-ups'],
    metrics: [
      { label: 'Increase in demos', value: '+40%' },
      { label: 'Response time', value: '1.2 min', caption: 'avg first touch' },
      { label: 'No-show rate', value: '-28%' },
    ],
    sections: [
      {
        heading: 'The problem',
        body: 'SignalWave had leads coming from multiple channels (ads, referrals, events) but relied on manual follow-ups and disconnected calendars. Deals slipped through the cracks and the team spent hours each week chasing bookings.',
      },
      {
        heading: 'The solution',
        body: 'Skillify centralized incoming leads, automated AI-personalized follow-ups, and pushed pre-qualified prospects directly into shared calendars. The team configured separate booking flows for SDRs, AEs, and VIP accounts — all inside one workspace.',
      },
      {
        heading: 'The outcome',
        body: 'Within 60 days, SignalWave increased qualified demos by 40%, cut manual follow-up time by 70%, and brought their no-show rate down by 28% using reminders and smart rescheduling flows.',
      },
    ],
    quote: {
      text: 'Skillify quietly took over our follow-ups and bookings. It feels like we hired a full-time SDR team.',
      person: 'Jared C.',
      role: 'Founder, SignalWave Agency',
    },
  },
  // Add more as needed...
]

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return caseStudies.find((c) => c.slug === slug)
}
