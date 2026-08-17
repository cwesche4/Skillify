import type { IntegrationProviderId } from '@/lib/integrations/providerRegistry'
import {
  getIntegrationProviderDefinition,
  resolveIntegrationProviderAvailability,
} from '@/lib/integrations/providerRegistry'
import type { SafeWorkspaceIntegrationConnection } from '@/lib/integrations/workspaceConnections'

export type LeadIntakeSourceId =
  | 'nativeWebsiteForm'
  | 'inboundWebhook'
  | 'hubspot'
  | 'googleAdsLeadForms'
  | 'googleBusinessProfile'
  | 'metaLeadAds'
  | 'csvImport'
  | 'manualEntry'

export type LeadIntakeMode =
  | 'directForm'
  | 'webhook'
  | 'polling'
  | 'oauthSync'
  | 'manual'
  | 'import'

export type LeadIntakeSourceDefinition = {
  id: LeadIntakeSourceId
  providerId: IntegrationProviderId | 'none'
  displayName: string
  sourceCategory: 'native' | 'crm' | 'advertising' | 'import' | 'manual'
  connectionRequired: boolean
  capabilityRequirement?: string
  ingestionMode: LeadIntakeMode
  deduplicationKeyStrategy: string
  mappingAvailability: 'available' | 'basic' | 'deferred'
  setupAvailability: 'available' | 'partiallyImplemented' | 'comingSoon'
  customerFacingExplanation: string
}

export type LeadIntakeCardStatus =
  | 'ready'
  | 'connected'
  | 'selected'
  | 'partial'
  | 'configurationRequired'
  | 'actionRequired'
  | 'comingSoon'
  | 'unavailable'

export type LeadIntakeCardAction = {
  label: string
  href?: string
  kind: 'selectManual' | 'connect' | 'manage' | 'review'
  disabled?: boolean
}

export type LeadIntakeSourceCard = {
  id: LeadIntakeSourceId
  title: string
  description: string
  status: LeadIntakeCardStatus
  statusLabel: string
  summary: string
  action?: LeadIntakeCardAction
  providerId: IntegrationProviderId | 'none'
  connectedLabel?: string | null
}

export type NormalizedLeadIntakePayload = {
  workspaceId: string
  sourceId: LeadIntakeSourceId
  providerId: IntegrationProviderId | 'none'
  sourceConnectionId?: string
  externalEventId?: string
  externalLeadId?: string
  receivedAt: string
  contactName?: string
  company?: string
  email?: string
  phone?: string
  message?: string
  campaign?: string
  form?: string
  consentMetadata?: Record<string, unknown>
  sanitizedPayload?: Record<string, unknown>
  deduplicationKey: string
}

