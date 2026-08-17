import { NextResponse } from 'next/server'
import { listTemplates } from '@/lib/templates/registry'
import { requireWorkspaceRole } from '@/lib/auth/requireRole'

// Canonical templates.
// Read-only reference only.
// Must be duplicated before modification or execution.
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const templates = listTemplates()
  const template = templates.find((t) => t.id === params.id)
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }
  const scopedTemplate = template as typeof template & { workspaceId?: string }
  if (scopedTemplate.workspaceId) {
    const guard = await requireWorkspaceRole(scopedTemplate.workspaceId, [
      'owner',
      'admin',
    ])
    if (!guard.allowed)
      return NextResponse.json({ error: 'Forbidden' }, { status: guard.status })
  }
  // Duplication is explicit; no persistence or execution is triggered here.
  return NextResponse.json({
    duplicatedFrom: template.id,
    flow: template.flow,
    label: template.label,
    description: template.description,
    version: template.version,
  })
}
