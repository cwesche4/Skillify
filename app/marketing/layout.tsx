import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
const marketingDescription =
  'Manage leads, customers, jobs, scheduling, automations, and business operations in one workspace built for growing service businesses.'

export const metadata: Metadata = {
  title: {
    default:
      'Skillify | Business Operations & Intelligence for Service Businesses',
    template: '%s | Skillify',
  },
  description: marketingDescription,
  openGraph: {
    title:
      'Skillify | Business Operations & Intelligence for Service Businesses',
    description: marketingDescription,
    url: 'https://skillify.tech',
    siteName: 'Skillify',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title:
      'Skillify | Business Operations & Intelligence for Service Businesses',
    description: marketingDescription,
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
