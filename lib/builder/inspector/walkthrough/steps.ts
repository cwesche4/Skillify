export type WalkthroughStep = {
  id: string
  title: string
  description: string
  tab?: string
  nodeTypes?: string[]
}

// Static, non-AI steps shown when walkthroughs are enabled.
export const INSPECTOR_WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'header-overview',
    title: 'Inspector header',
    description: 'Use mode, presets, pin, and follow selection controls here.',
  },
  {
    id: 'tabs-overview',
    title: 'Tabs',
    description:
      'Switch between Config, Data, Logs, and AI to inspect details.',
  },
  {
    id: 'presets',
    title: 'Presets',
    description: 'Save and reapply node configurations quickly from Config.',
    tab: 'config',
  },
  {
    id: 'validation',
    title: 'Validation',
    description: 'Review validation states to resolve errors and warnings.',
  },
  {
    id: 'ai-suggestions',
    title: 'AI assistance',
    description:
      'If enabled, AI suggestions and auto-fix appear in the AI section.',
    tab: 'ai',
  },
]
