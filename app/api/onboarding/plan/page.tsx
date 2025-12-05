"use client"

import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Tier = "starter" | "pro" | "elite"

const PLANS: {
  id: Tier
  label: string
  tagline: string
  highlight?: string
}[] = [
  {
    id: "starter",
    label: "Starter",
    tagline: "Great for trying Skillify with simple flows.",
  },
  {
    id: "pro",
    label: "Pro",
    tagline: "More automations, more data, AI-powered examples.",
    highlight: "Most popular",
  },
  {
    id: "elite",
    label: "Elite",
    tagline: "Full AI experience and advanced demo workspace.",
    highlight: "Best experience",
  },
]

export default function PlanOnboardingPage() {
  const router = useRouter()
  const [tier, setTier] = useState<Tier>("starter")
  const [loading, setLoading] = useState(false)

  const confirm = async () => {
    setLoading(true)
    try {
      await fetch("/api/workspaces/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      })

      router.push("/onboarding")
    } finally {
      setLoading(false)
    }
  }

  const skip = async () => {
    setTier("starter")
    await confirm()
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-16">
      <section className="mb-10 space-y-2">
        <h1 className="text-neutral-text-primary text-3xl font-semibold">
          Choose your starting plan
        </h1>
        <p className="text-neutral-text-secondary text-sm">
          You can change plans later in Billing. This just controls which demo automations
          and data we set up for you.
        </p>
      </section>

      <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const active = tier === plan.id
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setTier(plan.id)}
              className={`text-left transition ${
                active ? "ring-2 ring-brand-primary" : "ring-1 ring-neutral-border"
              } rounded-2xl`}
            >
              <Card className="flex h-full flex-col justify-between p-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-neutral-text-primary text-lg font-semibold">
                      {plan.label}
                    </h2>
                    {plan.highlight && (
                      <Badge variant="blue" className="text-[10px]">
                        {plan.highlight}
                      </Badge>
                    )}
                  </div>
                  <p className="text-neutral-text-secondary text-xs">{plan.tagline}</p>
                </div>
              </Card>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={confirm}
          disabled={loading}
          className="hover:bg-brand-primary/90 rounded-xl bg-brand-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Setting up workspace..." : "Continue with selected plan"}
        </button>

        <button
          type="button"
          onClick={skip}
          disabled={loading}
          className="text-neutral-text-secondary text-xs underline"
        >
          Skip for now (Starter)
        </button>
      </div>
    </div>
  )
}
