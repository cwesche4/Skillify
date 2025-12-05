import { ArrowRight } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
]

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/80 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-black/70">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* Logo / Brand */}
          <Link href="/" className="group flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-sky-400 shadow-[0_0_24px_-8px_rgba(59,130,246,0.8)]" />
            <span className="text-xl font-semibold tracking-tight">Skillify</span>
          </Link>

          {/* Links */}
          <div className="hidden items-center gap-8 text-sm font-medium text-zinc-600 dark:text-zinc-300 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-zinc-900 dark:hover:text-zinc-50"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth / CTA */}
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="hidden text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50 md:inline"
            >
              Log in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-50 transition hover:scale-[1.02] active:scale-[0.99] dark:bg-zinc-50 dark:text-zinc-950"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </header>

      {/* PAGE CONTENT */}
      <main>{children}</main>

      {/* FOOTER */}
      <footer className="mt-16 border-t border-zinc-200/70 dark:border-zinc-800/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-zinc-500 dark:text-zinc-400 md:flex-row">
          <span>© {new Date().getFullYear()} Skillify. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/docs" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Documentation
            </Link>
            <Link href="#" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Privacy
            </Link>
            <Link href="#" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
