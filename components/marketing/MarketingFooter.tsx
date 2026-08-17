import Link from 'next/link'

import { BrandLogo } from '@/components/branding/BrandLogo'

export default function MarketingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-12 text-sm dark:border-zinc-800 dark:bg-black">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-4">
        <div>
          <BrandLogo
            variant="horizontal"
            alt="Skillify"
            className="h-14 w-52"
          />
          <p className="mt-3 max-w-xs text-xs leading-5 text-slate-600 dark:text-zinc-300">
            Business operations and intelligence for growing service businesses.
          </p>
          <BrandLogo
            variant="poweredCompact"
            alt="Powered by Skillify"
            className="mt-4 h-7 w-36 opacity-80"
          />
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">
            Product
          </h4>
          <ul className="mt-2 space-y-1 text-slate-700 dark:text-zinc-200 [&_a:hover]:text-blue-600 dark:[&_a:hover]:text-blue-300 [&_a]:transition-colors">
            <li>
              <Link href="/marketing/features">Features</Link>
            </li>
            <li>
              <Link href="/marketing/solutions">Solutions</Link>
            </li>
            <li>
              <Link href="/marketing/pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/marketing/demo">Walkthrough</Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">
            Resources
          </h4>
          <ul className="mt-2 space-y-1 text-slate-700 dark:text-zinc-200 [&_a:hover]:text-blue-600 dark:[&_a:hover]:text-blue-300 [&_a]:transition-colors">
            <li>
              <Link href="/marketing/blog">Blog</Link>
            </li>
            <li>
              <Link href="/docs">Docs</Link>
            </li>
            <li>
              <Link href="/marketing/support">Support</Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">
            Company
          </h4>
          <ul className="mt-2 space-y-1 text-slate-700 dark:text-zinc-200 [&_a:hover]:text-blue-600 dark:[&_a:hover]:text-blue-300 [&_a]:transition-colors">
            <li>
              <Link href="/marketing/privacy">Privacy</Link>
            </li>
            <li>
              <Link href="/marketing/terms">Terms</Link>
            </li>
          </ul>
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-slate-500 dark:text-zinc-400">
        © {year} Skillify. All rights reserved.
      </p>
    </footer>
  )
}
