export type ReportStatus = 'ready' | 'scheduled' | 'draft' | 'failed'

export type ReportType =
  | 'summary'
  | 'automation'
  | 'clients'
  | 'operations'
  | 'growth'

export type ReportMetric = {
  label: string
  value: string
  helper?: string
}

export type WorkspaceReport = {
  id: string
  workspaceId: string
  title: string
  type: ReportType
  status: ReportStatus
  generatedAt: string | null
  createdBy: string
  shared: boolean
  summary: string
  metrics: ReportMetric[]
  recommendations: string[]
  isMock?: boolean
}

export type ScheduledReport = {
  id: string
  workspaceId: string
  reportType: ReportType
  title: string
  frequency: string
  recipients: string[]
  nextRunAt: string
  enabled: boolean
  isMock?: boolean
}

export type BusinessHealthScore = {
  score: number
  maxScore: number
  status: string
  helper: string
  signals: string[]
}

export type ReportChartMetric = {
  id: string
  title: string
  description: string
  type: 'bars' | 'comparison' | 'grouped'
  values: number[]
  labels: string[]
}

export type ReportOpportunity = {
  id: string
  type: 'revenue' | 'risk' | 'efficiency'
  title: string
  body: string
  impact: string
  cta: string
}

export type ReportInsight = {
  id: string
  title: string
  body: string
  priority: 'low' | 'medium' | 'high'
}

export type ReportAction = {
  label: string
  kind: 'workflow' | 'automation' | 'task' | 'ai-coach' | 'placeholder'
}

export type ReportPriority = {
  id: string
  title: string
  impact: 'high' | 'medium' | 'low'
  impactNote: string
  action?: ReportAction
}

export type EstimatedImpact = {
  id: string
  value: string
  label: string
  accent: 'green' | 'blue'
}

export type AiReportRecommendation = {
  id: string
  title: string
  explanation: string
  action: ReportAction
}

export type ReportChangeEvent = {
  id: string
  when: string
  title: string
  kind: 'warning' | 'clients' | 'report' | 'completed'
}

export type IndustryBenchmark = {
  id: string
  metric: string
  yourValue: string
  industryAverage: string
  status: 'ahead' | 'watch' | 'behind'
}

export type AdvisorScorecardItem = {
  id: string
  label: string
}

export type AdvisorScorecard = {
  grade: string
  status: string
  score: number
  maxScore: number
  summary: string
  strengths: AdvisorScorecardItem[]
  risks: AdvisorScorecardItem[]
  opportunities: AdvisorScorecardItem[]
}
