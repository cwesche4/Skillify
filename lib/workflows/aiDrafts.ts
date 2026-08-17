import type { Workflow, WorkflowValidationResult } from '@/lib/workflows/types'
import { validateWorkflow } from '@/lib/workflows/validation'

export type AiWorkflowDraftRequest = {
  workspaceId: string
  prompt: string
  requestedBy?: string
}

export type AiWorkflowDraftResult = {
  workflow: Workflow
  validation: WorkflowValidationResult
  requiresConfirmation: true
  safetyNotes: string[]
}

export function createEmptyAiWorkflowDraft(
  request: AiWorkflowDraftRequest,
): AiWorkflowDraftResult {
  const workflow: Workflow = {
    id: `ai-draft-${Date.now()}`,
    workspaceId: request.workspaceId,
    name: 'AI workflow draft',
    description: request.prompt,
    status: 'draft',
    nodes: [],
    edges: [],
  }

  return {
    workflow,
    validation: validateWorkflow(workflow),
    requiresConfirmation: true,
    safetyNotes: [
      'AI-generated workflows must validate before they can be enabled.',
      'External communication and data mutation nodes require user confirmation.',
      'Preview execution should run before activation.',
    ],
  }
}

export function validateAiGeneratedWorkflowDraft(workflow: Workflow) {
  // Future AI generation should call this before saving, enabling, or executing
  // drafts so the same validation engine gates UI, APIs, and automations.
  return validateWorkflow({
    ...workflow,
    status: 'draft',
  })
}
