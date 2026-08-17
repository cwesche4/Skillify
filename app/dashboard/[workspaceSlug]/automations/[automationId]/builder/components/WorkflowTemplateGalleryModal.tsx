'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  WORKFLOW_STARTER_OPTIONS,
  type WorkflowStarterCategory,
} from '@/lib/workflows/previewDrafts'
import { modalPillClass } from './modalControlStyles'

const templateCategories = [
  'Sales',
  'CRM',
  'Client Onboarding',
  'Marketing',
  'Internal Operations',
  'AI Assistant',
  'Saved',
]

function templateOutcome(category: string, starter: string) {
  if (category === 'CRM')
    return `Start from ${starter} and create the right CRM follow-up.`
  if (category === 'Client Onboarding')
    return `Draft an onboarding flow for ${starter.toLowerCase()}.`
  if (category === 'Marketing')
    return `Create a marketing workflow for ${starter.toLowerCase()}.`
  if (category === 'Internal Operations')
    return `Coordinate internal work for ${starter.toLowerCase()}.`
  if (category === 'AI Assistant')
    return `Use AI assistance for ${starter.toLowerCase()}.`
  return `Create a sales workflow for ${starter.toLowerCase()}.`
}

function templateTrigger(category: string, starter: string) {
  if (starter.toLowerCase().includes('missed call')) return 'Missed call logged'
  if (starter.toLowerCase().includes('intake')) return 'Client created'
  if (starter.toLowerCase().includes('equipment'))
    return 'Equipment issue logged'
  if (starter.toLowerCase().includes('classify')) return 'Lead created'
  if (category === 'Marketing') return 'Marketing event'
  if (category === 'Internal Operations') return 'Work item created'
  if (category === 'Client Onboarding') return 'Client created'
  if (category === 'CRM') return starter
  return 'Lead created'
}

export default function WorkflowTemplateGalleryModal({
  open,
  category,
  onClose,
  onCategoryChange,
  onUseTemplate,
}: {
  open: boolean
  category: string
  onClose: () => void
  onCategoryChange?: (category: string) => void
  onUseTemplate: (category: string, starter: string) => void
}) {
  const [selectedCategory, setSelectedCategory] = useState(category)

  useEffect(() => {
    if (!open) return
    setSelectedCategory(category)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [category, onClose, open])

  const templates = useMemo(() => {
    if (selectedCategory === 'Saved') return []
    const options =
      WORKFLOW_STARTER_OPTIONS[selectedCategory as WorkflowStarterCategory] ??
      []
    return options.map((starter) => ({
      id: `${selectedCategory}:${starter}`,
      group: selectedCategory,
      name: `${starter} workflow`,
      outcome: templateOutcome(selectedCategory, starter),
      trigger: templateTrigger(selectedCategory, starter),
      steps:
        starter === 'Missed call recovery' ||
        starter === 'Send Intake Form' ||
        starter === 'Equipment Maintenance'
          ? 5
          : 4,
      tier: 'Preview',
      starter,
    }))
  }, [selectedCategory])

  const chooseCategory = (nextCategory: string) => {
    setSelectedCategory(nextCategory)
    onCategoryChange?.(nextCategory)
  }

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
        aria-labelledby="workflow-template-panel-title"
        className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/45 ring-1 ring-cyan-300/10"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-4">
          <div>
            <h2
              id="workflow-template-panel-title"
              className="text-base font-semibold text-slate-50"
            >
              Browse workflow templates
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              Start from a business outcome, then customize the draft on the
              canvas.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close workflow templates panel"
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(88vh-88px)] space-y-4 overflow-y-auto p-5">
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-3 text-xs text-slate-400">
            <div>
              Showing templates for{' '}
              <span className="text-cyan-100">{selectedCategory}</span>. More
              role-based templates will be added as workflow persistence
              expands.
            </div>
            <div className="flex flex-wrap gap-2">
              {templateCategories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => chooseCategory(item)}
                  className={modalPillClass({
                    selected: selectedCategory === item,
                  })}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {templates.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/35 p-5 text-center">
              <p className="text-sm font-semibold text-slate-200">
                {selectedCategory === 'Saved'
                  ? 'No saved templates yet'
                  : 'No templates in this category yet'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedCategory === 'Saved'
                  ? 'Saved user and team templates will appear here.'
                  : 'Choose another category or generate a workflow draft with AI.'}
              </p>
            </div>
          )}

          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {selectedCategory}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex min-h-[184px] flex-col rounded-xl border border-slate-800 bg-slate-900/45 p-3 transition hover:border-slate-700 hover:bg-slate-900/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {template.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {template.outcome}
                      </p>
                    </div>
                    <Badge size="xs" variant="blue">
                      {template.tier}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-[11px] text-slate-400">
                    <span>Trigger: {template.trigger}</span>
                    <span>{template.steps} steps</span>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    className="mt-auto"
                    onClick={() =>
                      onUseTemplate(selectedCategory, template.starter)
                    }
                  >
                    Use Template
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}
