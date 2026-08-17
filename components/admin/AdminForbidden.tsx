import { ShieldAlert } from 'lucide-react'

import { Card } from '@/components/ui/Card'

export function AdminForbidden() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center">
        <Card className="w-full border-rose-500/25 bg-rose-500/5 p-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-200">
            <ShieldAlert className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-50">
            403: Global admin access required
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            This area is restricted to platform administrators. Workspace roles
            do not grant access to global admin routes.
          </p>
        </Card>
      </div>
    </main>
  )
}
