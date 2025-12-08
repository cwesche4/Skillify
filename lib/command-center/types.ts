// =============================================
// Skillify — Command Center Core Type System
// =============================================

// -------------------------------
// SEARCH MODES
// -------------------------------
export type CommandCenterMode = 'search' | 'actions' | 'ai' | 'onboarding'

export type CommandCenterSearchMode =
  | 'all'
  | 'workspaces'
  | 'automations'
  | 'runs'
  | 'members'

// -------------------------------
// SEARCH RESULT TYPES
// -------------------------------

export interface WorkspaceSearchResult {
  type: 'workspace'
  id: string
  name: string
  slug: string
}

export interface AutomationSearchResult {
  type: 'automation'
  id: string
  name: string
  workspaceId: string
  workspaceName: string
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED'
}

export interface RunSearchResult {
  type: 'run'
  id: string
  automationId: string
  automationName: string
  workspaceId: string
  createdAt: string
  status: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING'
}

export interface MemberSearchResult {
  type: 'member'
  id: string
  clerkId: string
  workspaceName: string
  role: string
}

export type CommandSearchResult =
  | WorkspaceSearchResult
  | AutomationSearchResult
  | RunSearchResult
  | MemberSearchResult

export interface CommandSearchResponse {
  results: CommandSearchResult[]
}

// -------------------------------
// AI COACH (Command Center)
// -------------------------------

export interface AiCoachResponseBody {
  message: string // The AI response text
  reasoning?: string // Optional chain-of-thought summary
  recommendedFix?: string // Optional remediation
  confidence?: number // Optional 0–1 confidence for UI
}

// -------------------------------
// ONBOARDING SYSTEM
// -------------------------------

export interface OnboardingItem {
  id: string
  title: string
  description: string
  href?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
}

export interface OnboardingResponse {
  checklist: OnboardingItem[]
}

// -------------------------------
// UTILITY TYPES FOR FRONTEND
// -------------------------------
export interface Workspace {
  id: string
  name: string
  slug: string
}
