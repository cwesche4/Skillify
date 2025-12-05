// components/command-center/CommandCenterDialog.tsx
"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import type {
  AiCoachResponseBody,
  CommandCenterMode,
  CommandCenterSearchMode,
  CommandSearchResponse,
  CommandSearchResult,
  OnboardingItem,
  OnboardingResponse,
} from "@/lib/command-center/types"
import { cn } from "@/lib/utils"

interface CommandCenterDialogProps {
  open: boolean
  onClose: () => void
}

export function CommandCenterDialog({ open, onClose }: CommandCenterDialogProps) {
  const [mode, setMode] = useState<CommandCenterMode>("search")
  const [searchMode, setSearchMode] = useState<CommandCenterSearchMode>("all")
  const [query, setQuery] = useState("")
  const [workspaceSlug, setWorkspaceSlug] = useState<string | undefined>(undefined)

  const [searchLoading, setSearchLoading] = useState(false)
  const [results, setResults] = useState<CommandSearchResult[]>([])

  const [aiPrompt, setAiPrompt] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResponse, setAiResponse] = useState<string>("")

  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const [onboarding, setOnboarding] = useState<OnboardingItem[]>([])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  // On first open, capture workspace from URL (?workspace=slug)
  useEffect(() => {
    if (!open) return
    const url = new URL(window.location.href)
    const slug = url.searchParams.get("workspace") ?? undefined
    setWorkspaceSlug(slug)
  }, [open])

  // Fetch onboarding when mode changes to onboarding
  useEffect(() => {
    const loadOnboarding = async () => {
      if (!open || mode !== "onboarding") return
      setOnboardingLoading(true)
      try {
        const url = new URL("/api/command-center/onboarding", window.location.origin)
        if (workspaceSlug) {
          url.searchParams.set("workspace", workspaceSlug)
        }
        const res = await fetch(url.toString())
        const json = (await res.json()) as OnboardingResponse
        setOnboarding(json.checklist)
      } catch (error) {
        console.error(error)
      } finally {
        setOnboardingLoading(false)
      }
    }

    void loadOnboarding()
  }, [mode, open, workspaceSlug])

  const hasContent = useMemo(
    () =>
      mode === "search"
        ? results.length > 0
        : mode === "onboarding"
          ? onboarding.length > 0
          : !!aiResponse,
    [mode, results.length, onboarding.length, aiResponse],
  )

  const runSearch = async () => {
    if (!query.trim()) {
      setResults([])
      return
    }

    setSearchLoading(true)
    try {
      const res = await fetch("/api/command-center/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          mode: searchMode,
          workspaceSlug,
          limit: 24,
        }),
      })
      const json = (await res.json()) as CommandSearchResponse
      setResults(json.results)
    } catch (error) {
      console.error(error)
    } finally {
      setSearchLoading(false)
    }
  }

  const runAiCoach = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiResponse("")

    try {
      const res = await fetch("/api/command-center/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          workspaceSlug,
        }),
      })
      const json = (await res.json()) as AiCoachResponseBody
      setAiResponse(json.message)
    } catch (error) {
      console.error(error)
      setAiResponse("Something went wrong while talking to AI Coach.")
    } finally {
      setAiLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24">
      <Card className="w-full max-w-3xl border border-slate-800 bg-slate-950/95 shadow-2xl">
        {/* Header: tabs + workspace */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <ModeChip
              label="Search"
              active={mode === "search"}
              onClick={() => setMode("search")}
            />
            <ModeChip
              label="Actions"
              active={mode === "actions"}
              onClick={() => setMode("actions")}
            />
            <ModeChip
              label="AI Coach"
              active={mode === "ai"}
              onClick={() => setMode("ai")}
            />
            <ModeChip
              label="Onboarding"
              active={mode === "onboarding"}
              onClick={() => setMode("onboarding")}
            />
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="hidden items-center gap-1 sm:inline-flex">
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                ⌘
              </kbd>
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                K
              </kbd>
              <span>to toggle</span>
            </span>
            <button
              type="button"
              className="rounded-md px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-900"
              onClick={onClose}
            >
              Esc
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 px-4 py-3">
          {mode === "search" && (
            <>
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void runSearch()
                    }
                  }}
                  placeholder="Search workspaces, automations, runs, members…"
                  className="form-input flex-1 border-slate-800 bg-slate-950/90 text-sm"
                />
                <select
                  value={searchMode}
                  onChange={(event) =>
                    setSearchMode(event.target.value as CommandCenterSearchMode)
                  }
                  className="form-select w-32 border-slate-800 bg-slate-950/90 text-xs"
                >
                  <option value="all">All</option>
                  <option value="workspaces">Workspaces</option>
                  <option value="automations">Automations</option>
                  <option value="runs">Runs</option>
                  <option value="members">Members</option>
                </select>
                <button
                  type="button"
                  onClick={() => void runSearch()}
                  className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-indigo"
                >
                  {searchLoading ? "Searching…" : "Search"}
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto pt-2">
                {!searchLoading && results.length === 0 && (
                  <p className="text-xs text-slate-500">
                    Type a query and press Enter to search your workspace.
                  </p>
                )}

                {searchLoading && <p className="text-xs text-slate-400">Searching…</p>}

                {results.map((result) => (
                  <ResultRow key={`${result.type}-${result.id}`} result={result} />
                ))}
              </div>
            </>
          )}

          {mode === "actions" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <QuickAction
                title="Create automation"
                description="Start a new flow with AI-assisted node suggestions."
                href="/dashboard/automations"
              />
              <QuickAction
                title="Open analytics"
                description="Jump into workspace performance, trends, and costs."
                href={
                  workspaceSlug
                    ? `/dashboard/analytics?workspace=${workspaceSlug}`
                    : "/dashboard/analytics"
                }
              />
              <QuickAction
                title="Invite member"
                description="Bring a teammate into this workspace."
                href="/dashboard/workspaces"
              />
              <QuickAction
                title="Open AI Coach"
                description="Deep-dive into suggestions and anomalies."
                href={
                  workspaceSlug
                    ? `/dashboard/analytics?workspace=${workspaceSlug}`
                    : "/dashboard/analytics"
                }
              />
            </div>
          )}

          {mode === "ai" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-300">
                  Ask Skillify about your automations, runs, or performance.
                </p>
                <Badge variant="blue">AI Coach Live</Badge>
              </div>

              <textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="e.g. “Which automation is failing the most and what should I fix first?”"
                className="form-textarea h-20 border-slate-800 bg-slate-950/90 text-sm"
              />

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Context is scoped to your current workspace if present.</span>
                <button
                  type="button"
                  onClick={() => void runAiCoach()}
                  className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-indigo disabled:opacity-60"
                  disabled={aiLoading || !aiPrompt.trim()}
                >
                  {aiLoading ? "Thinking…" : "Ask AI Coach"}
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-200">
                {aiResponse ? (
                  <pre className="whitespace-pre-wrap font-mono text-[11px]">
                    {aiResponse}
                  </pre>
                ) : (
                  <p className="text-slate-500">AI Coach responses will appear here.</p>
                )}
              </div>
            </div>
          )}

          {mode === "onboarding" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-300">
                  Guided steps to fully activate your workspace.
                </p>
                <Badge variant="green">Smart checklist</Badge>
              </div>

              {onboardingLoading && (
                <p className="text-xs text-slate-400">Loading checklist…</p>
              )}

              {!onboardingLoading && onboarding.length === 0 && (
                <p className="text-xs text-slate-500">
                  No onboarding checklist available for this workspace yet.
                </p>
              )}

              <div className="space-y-2">
                {onboarding.map((item) => (
                  <OnboardingRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {!hasContent && mode !== "actions" && (
            <p className="pt-2 text-[11px] text-slate-500">
              Tip: Use <span className="font-mono">⌘K</span> anywhere in the dashboard to
              reopen the Command Center.
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}

function ModeChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px]",
        active
          ? "bg-slate-800 text-slate-50"
          : "bg-transparent text-slate-400 hover:bg-slate-900",
      )}
    >
      {label}
    </button>
  )
}

