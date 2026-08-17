export type TaskStatus =
  | 'Open'
  | 'In Progress'
  | 'Waiting'
  | 'Completed'
  | 'Canceled'
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent'
export type TaskSource =
  | 'Manual'
  | 'Workflow'
  | 'AI Coach'
  | 'Lead Automation'
  | 'Missed Call'
  | 'Lead Follow-Up'
  | 'Opportunity'
  | 'Client'
  | 'Service Request'
  | 'Project'
  | 'Automation'

export type RelatedRecordType =
  | 'client'
  | 'lead'
  | 'opportunity'
  | 'serviceRequest'
  | 'project'
  | 'internal'
  | 'automation'

export type WorkItemParentType =
  | 'serviceRequest'
  | 'project'
  | 'client'
  | 'opportunity'
  | 'lead'
  | 'internal'

export type WorkItemChecklistItem = {
  id: string
  title: string
  completed: boolean
  completedByOwnerId?: string
  completedAt?: string
  notes?: string
}

export type TaskRecord = {
  id: string
  workspaceId: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  relatedRecord: string
  relatedType:
    | 'Lead'
    | 'Opportunity'
    | 'Client'
    | 'Service Request'
    | 'Project'
    | 'Internal'
    | 'Automation'
  relatedRecordType: RelatedRecordType
  relatedRecordId: string
  relatedRecordLabel: string
  parentType?: WorkItemParentType
  parentId?: string
  parentLabel?: string
  checklist?: WorkItemChecklistItem[]
  clientId?: string
  clientName?: string
  dueDate: string
  ownerId: string
  assignedOwner?: string
  source: TaskSource
  createdAt: string
  completedAt?: string
  estimatedTime: string
  actualTime?: string
  description: string
  notes: string
  timeline: Array<{
    title: string
    detail: string
    timestamp: string
    tone: 'cyan' | 'purple' | 'green' | 'amber' | 'rose' | 'slate'
  }>
}

export const demoTaskToday = '2026-06-29'

