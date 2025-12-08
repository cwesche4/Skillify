import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'

const navLinks = [
  { href: '/marketing', label: 'Product' },
  { href: '/marketing/pricing', label: 'Pricing' },
  { href: '/marketing/case-studies', label: 'Case Studies' },
  { href: '/marketing/enterprise', label: 'Enterprise' },
]

export const metadata: Metadata = {
  title: {
    default: 'Skillify – AI-powered automations for modern teams',
    template: '%s | Skillify',
  },
  description:
    'Skillify saves businesses hours every week by automating scheduling, follow-ups, and content in one AI-powered workspace.',
  openGraph: {
    title: 'Skillify – AI-powered automations for modern teams',
    description:
      'Automate calendars, follow-ups, and content in one AI workspace built for agencies, coaches, and operators.',
    url: 'https://skillify.tech',
    siteName: 'Skillify',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Skillify – AI-powered automations for modern teams',
    description:
      'Automate calendars, follow-ups, and content in one AI-powered workspace.',
  },
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}
