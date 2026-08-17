'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import {
  modalCardDescriptionClass,
  modalCardTitleClass,
  modalOptionCardClass,
} from './modalControlStyles'

const examples = [
  {
    title: 'Text missed callers',
    prompt: 'Text every missed caller.',
  },
  {
    title: 'Unpaid invoices',
    prompt: 'Follow up on unpaid invoices.',
  },
  {
    title: 'Inspection reports',
    prompt: 'Have employees submit inspection reports.',
  },
]

export default function AIWorkflowGeneratorModal({
  open,
  initialPrompt,
  onClose,
  onGenerate,
}: {
  open: boolean
  initialPrompt?: string
  onClose: () => void
  onGenerate: (prompt: string) => void
}) {
  const [prompt, setPrompt] = useState('')
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setPrompt(initialPrompt?.trim() || '')
    }
    wasOpenRef.current = open
  }, [initialPrompt, open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-workflow-panel-title"
        className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/45 ring-1 ring-cyan-300/10"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-4">
          <div>
            <h2
              id="ai-workflow-panel-title"
              className="text-base font-semibold text-slate-50"
            >
              Describe the workflow you want.
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              Describe the workflow you want. Skillify will create a local
              preview draft only.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Generate workflow draft panel"
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(88vh-88px)] space-y-4 overflow-y-auto p-5">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={
              '"Text every missed caller."\n"Follow up with customers after service."\n"Ask completed jobs for a Google review."\n"Remind unpaid invoices."\n"Create a task when a lead is qualified."'
            }
            className="min-h-[132px]"
          />

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Quick examples
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {examples.map((example) => (
                <button
                  key={example.title}
                  type="button"
                  onClick={() => setPrompt(example.prompt)}
                  className={modalOptionCardClass({
                    selected: prompt === example.prompt,
                    className: 'p-3',
                  })}
                >
                  <span className={modalCardTitleClass}>{example.title}</span>
                  <span className={modalCardDescriptionClass}>
                    Custom preview prompt
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-800/75 pt-4">
            <Button size="sm" variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => onGenerate(prompt)}
              disabled={!prompt.trim()}
            >
              Generate Workflow
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