export function createMockWorkspaceTasks(workspaceId: string): TaskRecord[] {
  return [
    {
      id: 'work-item-commonwealth-homepage-content',
      workspaceId,
      title: 'Prepare homepage emergency copy',
      status: 'In Progress',
      priority: 'High',
      relatedRecord: 'Update emergency service homepage copy',
      relatedType: 'Service Request',
      relatedRecordType: 'serviceRequest',
      relatedRecordId: 'request-commonwealth-homepage',
      relatedRecordLabel: 'Update emergency service homepage copy',
      parentType: 'serviceRequest',
      parentId: 'request-commonwealth-homepage',
      parentLabel: 'Update emergency service homepage copy',
      clientId: 'client-jason-miller',
      clientName: 'Commonwealth Gas & Well Service',
      dueDate: '2026-06-30',
      ownerId: 'owner-user-corbin',
      source: 'Service Request',
      createdAt: '2026-06-28',
      estimatedTime: '1 hr',
      description:
        'Draft and review homepage copy for emergency gas line repair before the customer campaign starts.',
      notes: 'Use the approved service list from the client profile.',
      checklist: [
        {
          id: 'commonwealth-copy-review-services',
          title: 'Review approved service list',
          completed: true,
          completedByOwnerId: 'owner-user-corbin',
          completedAt: '2026-06-28',
        },
        {
          id: 'commonwealth-copy-draft-hero',
          title: 'Draft emergency service hero copy',
          completed: true,
          completedByOwnerId: 'owner-user-corbin',
          completedAt: '2026-06-29',
        },
        {
          id: 'commonwealth-copy-send-approval',
          title: 'Send copy for customer approval',
          completed: false,
        },
      ],
      timeline: [
        {
          title: 'Work item created',
          detail: 'Created from the service request plan.',
          timestamp: '2026-06-28 10:15 AM',
          tone: 'cyan',
        },
        {
          title: 'Checklist started',
          detail: 'Two of three checklist items are complete.',
          timestamp: '2026-06-29 2:30 PM',
          tone: 'purple',
        },
      ],
    },
    {
      id: 'work-item-commonwealth-homepage-publish',
      workspaceId,
      title: 'Publish approved homepage update',
      status: 'Open',
      priority: 'Medium',
      relatedRecord: 'Update emergency service homepage copy',
      relatedType: 'Service Request',
      relatedRecordType: 'serviceRequest',
      relatedRecordId: 'request-commonwealth-homepage',
      relatedRecordLabel: 'Update emergency service homepage copy',
      parentType: 'serviceRequest',
      parentId: 'request-commonwealth-homepage',
      parentLabel: 'Update emergency service homepage copy',
      clientId: 'client-jason-miller',
      clientName: 'Commonwealth Gas & Well Service',
      dueDate: '2026-07-01',
      ownerId: 'owner-team-ops',
      source: 'Service Request',
      createdAt: '2026-06-28',
      estimatedTime: '30 min',
      description:
        'Publish the homepage copy after the customer approves the final wording.',
      notes: 'Do not publish before copy approval is logged.',
      checklist: [
        {
          id: 'commonwealth-publish-confirm-approval',
          title: 'Confirm customer approval',
          completed: false,
        },
        {
          id: 'commonwealth-publish-update-site',
          title: 'Update homepage content',
          completed: false,
        },
        {
          id: 'commonwealth-publish-qa',
          title: 'QA mobile and desktop pages',
          completed: false,
        },
      ],
      timeline: [
        {
          title: 'Work item created',
          detail: 'Created as a follow-up work item for the service request.',
          timestamp: '2026-06-28 10:20 AM',
          tone: 'cyan',
        },
      ],
    },
    {
      id: 'work-item-johnson-lead-routing',
      workspaceId,
      title: 'Route weekend quote requests',
      status: 'Open',
      priority: 'Urgent',
      relatedRecord: 'Follow up with spring campaign leads',
      relatedType: 'Service Request',
      relatedRecordType: 'serviceRequest',
      relatedRecordId: 'request-johnson-lead',
      relatedRecordLabel: 'Follow up with spring campaign leads',
      parentType: 'serviceRequest',
      parentId: 'request-johnson-lead',
      parentLabel: 'Follow up with spring campaign leads',
      clientId: 'client-sarah-johnson',
      clientName: 'Johnson Landscaping',
      dueDate: '2026-06-29',
      ownerId: 'owner-team-support',
      source: 'Service Request',
      createdAt: '2026-06-29',
      estimatedTime: '25 min',
      description:
        'Review weekend quote requests and route each lead to the correct next action.',
      notes: 'Prioritize the commercial lawn care inquiry.',
      checklist: [
        {
          id: 'johnson-route-commercial',
          title: 'Prioritize commercial lawn care inquiry',
          completed: false,
        },
        {
          id: 'johnson-route-residential',
          title: 'Assign residential quote requests',
          completed: false,
        },
      ],
      timeline: [
        {
          title: 'Work item created',
          detail: 'Created from urgent service request triage.',
          timestamp: '2026-06-29 8:05 AM',
          tone: 'rose',
        },
      ],
    },
    {
      id: 'work-item-commonwealth-project-launch',
      workspaceId,
      title: 'Coordinate launch checklist',
      status: 'Open',
      priority: 'Medium',
      relatedRecord: 'Commonwealth Website Refresh',
      relatedType: 'Project',
      relatedRecordType: 'project',
      relatedRecordId: 'project-commonwealth-refresh',
      relatedRecordLabel: 'Commonwealth Website Refresh',
      parentType: 'project',
      parentId: 'project-commonwealth-refresh',
      parentLabel: 'Commonwealth Website Refresh',
      clientId: 'client-jason-miller',
      clientName: 'Commonwealth Gas & Well Service',
      dueDate: '2026-07-03',
      ownerId: 'owner-team-ops',
      source: 'Project',
      createdAt: '2026-06-29',
      estimatedTime: '45 min',
      description:
        'Coordinate the final launch readiness checklist for the Commonwealth project.',
      notes: 'Project work items share the same internal work model.',
      checklist: [
        {
          id: 'commonwealth-project-content',
          title: 'Confirm content approvals',
          completed: true,
          completedAt: '2026-06-29',
        },
        {
          id: 'commonwealth-project-analytics',
          title: 'Verify analytics tags',
          completed: false,
        },
        {
          id: 'commonwealth-project-handoff',
          title: 'Prepare customer handoff notes',
          completed: false,
        },
      ],
      timeline: [
        {
          title: 'Work item created',
          detail: 'Created from project launch planning.',
          timestamp: '2026-06-29 1:00 PM',
          tone: 'cyan',
        },
      ],
    },
    {
      id: 'work-item-internal-monthly-report',
      workspaceId,
      title: 'Prepare monthly operations report',
      status: 'Open',
      priority: 'Low',
      relatedRecord: 'Internal operations',
      relatedType: 'Internal',
      relatedRecordType: 'internal',
      relatedRecordId: 'internal-operations',
      relatedRecordLabel: 'Internal operations',
      parentType: 'internal',
      parentId: 'internal-operations',
      parentLabel: 'Internal operations',
      dueDate: '2026-07-05',
      ownerId: 'owner-team-ops',
      source: 'Manual',
      createdAt: '2026-06-29',
      estimatedTime: '40 min',
      description:
        'Prepare the monthly operations report for workspace leadership review.',
      notes: 'Standalone internal work item with no customer parent.',
      checklist: [
        {
          id: 'monthly-report-export',
          title: 'Export dashboard metrics',
          completed: false,
        },
        {
          id: 'monthly-report-summary',
          title: 'Write executive summary',
          completed: false,
        },
      ],
      timeline: [
        {
          title: 'Work item created',
          detail: 'Created as standalone internal work.',
          timestamp: '2026-06-29 9:45 AM',
          tone: 'cyan',
        },
      ],
    },
    {
      id: 'task-qualification-questions',
      workspaceId,
      title: 'Send qualification questions',
      status: 'Open',
      priority: 'High',
      relatedRecord: 'Rachel Adams',
      relatedType: 'Lead',
      relatedRecordType: 'lead',
      relatedRecordId: 'lead-rachel-adams',
      relatedRecordLabel: 'Rachel Adams',
      dueDate: '2026-06-29',
      ownerId: 'owner-user-corbin',
      source: 'Lead Follow-Up',
      createdAt: '2026-06-27',
      estimatedTime: '15 min',
      description:
        'Send intake questions to confirm goals, timeline, budget, and workflow needs before booking discovery.',
      notes:
        'Lead came through the website and asked about onboarding automation.',
      timeline: [
        {
          title: 'Task created',
          detail: 'Generated from lead follow-up workflow.',
          timestamp: '2026-06-27 9:10 AM',
          tone: 'cyan',
        },
        {
          title: 'Assigned to Corbin',
          detail: 'Owner set from lead routing rules.',
          timestamp: '2026-06-27 9:12 AM',
          tone: 'purple',
        },
        {
          title: 'Reminder sent',
          detail: 'Due today reminder queued.',
          timestamp: '2026-06-29 8:00 AM',
          tone: 'amber',
        },
      ],
    },
    {
      id: 'task-proposal-package',
      workspaceId,
      title: 'Prepare proposal package',
      status: 'In Progress',
      priority: 'High',
      relatedRecord: 'NorthStar Electrical',
      relatedType: 'Opportunity',
      relatedRecordType: 'opportunity',
      relatedRecordId: 'opportunity-northstar-electrical',
      relatedRecordLabel: 'NorthStar Electrical',
      dueDate: '2026-06-30',
      ownerId: 'owner-user-corbin',
      source: 'Opportunity',
      createdAt: '2026-06-24',
      estimatedTime: '45 min',
      description:
        'Prepare the proposal package for the operations automation opportunity, including implementation phases and timeline.',
      notes:
        'Include CRM follow-up workflow, missed-call routing, and reporting setup.',
      timeline: [
        {
          title: 'Task created',
          detail: 'Created from opportunity next step.',
          timestamp: '2026-06-24 2:20 PM',
          tone: 'cyan',
        },
        {
          title: 'Status changed to In Progress',
          detail: 'Proposal outline started.',
          timestamp: '2026-06-28 11:35 AM',
          tone: 'purple',
        },
      ],
    },
    {
      id: 'task-send-homepage-wireframe',
      workspaceId,
      title: 'Send homepage wireframe',
      status: 'Open',
      priority: 'High',
      relatedRecord: 'Commonwealth Gas & Well Service',
      relatedType: 'Client',
      relatedRecordType: 'client',
      relatedRecordId: 'client-jason-miller',
      relatedRecordLabel: 'Commonwealth Gas & Well Service',
      clientId: 'client-jason-miller',
      dueDate: '2026-06-29',
      ownerId: 'owner-user-corbin',
      source: 'Manual',
      createdAt: '2026-06-27',
      estimatedTime: '30 min',
      description:
        'Send the first homepage wireframe and ask for approval on service page structure.',
      notes:
        'Client is waiting for the first visual direction before content review.',
      timeline: [
        {
          title: 'Task created',
          detail: 'Created from client fulfillment next action.',
          timestamp: '2026-06-27 10:00 AM',
          tone: 'cyan',
        },
      ],
    },
    {
      id: 'task-confirm-final-service-list',
      workspaceId,
      title: 'Confirm final service list',
      status: 'Open',
      priority: 'Medium',
      relatedRecord: 'Commonwealth Gas & Well Service',
      relatedType: 'Client',
      relatedRecordType: 'client',
      relatedRecordId: 'client-jason-miller',
      relatedRecordLabel: 'Commonwealth Gas & Well Service',
      clientId: 'client-jason-miller',
      dueDate: '2026-07-01',
      ownerId: 'owner-team-ops',
      source: 'Manual',
      createdAt: '2026-06-28',
      estimatedTime: '20 min',
      description:
        'Confirm the final list of services before publishing the refreshed homepage.',
      notes: 'Needed before final copy pass.',
      timeline: [
        {
          title: 'Task created',
          detail: 'Added during project review.',
          timestamp: '2026-06-28 2:15 PM',
          tone: 'cyan',
        },
      ],
    },
    {
      id: 'task-onboarding-documents',
      workspaceId,
      title: 'Send onboarding documents',
      status: 'Waiting',
      priority: 'Medium',
      relatedRecord: 'Brooks Cleaning Co.',
      relatedType: 'Client',
      relatedRecordType: 'client',
      relatedRecordId: 'client-amanda-brooks',
      relatedRecordLabel: 'Brooks Cleaning Co.',
      clientId: 'client-amanda-brooks',
      dueDate: '2026-07-02',
      ownerId: 'owner-system-skillify-ai',
      source: 'Automation',
      createdAt: '2026-06-28',
      estimatedTime: '10 min',
      description:
        'Send onboarding documents and next-step checklist for the new client setup.',
      notes:
        'Automation drafted the email, but the workspace owner should review before sending.',
      timeline: [
        {
          title: 'Task created',
          detail: 'Generated from client onboarding workflow.',
          timestamp: '2026-06-28 4:05 PM',
          tone: 'cyan',
        },
        {
          title: 'Waiting on review',
          detail: 'AI-generated draft needs approval.',
          timestamp: '2026-06-28 4:06 PM',
          tone: 'amber',
        },
      ],
    },
    {
      id: 'task-draft-review-request-message',
      workspaceId,
      title: 'Draft review request message',
      status: 'Open',
      priority: 'Medium',
      relatedRecord: 'Brooks Cleaning Co.',
      relatedType: 'Client',
      relatedRecordType: 'client',
      relatedRecordId: 'client-amanda-brooks',
      relatedRecordLabel: 'Brooks Cleaning Co.',
      clientId: 'client-amanda-brooks',
      dueDate: '2026-06-28',
      ownerId: 'owner-team-ops',
      source: 'Automation',
      createdAt: '2026-06-24',
      estimatedTime: '15 min',
      description:
        'Draft a friendly review request message for completed cleaning jobs.',
      notes: 'Waiting on customer review link before launch.',
      timeline: [
        {
          title: 'Task created',
          detail: 'Created from review request setup.',
          timestamp: '2026-06-24 1:30 PM',
          tone: 'cyan',
        },
        {
          title: 'Reminder sent',
          detail: 'Follow-up reminder queued because the draft is overdue.',
          timestamp: '2026-06-29 8:15 AM',
          tone: 'amber',
        },
      ],
    },
    {
      id: 'task-review-estimate',
      workspaceId,
      title: 'Review estimate',
      status: 'Open',
      priority: 'Medium',
      relatedRecord: 'Carter Plumbing',
      relatedType: 'Client',
      relatedRecordType: 'client',
      relatedRecordId: 'client-mike-carter',
      relatedRecordLabel: 'Carter Plumbing',
      clientId: 'client-mike-carter',
      dueDate: '2026-06-30',
      ownerId: 'owner-user-corbin',
      source: 'Manual',
      createdAt: '2026-06-26',
      estimatedTime: '20 min',
      description:
        'Review estimate questions and confirm whether phased automation setup is needed.',
      notes: 'Client asked about setup timeline.',
      timeline: [
        {
          title: 'Task created',
          detail: 'Created after estimate review.',
          timestamp: '2026-06-26 3:45 PM',
          tone: 'cyan',
        },
      ],
    },
    {
      id: 'task-schedule-discovery-call',
      workspaceId,
      title: 'Schedule discovery call',
      status: 'Open',
      priority: 'High',
      relatedRecord: 'Johnson Landscaping',
      relatedType: 'Client',
      relatedRecordType: 'client',
      relatedRecordId: 'client-sarah-johnson',
      relatedRecordLabel: 'Johnson Landscaping',
      clientId: 'client-sarah-johnson',
      dueDate: '2026-06-28',
      ownerId: 'owner-team-support',
      source: 'Manual',
      createdAt: '2026-06-25',
      estimatedTime: '10 min',
      description:
        'Schedule the kickoff discovery call for the spring campaign onboarding.',
      notes: 'Customer needs campaign timing confirmed this week.',
      timeline: [
        {
          title: 'Task created',
          detail: 'Created from client onboarding next action.',
          timestamp: '2026-06-25 12:10 PM',
          tone: 'cyan',
        },
      ],
    },
    {
      id: 'task-schedule-performance-review',
      workspaceId,
      title: 'Schedule 30-day performance review',
      status: 'Completed',
      priority: 'Low',
      relatedRecord: 'Reed HVAC',
      relatedType: 'Client',
      relatedRecordType: 'client',
      relatedRecordId: 'client-daniel-reed',
      relatedRecordLabel: 'Reed HVAC',
      clientId: 'client-daniel-reed',
      dueDate: '2026-06-20',
      ownerId: 'owner-team-ops',
      source: 'Manual',
      createdAt: '2026-06-18',
      completedAt: '2026-06-24',
      estimatedTime: '10 min',
      actualTime: '8 min',
      description:
        'Schedule a 30-day performance review after the automation package launch.',
      notes: 'Completed after automation setup launched.',
      timeline: [
        {
          title: 'Task created',
          detail: 'Created from maintenance workflow.',
          timestamp: '2026-06-18 1:40 PM',
          tone: 'cyan',
        },
        {
          title: 'Completed',
          detail: 'Performance review was scheduled.',
          timestamp: '2026-06-24 3:15 PM',
          tone: 'green',
        },
      ],
    },
    {
      id: 'task-archive-lost-opportunity',
      workspaceId,
      title: 'Archive lost opportunity',
      status: 'Completed',
      priority: 'Low',
      relatedRecord: 'Reed HVAC',
      relatedType: 'Opportunity',
      relatedRecordType: 'opportunity',
      relatedRecordId: 'opportunity-reed-hvac',
      relatedRecordLabel: 'Reed HVAC',
      dueDate: '2026-06-20',
      ownerId: 'owner-team-ops',
      source: 'Opportunity',
      createdAt: '2026-06-18',
      completedAt: '2026-06-24',
      estimatedTime: '5 min',
      actualTime: '4 min',
      description:
        'Archive the lost opportunity and make sure follow-up notes are preserved for future outreach.',
      notes: 'Opportunity closed out after pricing mismatch.',
      timeline: [
        {
          title: 'Task created',
          detail: 'Created after opportunity was marked Closed-Lost.',
          timestamp: '2026-06-18 1:40 PM',
          tone: 'cyan',
        },
        {
          title: 'Completed',
          detail: 'Opportunity archived with notes.',
          timestamp: '2026-06-24 3:15 PM',
          tone: 'green',
        },
      ],
    },
    {
      id: 'task-missed-call-follow-up',
      workspaceId,
      title: 'Call back missed lead',
      status: 'Open',
      priority: 'Urgent',
      relatedRecord: 'Johnson Landscaping',
      relatedType: 'Lead',
      relatedRecordType: 'lead',
      relatedRecordId: 'lead-johnson-landscaping',
      relatedRecordLabel: 'Johnson Landscaping',
      dueDate: '2026-06-28',
      ownerId: 'owner-team-support',
      source: 'Missed Call',
      createdAt: '2026-06-28',
      estimatedTime: '10 min',
      description:
        'Call back the missed lead and confirm whether they need a quote or discovery call.',
      notes:
        'Missed call automation created this task after no callback was logged.',
      timeline: [
        {
          title: 'Task created',
          detail: 'Generated from missed-call follow-up.',
          timestamp: '2026-06-28 5:18 PM',
          tone: 'rose',
        },
        {
          title: 'Reminder sent',
          detail: 'Urgent follow-up reminder sent to Support Team.',
          timestamp: '2026-06-29 9:00 AM',
          tone: 'amber',
        },
      ],
    },
    {
      id: 'task-ai-review-recommendation',
      workspaceId,
      title: 'Review AI automation recommendation',
      status: 'Open',
      priority: 'Medium',
      relatedRecord: 'Weekly Business Summary',
      relatedType: 'Automation',
      relatedRecordType: 'automation',
      relatedRecordId: 'automation-weekly-business-summary',
      relatedRecordLabel: 'Weekly Business Summary',
      dueDate: '2026-07-01',
      ownerId: 'owner-team-ops',
      source: 'AI Coach',
      createdAt: '2026-06-29',
      estimatedTime: '20 min',
      description:
        'Review the AI Coach recommendation to add review-request automation for completed client work.',
      notes: 'Recommendation came from the Reports business advisor summary.',
      timeline: [
        {
          title: 'Task created',
          detail: 'AI Coach recommended a new automation opportunity.',
          timestamp: '2026-06-29 10:20 AM',
          tone: 'purple',
        },
      ],
    },
  ]
}
