// app/api/workspaces/[workspaceId]/coach/live/route.ts
import { getLiveCoachSnapshot, type LiveCoachSnapshot } from "@/lib/analytics/liveCoach"
import { NextResponse } from "next/server"

export async function GET(_req: Request, context: { params: { workspaceId: string } }) {
  try {
    const workspaceId = context.params.workspaceId
    const snapshot: LiveCoachSnapshot = await getLiveCoachSnapshot(workspaceId)

    return NextResponse.json(snapshot)
  } catch (err) {
    console.error("AI Coach Live REST error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
