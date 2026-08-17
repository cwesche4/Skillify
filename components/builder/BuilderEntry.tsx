import type { FC } from 'react'
import { useEffect, useMemo, useState } from 'react'
import TemplatesPanel from './TemplatesPanel'
import TemplatePreview from './TemplatePreview'
import type { TemplateMeta } from '@/lib/templates/registry'
import RecentTemplates from './RecentTemplates'
import { Button } from '@/components/ui/Button'

type Props = {
  templates: TemplateMeta[]
  onSelectTemplate: (template: TemplateMeta | null) => void
  preferredTemplateId?: string | null
  recentTemplateIds?: string[]
}

export const BuilderEntry: FC<Props> = ({
  templates,
  onSelectTemplate,
  preferredTemplateId,
  recentTemplateIds = [],
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(
    preferredTemplateId ?? null,
  )
  const [blankSelected, setBlankSelected] = useState<boolean>(
    preferredTemplateId === 'blank',
  )

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId),
    [templates, selectedId],
  )

  useEffect(() => {
    if (blankSelected) {
      onSelectTemplate(null)
    } else if (selectedTemplate) {
      onSelectTemplate(selectedTemplate)
    }
  }, [blankSelected, selectedTemplate, onSelectTemplate])

  const recentTemplates = useMemo(
    () => templates.filter((t) => recentTemplateIds.includes(t.id)),
    [templates, recentTemplateIds],
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Start from a template
          </h2>
          <p className="text-[12px] text-slate-400">
            Templates are examples you can clone. No automation runs until you
            save.
          </p>
        </div>
        <Button
          variant="subtle"
          size="sm"
          onClick={() => {
            setSelectedId(null)
            setBlankSelected(true)
          }}
        >
          Blank automation
        </Button>
      </div>

      {recentTemplates.length > 0 ? (
        <RecentTemplates
          templates={recentTemplates}
          onSelect={(tpl) => {
            setBlankSelected(false)
            setSelectedId(tpl.id)
          }}
        />
      ) : null}

      <div className="grid min-h-0 grid-cols-2 gap-4">
        <div className="min-h-0 rounded border border-slate-800 bg-slate-950">
          <TemplatesPanel
            templates={templates}
            onSelect={(tpl) => {
              setBlankSelected(false)
              setSelectedId(tpl.id)
            }}
            hideFilters={false}
          />
        </div>
        <div className="min-h-0 rounded border border-slate-800 bg-slate-950 p-2">
          {selectedTemplate && !blankSelected ? (
            <TemplatePreview template={selectedTemplate} readOnly />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Select a template or choose blank to start from scratch.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BuilderEntry
