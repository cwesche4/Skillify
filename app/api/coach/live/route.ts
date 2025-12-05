import { NextResponse } from "next/server"

export async function GET() {
  // In real version: analyze latest runs, failures, costs, latency.
  const insights = [
    {
      id: "1",
      message: "Automation 'New Lead Welcome' is running slower than normal.",
      severity: "warning",
    },
    {
      id: "2",
      message: "AI Node #3 in 'Content Pipeline' has high token usage.",
      severity: "critical",
    },
  ]

  return NextResponse.json({ insights })
}
