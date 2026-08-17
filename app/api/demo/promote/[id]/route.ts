import { NextResponse } from 'next/server'
import { promoteDemoFlow } from '@/lib/demo/promoteDemoFlow'

// Demo flows.
// Read-only reference.
// Must be duplicated to become production.
export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const result = promoteDemoFlow(params.id)
    return NextResponse.json({ automation: result })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Unable to promote demo' },
      { status: 400 },
    )
  }
}