const leadIntakeSources: LeadIntakeSourceDefinition[] = [
  {
    id: 'nativeWebsiteForm',
    providerId: 'nativeWebsiteForm',
    displayName: 'Native Website Form',
    sourceCategory: 'native',
    connectionRequired: false,
    capabilityRequirement: 'leadIntake',
    ingestionMode: 'directForm',
    deduplicationKeyStrategy: 'workspace-source-event-or-fingerprint',
    mappingAvailability: 'basic',
    setupAvailability: 'partiallyImplemented',
    customerFacingExplanation:
      'Skillify-hosted lead forms can create leads without customer-owned provider credentials.',
  },
  {
    id: 'inboundWebhook',
    providerId: 'nativeWebsiteForm',
    displayName: 'Inbound Webhook',
    sourceCategory: 'native',
    connectionRequired: true,
    capabilityRequirement: 'leadIntake',
    ingestionMode: 'webhook',
    deduplicationKeyStrategy: 'workspace-source-connection-event-id',
    mappingAvailability: 'deferred',
    setupAvailability: 'partiallyImplemented',
    customerFacingExplanation:
      'Workspace-specific webhook intake will use signed requests and deterministic lead normalization.',
  },
  {
    id: 'hubspot',
    providerId: 'hubspot',
    displayName: 'HubSpot',
    sourceCategory: 'crm',
    connectionRequired: true,
    capabilityRequirement: 'crm.contacts',
    ingestionMode: 'oauthSync',
    deduplicationKeyStrategy: 'workspace-hubspot-object-id',
    mappingAvailability: 'available',
    setupAvailability: 'available',
    customerFacingExplanation:
      'HubSpot leads and contacts should enter Skillify through the shared intake contract.',
  },
  {
    id: 'googleAdsLeadForms',
    providerId: 'googleAds',
    displayName: 'Google Ads Lead Forms',
    sourceCategory: 'advertising',
    connectionRequired: true,
    capabilityRequirement: 'leadForms',
    ingestionMode: 'oauthSync',
    deduplicationKeyStrategy: 'workspace-google-ads-lead-id',
    mappingAvailability: 'deferred',
    setupAvailability: 'comingSoon',
    customerFacingExplanation:
      'Google Ads lead forms are planned for a later phase.',
  },
  {
    id: 'googleBusinessProfile',
    providerId: 'googleBusinessProfile',
    displayName: 'Google Business Profile',
    sourceCategory: 'advertising',
    connectionRequired: true,
    capabilityRequirement: 'leadIntake',
    ingestionMode: 'polling',
    deduplicationKeyStrategy: 'workspace-google-business-message-id',
    mappingAvailability: 'deferred',
    setupAvailability: 'comingSoon',
    customerFacingExplanation:
      'Google Business Profile intake is planned for a later phase.',
  },
  {
    id: 'metaLeadAds',
    providerId: 'metaLeadAds',
    displayName: 'Meta Lead Ads',
    sourceCategory: 'advertising',
    connectionRequired: true,
    capabilityRequirement: 'leadForms',
    ingestionMode: 'webhook',
    deduplicationKeyStrategy: 'workspace-meta-leadgen-id',
    mappingAvailability: 'deferred',
    setupAvailability: 'comingSoon',
    customerFacingExplanation: 'Meta lead ads are planned for a later phase.',
  },
  {
    id: 'csvImport',
    providerId: 'none',
    displayName: 'CSV Import',
    sourceCategory: 'import',
    connectionRequired: false,
    ingestionMode: 'import',
    deduplicationKeyStrategy: 'workspace-import-row-fingerprint',
    mappingAvailability: 'basic',
    setupAvailability: 'partiallyImplemented',
    customerFacingExplanation:
      'CSV import should use deterministic mapping and workspace-scoped deduplication.',
  },
  {
    id: 'manualEntry',
    providerId: 'none',
    displayName: 'Manual Entry',
    sourceCategory: 'manual',
    connectionRequired: false,
    ingestionMode: 'manual',
    deduplicationKeyStrategy: 'workspace-manual-record-id',
    mappingAvailability: 'available',
    setupAvailability: 'available',
    customerFacingExplanation:
      'Manual leads already enter Skillify through the CRM lead creation flow.',
  },
]

export function listLeadIntakeSourceDefinitions() {
  return leadIntakeSources
}

export function getLeadIntakeSourceDefinition(id: LeadIntakeSourceId) {
  return leadIntakeSources.find((source) => source.id === id) ?? null
}

function sourceConnectedStatus(
  connection: SafeWorkspaceIntegrationConnection | undefined,
): LeadIntakeCardStatus | null {
  if (!connection) return null
  if (connection.status === 'connected') return 'connected'
  if (
    connection.status === 'actionRequired' ||
    connection.status === 'expired' ||
    connection.status === 'revoked' ||
    connection.status === 'degraded' ||
    connection.status === 'error'
  ) {
    return 'actionRequired'
  }
  return null
}

function labelForStatus(status: LeadIntakeCardStatus) {
  if (status === 'ready') return 'Ready'
  if (status === 'connected') return 'Connected'
  if (status === 'selected') return 'Selected fallback'
  if (status === 'partial') return 'Partial'
  if (status === 'configurationRequired') return 'Configuration Required'
  if (status === 'actionRequired') return 'Action Required'
  if (status === 'comingSoon') return 'Coming Soon'
  return 'Unavailable'
}

