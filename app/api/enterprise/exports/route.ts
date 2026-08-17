import { NextResponse } from 'next/server'

// Compliance export bundles.
// Read-only evidence only. No execution or inference.
export async function GET() {
  return NextResponse.json({
    bundle: {
      audits: 'included',
      runs: 'included',
      policies: 'included',
      scope: 'workspace-scoped',
      note: 'ZIP generation placeholder; no execution impact.',
    },
  })
}
