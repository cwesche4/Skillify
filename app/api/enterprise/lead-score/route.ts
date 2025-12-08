// app/api/enterprise/lead-score/route.ts

import { NextResponse } from 'next/server'
import { scoreLead } from '@/lib/enterprise/leadScoring'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const result = await scoreLead(body)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[lead-score] Error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
