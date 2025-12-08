'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface Template {
  id: string
  slug: string
  name: string
  description: string
  category: string
}

export default function AutomationTemplatesPage() {
  const params = useParams<{ automationId: string }>()
  const router = useRouter()

  const [templates, setTemplates] = useState<Template[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/automations/templates')
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setError(json.error ?? 'Unable to load templates.')
          return
        }
        setTemplates(json.data.templates ?? [])
      })
      .catch(() => setError('Unable to load templates.'))
  }, [])

  const handleUseTemplate = async (tpl: Template) => {
    // simple redirect to builder – you could also add an endpoint
    // to clone template into this automation's flow.
    router.push(
      `/dashboard/automations/${params.automationId}/builder?template=${tpl.slug}`,
    )
  }

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h2">Automation Templates</h1>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid-3">
        {templates.map((tpl) => (
          <div key={tpl.id} className="card hover-lift">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="h4">{tpl.name}</h2>
              <Badge size="sm">{tpl.category}</Badge>
            </div>
            <p className="mb-4 text-sm text-slate-300">{tpl.description}</p>
            <Button size="sm" onClick={() => handleUseTemplate(tpl)}>
              Use this template
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
