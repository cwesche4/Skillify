import { NextResponse } from 'next/server'
import { listTemplates } from '@/lib/templates/registry'

// Canonical templates.
// Read-only reference only.
// Must be duplicated before modification or execution.
export async function GET() {
  return NextResponse.json({ templates: listTemplates() })
}
