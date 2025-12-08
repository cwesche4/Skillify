import Link from 'next/link'

export default function MarketingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-zinc-200 bg-white px-6 py-12 text-sm dark:border-zinc-800 dark:bg-black">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-4">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Skillify
          </h3>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            AI-powered automations for agencies, coaches, and operators.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Product
          </h4>
          <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-300">
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
              <Link href="/marketing/demo">Live demo</Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Resources
          </h4>
          <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-300">
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
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Company
          </h4>
          <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-300">
            <li>
              <Link href="/marketing/privacy">Privacy</Link>
            </li>
            <li>
              <Link href="/marketing/terms">Terms</Link>
            </li>
          </ul>
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-zinc-500 dark:text-zinc-500">
        © {year} Skillify. All rights reserved.
      </p>
    </footer>
  )
}
