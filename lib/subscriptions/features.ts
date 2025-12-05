// lib/subscriptions/features.ts

export const FEATURE_MATRIX = {
  basic: {
    aiNodes: false,
    grouping: false,
    autoLayout: true,
    replay: false,
    realtimeLogs: false,
    heatmaps: false,
    runCompare: false,
    templates: false,
    aiCoach: false,
  },
  pro: {
    aiNodes: true,
    grouping: true,
    autoLayout: true,
    replay: true,
    realtimeLogs: false,
    heatmaps: false,
    runCompare: false,
    templates: true,
    aiCoach: true,
  },
  elite: {
    aiNodes: true,
    grouping: true,
    autoLayout: true,
    replay: true,
    realtimeLogs: true,
    heatmaps: true,
    runCompare: true,
    templates: true,
    aiCoach: true,
  },
} as const

export type TierKey = keyof typeof FEATURE_MATRIX
export type FeatureKey = keyof (typeof FEATURE_MATRIX)["basic"]
