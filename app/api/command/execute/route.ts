// app/api/command/execute/route.ts
import { NextResponse } from "next/server"

type CommandExecuteBody = {
  action?: string
  [key: string]: unknown
}

export async function POST(req: Request) {
  const body = (await req.json()) as CommandExecuteBody

  // In future, you can execute server-side actions based on body.action
  // For now we just acknowledge.
  switch (body.action) {
    case "open_onboarding":
      // Frontend listens to window event; nothing special here.
      break
    default:
      break
  }

  return NextResponse.json({ ok: true })
}