function ResultRow({ result }: { result: CommandSearchResult }) {
  if (result.type === "workspace") {
    return (
      <Link
        href={`/dashboard?workspace=${result.slug}`}
        className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-slate-900"
      >
        <div>
          <p className="font-medium text-slate-100">{result.name}</p>
          <p className="text-[11px] text-slate-500">Workspace · {result.slug}</p>
        </div>
        <Badge variant="blue">Workspace</Badge>
      </Link>
    )
  }

  if (result.type === "automation") {
    return (
      <Link
        href={`/dashboard/automations/${result.id}`}
        className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-slate-900"
      >
        <div>
          <p className="font-medium text-slate-100">{result.name}</p>
          <p className="text-[11px] text-slate-500">
            Automation · {result.workspaceName}
          </p>
        </div>
        <Badge
          variant={
            result.status === "ACTIVE"
              ? "green"
              : result.status === "PAUSED"
                ? "blue"
                : "default"
          }
        >
          {result.status}
        </Badge>
      </Link>
    )
  }

  if (result.type === "run") {
    return (
      <Link
        href={`/dashboard/automations/${result.automationId}/runs/${result.id}`}
        className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-slate-900"
      >
        <div>
          <p className="font-medium text-slate-100">{result.automationName}</p>
          <p className="text-[11px] text-slate-500">
            Run · {new Date(result.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge
          variant={
            result.status === "SUCCESS"
              ? "green"
              : result.status === "FAILED"
                ? "red"
                : "default"
          }
        >
          {result.status}
        </Badge>
      </Link>
    )
  }

  // member
  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-slate-900">
      <div>
        <p className="font-medium text-slate-100">{result.clerkId}</p>
        <p className="text-[11px] text-slate-500">
          Member · {result.workspaceName} · Role: {result.role}
        </p>
      </div>
      <Badge variant="default">Member</Badge>
    </div>
  )
}

function QuickAction({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="hover:border-brand-primary/60 rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-200 hover:bg-slate-900/90"
    >
      <p className="text-sm font-semibold text-slate-50">{title}</p>
      <p className="mt-1 text-[11px] text-slate-400">{description}</p>
    </Link>
  )
}

function OnboardingRow({ item }: { item: OnboardingItem }) {
  const badgeVariant =
    item.priority === "high" ? "red" : item.priority === "medium" ? "blue" : "default"

  const content = (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs">
      <div>
        <p className="font-medium text-slate-50">{item.title}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{item.description}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge variant={badgeVariant}>{item.completed ? "Done" : "Todo"}</Badge>
      </div>
    </div>
  )

  if (item.href) {
    return <Link href={item.href}>{content}</Link>
  }

  return content
}
