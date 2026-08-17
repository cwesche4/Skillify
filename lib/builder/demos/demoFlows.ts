// Demo flows.
// For demonstration only.
// Deterministic, read-only, non-inferential.
export type DemoFlow = {
  id: string
  name: string
  description: string
  readOnly: boolean
}

export const demoFlows: DemoFlow[] = [
  {
    id: 'demo-lead-intake',
    name: 'Demo: Lead Intake',
    description:
      'Curated demo for lead capture and routing. Read-only; duplicate to edit.',
    readOnly: true,
  },
  {
    id: 'demo-approval',
    name: 'Demo: Approval Flow',
    description:
      'Shows approval pause and explicit wait state. Read-only; duplicate to edit.',
    readOnly: true,
  },
  {
    id: 'demo-ai-classification',
    name: 'Demo: AI Classification',
    description:
      'Explicit AI outputs, no inference. Read-only; duplicate to edit.',
    readOnly: true,
  },
  {
    id: 'demo-north-star-lead-intake',
    name: 'North Star Demo: Intelligent Lead Intake',
    description:
      'Trust-first, deterministic flow showing edge-first build, AI outputs, approval wait, run scoping, and simulated failure path. Read-only; duplicate to edit.',
    readOnly: true,
  },
]
