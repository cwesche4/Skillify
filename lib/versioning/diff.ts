import type { AutomationSnapshot } from './types'

// Stubbed diff builder — read-only placeholder for future AI-assisted diffs.
export function diffSnapshots(
  _a: AutomationSnapshot,
  _b: AutomationSnapshot,
): { summary: string; changes: any[] } {
  return {
    summary: 'Diff calculation not implemented yet (read-only stub)',
    changes: [],
  }
}
