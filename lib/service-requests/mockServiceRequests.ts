import type { WorkspaceServiceRequest } from './types'
import { getDemoOwnerIdByName } from '@/lib/workspace-ownership'

const now = Date.now()

function daysAgo(days: number) {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
}

function hoursFromNow(hours: number) {
  return new Date(now + hours * 60 * 60 * 1000).toISOString()
}

export function createMockServiceRequests(
  workspaceId: string,
): WorkspaceServiceRequest[] {
  return [
    {
      id: 'request-commonwealth-homepage',
      workspaceId,
      clientId: 'client-jason-miller',
      clientName: 'Commonwealth Gas & Well Service',
      customerName: 'Jason Miller',
      company: 'Commonwealth Gas & Well Service',
      email: 'jason@commonwealthgas.example',
      phone: '(555) 014-1188',
      title: 'Emergency service call',
      description:
        'Customer needs a gas line repair visit confirmed before the next local campaign.',
      notes:
        'Use the approved service list from the client profile and confirm final wording before publishing.',
      priority: 'High',
      status: 'Scheduled',
      serviceType: 'Service Call',
      valueCents: 15000,
      currency: 'USD',
      assignedToOwnerId: getDemoOwnerIdByName('Corbin'),
      scheduledFor: hoursFromNow(4),
      estimatedDuration: '1.5 hours',
      createdAt: daysAgo(1),
      relatedRecords: {
        linkedClient: 'Commonwealth Gas & Well Service',
        linkedTasks: '2 open tasks',
        linkedOpportunity: '',
      },
      timeline: [
        {
          id: 'commonwealth-created',
          label: 'Request created',
          timestamp: daysAgo(1),
          description: 'Homepage update request was logged.',
        },
        {
          id: 'commonwealth-assigned',
          label: 'Assigned',
          timestamp: daysAgo(1),
          description: 'Assigned to Corbin for content update.',
        },
        {
          id: 'commonwealth-scheduled',
          label: 'Scheduled',
          timestamp: hoursFromNow(4),
          description: 'Work scheduled for later today.',
        },
      ],
    },
    {
      id: 'request-johnson-lead',
      workspaceId,
      clientId: 'client-sarah-johnson',
      clientName: 'Johnson Landscaping',
      customerName: 'Sarah Johnson',
      company: 'Johnson Landscaping',
      email: 'sarah@johnsonlandscaping.example',
      phone: '(555) 014-2099',
      title: 'Spring cleanup estimate follow-up',
      description:
        'Customer needs follow-up on three landscaping quote requests that came in over the weekend.',
      notes:
        'Prioritize the commercial lawn care inquiry and draft a reusable follow-up response.',
      priority: 'Urgent',
      status: 'New',
      serviceType: 'Follow-Up',
      valueCents: 0,
      currency: 'USD',
      assignedToOwnerId: getDemoOwnerIdByName('Ops Team'),
      scheduledFor: null,
      estimatedDuration: '45 minutes',
      createdAt: daysAgo(0),
      relatedRecords: {
        linkedClient: 'Johnson Landscaping',
        linkedTasks: '3 open tasks',
        linkedOpportunity: '',
      },
      timeline: [
        {
          id: 'johnson-created',
          label: 'Request created',
          timestamp: daysAgo(0),
          description: 'Lead follow-up request was received.',
        },
        {
          id: 'johnson-waiting-assignment',
          label: 'Waiting status',
          timestamp: daysAgo(0),
          description: 'Request is waiting for assignment and scheduling.',
        },
      ],
    },
    {
      id: 'request-carter-automation',
      workspaceId,
      clientId: 'client-mike-carter',
      clientName: 'Carter Plumbing',
      customerName: 'Mike Carter',
      company: 'Carter Plumbing',
      email: 'mike@carterplumbing.example',
      phone: '(555) 014-3321',
      title: 'Kitchen leak repair visit',
      description:
        'Customer reported a kitchen leak and needs a repair visit scheduled.',
      notes:
        'Confirm parts and access notes before dispatching the assigned owner.',
      priority: 'Urgent',
      status: 'In Progress',
      serviceType: 'Repair',
      valueCents: 27500,
      currency: 'USD',
      assignedToOwnerId: getDemoOwnerIdByName('Skillify AI'),
      scheduledFor: hoursFromNow(1),
      estimatedDuration: '1 hour',
      createdAt: daysAgo(1),
      relatedRecords: {
        linkedClient: 'Carter Plumbing',
        linkedTasks: '1 open task',
        linkedOpportunity: '',
      },
      timeline: [
        {
          id: 'carter-created',
          label: 'Request created',
          timestamp: daysAgo(1),
          description: 'Repair request was logged.',
        },
        {
          id: 'carter-assigned',
          label: 'Assigned',
          timestamp: daysAgo(1),
          description: 'Assigned to Skillify AI for first-pass review.',
        },
        {
          id: 'carter-progress',
          label: 'Scheduled',
          timestamp: hoursFromNow(1),
          description: 'Repair visit is scheduled.',
        },
      ],
    },
    {
      id: 'request-brooks-reviews',
      workspaceId,
      clientId: 'client-amanda-brooks',
      clientName: 'Brooks Cleaning Co.',
      customerName: 'Amanda Brooks',
      company: 'Brooks Cleaning Co.',
      email: 'amanda@brookscleaning.example',
      phone: '(555) 014-4511',
      title: 'Completed job follow-up',
      description:
        'Customer wants a simple follow-up after completed cleaning jobs.',
      notes: 'Use a friendly tone and confirm the recurring cleaning schedule.',
      priority: 'Normal',
      status: 'Waiting On Client',
      serviceType: 'Follow-Up',
      valueCents: 0,
      currency: 'USD',
      assignedToOwnerId: getDemoOwnerIdByName('Ops Team'),
      scheduledFor: hoursFromNow(28),
      estimatedDuration: '30 minutes',
      createdAt: daysAgo(3),
      relatedRecords: {
        linkedClient: 'Brooks Cleaning Co.',
        linkedTasks: '1 open task',
        linkedOpportunity: '',
      },
      timeline: [
        {
          id: 'brooks-created',
          label: 'Request created',
          timestamp: daysAgo(3),
          description: 'Review request copy request was logged.',
        },
        {
          id: 'brooks-assigned',
          label: 'Assigned',
          timestamp: daysAgo(2),
          description: 'Assigned to Ops Team.',
        },
        {
          id: 'brooks-waiting',
          label: 'Waiting status',
          timestamp: daysAgo(1),
          description: 'Waiting on customer review link.',
        },
      ],
    },
    {
      id: 'request-reed-hvac',
      workspaceId,
      clientId: 'client-daniel-reed',
      clientName: 'Reed HVAC',
      customerName: 'Daniel Reed',
      company: 'Reed HVAC',
      email: 'daniel@reedhvac.example',
      phone: '(555) 014-6890',
      title: 'Recurring maintenance visit',
      description: 'Customer requested a recurring HVAC maintenance visit.',
      notes: 'Confirm access notes and equipment details before the visit.',
      priority: 'Low',
      status: 'Completed',
      serviceType: 'Maintenance',
      valueCents: 6000,
      currency: 'USD',
      assignedToOwnerId: getDemoOwnerIdByName('Corbin'),
      scheduledFor: daysAgo(2),
      estimatedDuration: '2 hours',
      createdAt: daysAgo(8),
      completedAt: daysAgo(1),
      relatedRecords: {
        linkedClient: 'Reed HVAC',
        linkedTasks: '0 open tasks',
        linkedOpportunity: '',
      },
      timeline: [
        {
          id: 'reed-created',
          label: 'Request created',
          timestamp: daysAgo(8),
          description: 'Field service request type was requested.',
        },
        {
          id: 'reed-assigned',
          label: 'Assigned',
          timestamp: daysAgo(7),
          description: 'Assigned to Corbin.',
        },
        {
          id: 'reed-scheduled',
          label: 'Scheduled',
          timestamp: daysAgo(2),
          description: 'Portal update was scheduled.',
        },
        {
          id: 'reed-completed',
          label: 'Completed',
          timestamp: daysAgo(1),
          description: 'Portal request type was added to the demo workspace.',
        },
      ],
    },
  ]
}
