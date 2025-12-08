// app/marketing/enterprise/thank-you/page.tsx

export default function EnterpriseThankYou() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-32 dark:bg-black">
      <div className="max-w-lg text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Thank you!</h1>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Our enterprise team has received your request. A representative will
          reach out with next steps and a recommended roadmap.
        </p>

        <p className="mt-6 text-xs text-zinc-500">
          Prefer to jump straight into a strategy call?
        </p>

        <a
          href="/marketing/demo"
          className="mt-6 inline-block rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
        >
          Book Strategy Call
        </a>
      </div>
    </main>
  )
}
