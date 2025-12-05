// components/onboarding/AIOnboardingPanel.tsx
"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"

export default function AIOnboardingPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([])

  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("open-ai-onboarding", handler)
    return () => window.removeEventListener("open-ai-onboarding", handler)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const send = async (input: string) => {
    if (!input.trim()) return

    setMessages((prev) => [...prev, { role: "user", content: input }])

    const reply = {
      role: "assistant" as const,
      content:
        "To create your first automation, open Automations → New Automation. I’ll walk you through node setup and triggers.",
    }

    setMessages((prev) => [...prev, reply])
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        className="bg-neutral-card-dark fixed bottom-6 right-6 z-[9999] w-[380px] rounded-xl border border-neutral-border p-4 shadow-2xl"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="text-brand-primary" />
          <h3 className="font-semibold">Skillify AI Guide</h3>
        </div>

        <div className="h-64 space-y-3 overflow-y-auto pr-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-lg p-2 text-sm ${
                m.role === "assistant"
                  ? "bg-slate-800 text-white"
                  : "bg-slate-700 text-slate-200"
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>

        <input
          ref={inputRef}
          placeholder="Ask how to use Skillify…"
          className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              send(e.currentTarget.value)
              e.currentTarget.value = ""
            }
          }}
        />
      </motion.div>
    </AnimatePresence>
  )
}
