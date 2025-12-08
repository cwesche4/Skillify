// app/upsell/build/success/page.tsx

export default function BuildSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="max-w-md rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold text-white">
          Request Received
        </h1>
        <p className="text-sm text-slate-400">
          Our team will review your project details and reach out shortly.
        </p>
        <div className="mt-6">
          <a
            href="/dashboard"
            className="inline-flex items-center rounded-lg bg-brand-primary px-4 py-2 text-sm text-white"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
