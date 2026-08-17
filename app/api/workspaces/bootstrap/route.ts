import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Workspace bootstrap has been retired. Use the explicit workspace creation flow.',
      code: 'WORKSPACE_BOOTSTRAP_RETIRED',
    },
    { status: 410 },
  )
}
