import { demoFlows } from '@/lib/builder/demos/demoFlows'

// Demo flows.
// Read-only reference.
// Must be duplicated to become production.
export function promoteDemoFlow(demoId: string) {
  const demo = demoFlows.find((d) => d.id === demoId)
  if (!demo) throw new Error('Demo flow not found')
  return {
    flow: { nodes: [], edges: [] },
    name: `${demo.name} (promoted)`,
    description: demo.description,
  }
}
