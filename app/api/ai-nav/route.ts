// app/api/ai-nav/route.ts
import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const routes = [
  { path: "/dashboard", keywords: ["home", "overview", "summary"] },
  { path: "/dashboard/automations", keywords: ["automation", "flows", "bots"] },
  { path: "/dashboard/runs", keywords: ["logs", "history", "runs"] },
  { path: "/dashboard/billing", keywords: ["plan", "billing", "payment"] },
  { path: "/dashboard/settings", keywords: ["settings", "profile", "account"] },
  { path: "/dashboard/admin/system", keywords: ["admin", "system", "analytics"] },
]

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const query: string = (body?.query ?? "").toLowerCase()

  if (!query) {
    return NextResponse.json({ suggestedPath: "/dashboard" })
  }

  const match = routes.find((r) => r.keywords.some((k) => query.includes(k))) ?? routes[0]

  return NextResponse.json({ suggestedPath: match.path })
}
