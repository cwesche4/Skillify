// app/page.tsx
import { auth } from "@clerk/nextjs/server"
import Link from "next/link"
import { redirect } from "next/navigation"

import Logo from "@/components/Logo"

export default function Home() {
  const { userId } = auth()

  if (userId) {
    return redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-neutral-light dark:bg-neutral-dark">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-neutral-text-primary dark:text-neutral-text-primary text-xl font-semibold">
            Skillify
          </span>
        </div>

        <Link
          href="/sign-in"
          className="rounded-lg bg-brand-primary px-4 py-2 font-medium text-white transition hover:bg-brand-indigo"
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h1 className="text-neutral-text-primary dark:text-neutral-text-primary text-5xl font-bold leading-tight md:text-6xl">
          Automate Your Entire Workflow with{" "}
          <span className="text-brand-primary">Skillify</span>
        </h1>

        <p className="text-neutral-text-secondary dark:text-neutral-text-secondary mx-auto mt-6 max-w-3xl text-lg">
          AI-powered automation for appointments, follow-ups, content, CRM tasks,
          analytics, and more. Designed for speed, clarity, and long-session focus.
        </p>

        <Link
          href="/sign-up"
          className="mt-10 inline-block rounded-xl bg-brand-primary px-6 py-3 text-lg font-medium text-white transition hover:bg-brand-indigo"
        >
          Create Your Account
        </Link>
      </main>
    </div>
  )
}
