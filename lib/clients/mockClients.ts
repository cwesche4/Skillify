import type { WorkspaceClient } from './types'
import { getDemoOwnerIdByName } from '@/lib/workspace-ownership'

const now = Date.now()

function daysAgo(days: number) {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
}

export function createMockWorkspaceClients(
  workspaceId: string,
): WorkspaceClient[] {
  return [
    {
      id: 'client-jason-miller',
      workspaceId,
      name: 'Jason Miller',
      company: 'Commonwealth Gas & Well Service',
      email: 'jason@commonwealthgas.example',
      phone: '(555) 014-1188',
      status: 'Active',
      pipelineStage: 'In Progress',
      lastActivity: daysAgo(1),
      openTasks: 2,
      value: 3200,
      nextAction: 'Send homepage wireframe',
      ownerId: getDemoOwnerIdByName('Corbin'),
      health: 'Healthy',
      tags: ['VIP', 'Recurring'],
      notes:
        'Website refresh is in progress. Follow up after the first content review and confirm final service pages.',
      activity: [
        {
          id: 'activity-jason-audit',
          title: 'Website audit completed',
          description: 'Initial website audit and recommendations were shared.',
          timestamp: daysAgo(1),
        },
        {
          id: 'activity-jason-call',
          title: 'Discovery call completed',
          description: 'Confirmed project scope and timeline.',
          timestamp: daysAgo(5),
        },
        {
          id: 'activity-jason-added',
          title: 'Client added',
          description: 'Client profile created from inbound inquiry.',
          timestamp: daysAgo(9),
        },
      ],
      tasks: ['Send homepage wireframe', 'Confirm final service list'],
      suggestedAutomations: [
        'Estimate follow-up sequence',
        'Review request follow-up',
        'Weekly project status email',
      ],
      opportunity: {
        value: 3200,
        nextAction: 'Send homepage wireframe',
        probability: 78,
        expectedCloseWindow: '2 weeks',
      },
    },
    {
      id: 'client-sarah-johnson',
      workspaceId,
      name: 'Sarah Johnson',
      company: 'Johnson Landscaping',
      email: 'sarah@johnsonlandscaping.example',
      phone: '(555) 014-2099',
      status: 'Active',
      pipelineStage: 'Onboarding',
      lastActivity: daysAgo(2),
      openTasks: 3,
      value: 1800,
      nextAction: 'Schedule discovery call',
      ownerId: getDemoOwnerIdByName('Ops Team'),
      health: 'Needs Attention',
      tags: ['New Customer', 'Needs Follow-Up'],
      notes:
        'New customer onboarding is underway for a landing page and quote request workflow before spring campaign season.',
      activity: [
        {
          id: 'activity-sarah-email',
          title: 'Follow-up email sent',
          description: 'Sent website package options and next-step questions.',
          timestamp: daysAgo(2),
        },
        {
          id: 'activity-sarah-qualified',
          title: 'Onboarding call completed',
          description:
            'Confirmed delivery timeline, workspace access, and first milestone.',
          timestamp: daysAgo(4),
        },
        {
          id: 'activity-sarah-added',
          title: 'Client added',
          description: 'Customer profile created after project kickoff.',
          timestamp: daysAgo(6),
        },
      ],
      tasks: ['Send follow-up', 'Prepare estimate', 'Confirm project deadline'],
      suggestedAutomations: [
        'New lead intake',
        'Missed-call text back',
        'Estimate follow-up sequence',
      ],
      opportunity: {
        value: 1800,
        nextAction: 'Send estimate',
        probability: 52,
        expectedCloseWindow: '10 days',
      },
    },
    {
      id: 'client-mike-carter',
      workspaceId,
      name: 'Mike Carter',
      company: 'Carter Plumbing',
      email: 'mike@carterplumbing.example',
      phone: '(555) 014-3321',
      status: 'Waiting',
      pipelineStage: 'Waiting on Client',
      lastActivity: daysAgo(3),
      openTasks: 1,
      value: 2400,
      nextAction: 'Follow up on estimate',
      ownerId: getDemoOwnerIdByName('Corbin'),
      health: 'Needs Attention',
      tags: ['Needs Follow-Up', 'Recurring'],
      notes:
        'Waiting on client approval for missed-call response and review request automation setup.',
      activity: [
        {
          id: 'activity-mike-estimate',
          title: 'Implementation scope reviewed',
          description:
            'Client reviewed automation scope and asked about setup time.',
          timestamp: daysAgo(3),
        },
        {
          id: 'activity-mike-sent',
          title: 'Approval request sent',
          description: 'Sent automation setup plan for client approval.',
          timestamp: daysAgo(6),
        },
        {
          id: 'activity-mike-added',
          title: 'Client added',
          description: 'Client profile created from referral.',
          timestamp: daysAgo(11),
        },
      ],
      tasks: ['Review estimate', 'Answer setup timeline question'],
      suggestedAutomations: [
        'Missed-call text back',
        'Review request follow-up',
        'New lead intake',
      ],
      opportunity: {
        value: 2400,
        nextAction: 'Answer estimate questions',
        probability: 64,
        expectedCloseWindow: '1 week',
      },
    },
    {
      id: 'client-amanda-brooks',
      workspaceId,
      name: 'Amanda Brooks',
      company: 'Brooks Cleaning Co.',
      email: 'amanda@brookscleaning.example',
      phone: '(555) 014-4511',
      status: 'Active',
      pipelineStage: 'Review / Approval',
      lastActivity: daysAgo(5),
      openTasks: 2,
      value: 950,
      nextAction: 'Request review',
      ownerId: getDemoOwnerIdByName('Skillify AI'),
      health: 'Unresponsive',
      tags: ['Needs Follow-Up'],
      notes:
        'Review request process is ready for customer approval before launch.',
      activity: [
        {
          id: 'activity-amanda-reminder',
          title: 'Follow-up reminder created',
          description: 'Added next-step reminder for review workflow setup.',
          timestamp: daysAgo(5),
        },
        {
          id: 'activity-amanda-call',
          title: 'Process call completed',
          description: 'Mapped current client follow-up process.',
          timestamp: daysAgo(7),
        },
        {
          id: 'activity-amanda-added',
          title: 'Client added',
          description: 'Client profile created from manual import.',
          timestamp: daysAgo(12),
        },
      ],
      tasks: ['Send follow-up', 'Draft review request message'],
      suggestedAutomations: [
        'Review request follow-up',
        'Completed job follow-up',
        'Weekly client check-in',
      ],
      opportunity: {
        value: 950,
        nextAction: 'Draft review request message',
        probability: 70,
        expectedCloseWindow: '5 days',
      },
    },
    {
      id: 'client-daniel-reed',
      workspaceId,
      name: 'Daniel Reed',
      company: 'Reed HVAC',
      email: 'daniel@reedhvac.example',
      phone: '(555) 014-6890',
      status: 'Maintenance',
      pipelineStage: 'Maintenance',
      lastActivity: daysAgo(8),
      openTasks: 0,
      value: 4500,
      nextAction: 'Confirm service list',
      ownerId: getDemoOwnerIdByName('Ops Team'),
      health: 'Healthy',
      tags: ['VIP', 'Recurring'],
      notes:
        'Initial automation package completed. Customer is in maintenance and ready for reporting expansion.',
      activity: [
        {
          id: 'activity-daniel-completed',
          title: 'Automation setup completed',
          description: 'Client intake and follow-up automation launched.',
          timestamp: daysAgo(8),
        },
        {
          id: 'activity-daniel-review',
          title: 'Review request sent',
          description: 'Sent post-project review request.',
          timestamp: daysAgo(9),
        },
        {
          id: 'activity-daniel-added',
          title: 'Client added',
          description: 'Client profile created from closed project.',
          timestamp: daysAgo(21),
        },
      ],
      tasks: ['Schedule 30-day performance review'],
      suggestedAutomations: [
        'Weekly business summary',
        'Client intake source report',
        'Review request follow-up',
      ],
      opportunity: {
        value: 4500,
        nextAction: 'Review automation performance',
        probability: 92,
        expectedCloseWindow: 'Closed',
      },
    },
  ]
}
