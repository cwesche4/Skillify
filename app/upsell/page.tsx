// app/upsell/build/page.tsx
import { BuildRequestForm } from '@/components/upsell/BuildRequestForm'
export default function BuildRequestPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-16">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-amber-300 drop-shadow">
            Request a Full Automation Build
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Our Elite automation engineers will design, architect, and deploy
            your entire automation ecosystem — fully integrated with calendars,
            CRMs, AI models, booking systems, pipelines, and more. Submit your
            project details below and our team will reach out within 24 hours.
          </p>
        </header>

        <BuildRequestForm />
      </div>
    </div>
  )
}