export function resolveLeadIntakeSourceCards({
  workspaceId,
  workspaceSlug,
  connections = [],
  manualSelected = false,
  env = process.env,
}: {
  workspaceId: string
  workspaceSlug: string
  connections?: SafeWorkspaceIntegrationConnection[]
  manualSelected?: boolean
  env?: NodeJS.ProcessEnv
}): LeadIntakeSourceCard[] {
  return leadIntakeSources.map((source) => {
    const connection = connections.find(
      (item) =>
        source.providerId !== 'none' && item.providerId === source.providerId,
    )
    const connectedStatus = sourceConnectedStatus(connection)
    let status: LeadIntakeCardStatus =
      source.setupAvailability === 'comingSoon'
        ? 'comingSoon'
        : source.setupAvailability === 'partiallyImplemented'
          ? 'partial'
          : 'ready'
    let summary = source.customerFacingExplanation
    let action: LeadIntakeCardAction | undefined

    if (source.id === 'manualEntry') {
      status = manualSelected ? 'selected' : 'ready'
      summary = manualSelected
        ? 'Manual lead creation is selected as the fallback intake method. Automated source setup remains optional.'
        : 'Manual lead creation is available from the Leads page and can be selected as the fallback intake method.'
      action = {
        label: manualSelected ? 'Selected fallback' : 'Use Manual Entry',
        kind: 'selectManual',
        disabled: manualSelected,
      }
    } else if (connectedStatus) {
      status = connectedStatus
      summary =
        connectedStatus === 'connected'
          ? `${source.displayName} is connected${connection?.externalAccountLabel ? ` as ${connection.externalAccountLabel}` : ''}.`
          : `${source.displayName} needs attention before intake can continue.`
      action = {
        label:
          connectedStatus === 'connected' ? 'Manage Connection' : 'Reconnect',
        href: `/dashboard/${workspaceSlug}/settings/integrations`,
        kind: 'manage',
      }
    } else if (source.id === 'hubspot') {
      const provider = getIntegrationProviderDefinition('hubspot')
      const availability = provider
        ? resolveIntegrationProviderAvailability({
            provider,
            workspaceId,
            env,
          })
        : null
      if (!availability || availability.status === 'configurationRequired') {
        status = 'configurationRequired'
        summary =
          availability?.safeMessage ??
          'HubSpot requires Skillify deployment configuration.'
      } else if (availability.status === 'comingSoon') {
        status = 'comingSoon'
        summary = availability.safeMessage
      } else if (availability.canStartConnection && availability.connectPath) {
        status = 'ready'
        summary =
          'HubSpot OAuth is available. Connect HubSpot to sync CRM contacts and lead intake records.'
        action = {
          label: 'Connect HubSpot',
          href: availability.connectPath,
          kind: 'connect',
        }
      } else {
        status = 'partial'
        summary = 'HubSpot setup cannot be completed from this workspace yet.'
      }
    } else if (source.setupAvailability === 'partiallyImplemented') {
      status = 'partial'
      summary =
        source.id === 'nativeWebsiteForm'
          ? 'Native website form setup is not fully available yet. Review integration availability before relying on it for intake.'
          : source.id === 'inboundWebhook'
            ? 'Inbound webhook setup is not fully available yet. Signed endpoint configuration is still limited.'
            : 'CSV import is not fully available yet. Manual entry remains the supported fallback.'
      action = {
        label:
          source.id === 'nativeWebsiteForm'
            ? 'Review Availability'
            : source.id === 'inboundWebhook'
              ? 'Review Webhook Availability'
              : 'Review Import Availability',
        href: `/dashboard/${workspaceSlug}/settings/integrations`,
        kind: 'review',
      }
    } else if (source.setupAvailability === 'comingSoon') {
      status = 'comingSoon'
      summary = source.customerFacingExplanation
      action = undefined
    }

    return {
      id: source.id,
      title: source.displayName,
      description: source.customerFacingExplanation,
      status,
      statusLabel: labelForStatus(status),
      summary,
      action,
      providerId: source.providerId,
      connectedLabel: connection?.externalAccountLabel ?? null,
    }
  })
}

export function buildLeadIntakeDeduplicationKey(
  payload: Pick<
    NormalizedLeadIntakePayload,
    | 'workspaceId'
    | 'sourceId'
    | 'sourceConnectionId'
    | 'externalEventId'
    | 'externalLeadId'
    | 'email'
    | 'phone'
  >,
) {
  const external =
    payload.externalEventId ??
    payload.externalLeadId ??
    [payload.email?.toLowerCase(), payload.phone].filter(Boolean).join(':')
  return [
    payload.workspaceId,
    payload.sourceId,
    payload.sourceConnectionId ?? 'no-connection',
    external || 'unknown',
  ].join(':')
}
