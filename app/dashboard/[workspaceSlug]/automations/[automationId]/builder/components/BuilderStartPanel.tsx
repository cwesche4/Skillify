'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, LayoutTemplate, Sparkles, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import {
  WORKFLOW_TEMPLATE_CATEGORIES,
  WORKFLOW_STARTER_OPTIONS,
  type WorkflowStarterCategory,
} from '@/lib/workflows/previewDrafts'
import { modalPillClass, modalStarterChoiceClass } from './modalControlStyles'

const categoryCopy: Record<string, { title: string; description: string }> = {
  CRM: {
    title: 'Choose the CRM event that starts this workflow.',
    description:
      'Pick a trigger, then add the follow-up actions in the builder.',
  },
  Sales: {
    title: 'Start from a sales motion.',
    description:
      'Generate a sales sequence or browse templates built around common revenue workflows.',
  },
  'Client Onboarding': {
    title: 'Build a repeatable onboarding path.',
    description:
      'Start with welcome, project setup, team assignment, or intake steps.',
  },
  Marketing: {
    title: 'Create a marketing workflow.',
    description:
      'Capture, nurture, and follow up with leads using preview-safe starter paths.',
  },
  'Internal Operations': {
    title: 'Automate internal team work.',
    description:
      'Use operations starters for reports, tasks, approvals, and maintenance flows.',
  },
  'AI Assistant': {
    title: 'Create an AI-assisted workflow.',
    description:
      'Draft a workflow that classifies, replies, summarizes, or extracts structured data.',
  },
  Saved: {
    title: 'Start from a saved template.',
    description:
      'Saved user and team templates will appear here as reusable workflow templates.',
  },
}

export default function BuilderStartPanel({
  selectedCategory,
  onSelectCategory,
  onUseTemplate,
  onGenerateWithAi,
  onBrowseTemplates,
  onStartBlank,
  onDismiss,
}: {
  selectedCategory: string
  onSelectCategory: (category: string) => void
  onUseTemplate: (starter?: string) => void
  onGenerateWithAi: () => void
  onBrowseTemplates: () => void
  onStartBlank: () => void
  onDismiss: () => void
}) {
  const options =
    WORKFLOW_STARTER_OPTIONS[selectedCategory as WorkflowStarterCategory] ?? []
  const copy = categoryCopy[selectedCategory] ?? categoryCopy.Sales
  const [selectedStarter, setSelectedStarter] = useState('')

  useEffect(() => {
    setSelectedStarter('')
  }, [selectedCategory])

  const selectedStarterText = useMemo(() => selectedStarter, [selectedStarter])
  const starterActionEnabled =
    selectedCategory !== 'Saved' && Boolean(selectedStarterText)

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4">
      <div className="bg-slate-950/88 pointer-events-auto relative w-full max-w-2xl rounded-2xl border border-slate-800/80 p-5 text-center text-slate-100 shadow-2xl shadow-black/35 backdrop-blur">
        <button
          type="button"
          aria-label="Close workflow builder start card"
          title="Close"
          onClick={onDismiss}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">
          Workflow Builder
        </p>
        <h2 className="mt-2 text-xl font-semibold">
          Start building your workflow
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
          Choose how this automation should begin, or let Skillify generate a
          draft from your goal.
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {WORKFLOW_TEMPLATE_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => onSelectCategory(category)}
              className={modalPillClass({
                selected: selectedCategory === category,
              })}
            >
              {category}
            </button>
          ))}
        </div>

        <section className="mt-5 rounded-2xl border border-slate-800/70 bg-slate-900/35 p-4 text-left">
          <div className="text-center sm:text-left">
            <h3 className="text-sm font-semibold text-slate-100">
              {copy.title}
            </h3>
            <p className="mt-1 text-xs text-slate-400">{copy.description}</p>
          </div>

          {selectedCategory === 'Saved' ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/45 p-5 text-center">
              <p className="text-sm font-semibold text-slate-200">
                No saved templates yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                User and team saved templates will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {options.map((option) => {
                const isSelected = selectedStarterText === option
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedStarter(option)}
                    className={modalStarterChoiceClass({
                      selected: isSelected,
                    })}
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="min-w-0">{option}</span>
                      {isSelected ? (
                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-300/45">
                          <Check className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">Selected</span>
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            size="sm"
            variant="primary"
            leftIcon={<LayoutTemplate className="h-4 w-4" />}
            onClick={() => onUseTemplate(selectedStarterText)}
            disabled={!starterActionEnabled}
            className={
              starterActionEnabled
                ? 'w-full min-w-0 whitespace-nowrap px-2.5'
                : 'w-full min-w-0 whitespace-nowrap border-slate-800 bg-slate-900/55 px-2.5 text-slate-400 hover:bg-slate-900/55 hover:text-slate-400 disabled:opacity-100'
            }
          >
            {starterActionEnabled ? 'Use Template' : 'Select Template'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Sparkles className="h-4 w-4" />}
            onClick={onGenerateWithAi}
            className="w-full min-w-0 whitespace-nowrap"
          >
            Generate with AI
          </Button>
          <Button
            size="sm"
            variant="subtle"
            leftIcon={<LayoutTemplate className="h-4 w-4" />}
            onClick={onBrowseTemplates}
            className="w-full min-w-0 whitespace-nowrap"
          >
            Browse Templates
          </Button>
          <Button
            size="sm"
            variant="subtle"
            onClick={onStartBlank}
            className="w-full min-w-0 whitespace-nowrap"
          >
            Start Blank
          </Button>
        </div>
      </div>
    </div>
  )
}
