import { isIntegrationEncryptionConfigured } from '@/lib/integrations/crypto'

export type IntegrationCredentialOwnership =
  | 'platform'
  | 'workspaceOAuth'
  | 'workspaceApiKey'
  | 'workspaceWebhook'
  | 'workspaceManual'
  | 'none'

export type IntegrationProviderCategory =
  | 'calendar'
  | 'messaging'
  | 'email'
  | 'crm'
  | 'leadSource'
  | 'accounting'
  | 'storage'
  | 'communication'

export type IntegrationConnectionMethod =
  | 'oauth'
  | 'apiKey'
  | 'manualCredentials'
  | 'webhook'
  | 'native'
  | 'none'

export type IntegrationConnectionStatus =
  | 'notConnected'
  | 'configurationRequired'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'actionRequired'
  | 'expired'
  | 'revoked'
  | 'error'
  | 'unavailable'
  | 'comingSoon'

export type IntegrationImplementationState =
  | 'implemented'
  | 'partiallyImplemented'
  | 'configurationRequired'
  | 'comingSoon'
  | 'unavailable'

export type IntegrationTestConnectionSupport =
  | 'supported'
  | 'unsupported'
  | 'deferred'
  | 'notApplicable'

export type IntegrationTestType =
  | 'readOnly'
  | 'write'
  | 'sendTestEmail'
  | 'sendTestSms'
  | 'sendTestMessage'
  | 'sampleWebhook'

export type IntegrationTestConnectionDefinition = {
  support: IntegrationTestConnectionSupport
  supportedTestTypes: IntegrationTestType[]
  defaultTestType?: IntegrationTestType
  readOnlyByDefault: boolean
  mutationRequiresConfirmation: boolean
  requiredConnectionStates: IntegrationConnectionStatus[]
  requiredCapabilities: string[]
  safeCustomerDescription: string
}

export type IntegrationProviderId =
  | 'googleCalendar'
  | 'microsoftCalendar'
  | 'caldav'
  | 'twilio'
  | 'resend'
  | 'slack'
  | 'hubspot'
  | 'nativeWebsiteForm'
  | 'googleAds'
  | 'googleBusinessProfile'
  | 'metaLeadAds'
  | 'skillifyOpenAI'
  | 'skillifyClerk'
  | 'skillifySystemEmail'

export type IntegrationProviderDefinition = {
  id: IntegrationProviderId
  displayName: string
  category: IntegrationProviderCategory
  credentialOwnership: IntegrationCredentialOwnership
  connectionMethod: IntegrationConnectionMethod
  implementationState: IntegrationImplementationState
  capabilities: string[]
  capabilityLabels?: Record<string, string>
  requiredPlatformEnv: string[]
  optionalPlatformEnv?: string[]
  supportedEnvironments: Array<'development' | 'preview' | 'production'>
  customerFacingExplanation: string
  manageLaterLabel: string
  connectPath?: (workspaceId: string) => string
  supportsCallback: boolean
  supportsDisconnect: boolean
  supportsReconnect: boolean
  supportsHealthCheck: boolean
  supportsTokenRefresh: boolean
  allowsConnectAction: boolean
  testConnection: IntegrationTestConnectionDefinition
  billingResponsibility: 'skillify' | 'workspaceCustomer' | 'none'
}

export type IntegrationProviderAvailability = {
  providerId: IntegrationProviderId
  displayName: string
  category: IntegrationProviderCategory
  credentialOwnership: IntegrationCredentialOwnership
  connectionMethod: IntegrationConnectionMethod
  status: IntegrationConnectionStatus
  implementationState: IntegrationImplementationState
  capabilities: string[]
  requiredPlatformEnv: string[]
  missingPlatformEnv: string[]
  encryptionConfigured: boolean
  requiresEncryption: boolean
  canStartConnection: boolean
  safeMessage: string
  customerFacingExplanation: string
  manageLaterLabel: string
  billingResponsibility: IntegrationProviderDefinition['billingResponsibility']
  capabilityLabels?: Record<string, string>
  connectPath?: string
  supportsCallback: boolean
  supportsDisconnect: boolean
  supportsReconnect: boolean
  supportsHealthCheck: boolean
  supportsTokenRefresh: boolean
  testConnection: IntegrationTestConnectionDefinition
}

function readOnlyTestConnection({
  requiredCapabilities = [],
  description,
  requiredConnectionStates = ['connected', 'degraded', 'actionRequired'],
}: {
  requiredCapabilities?: string[]
  description: string
  requiredConnectionStates?: IntegrationConnectionStatus[]
}): IntegrationTestConnectionDefinition {
  return {
    support: 'supported',
    supportedTestTypes: ['readOnly'],
    defaultTestType: 'readOnly',
    readOnlyByDefault: true,
    mutationRequiresConfirmation: false,
    requiredConnectionStates,
    requiredCapabilities,
    safeCustomerDescription: description,
  }
}

function deferredTestConnection(
  description: string,
): IntegrationTestConnectionDefinition {
  return {
    support: 'deferred',
    supportedTestTypes: [],
    readOnlyByDefault: true,
    mutationRequiresConfirmation: true,
    requiredConnectionStates: [],
    requiredCapabilities: [],
    safeCustomerDescription: description,
  }
}

function notApplicableTestConnection(
  description: string,
): IntegrationTestConnectionDefinition {
  return {
    support: 'notApplicable',
    supportedTestTypes: [],
    readOnlyByDefault: true,
    mutationRequiresConfirmation: true,
    requiredConnectionStates: [],
    requiredCapabilities: [],
    safeCustomerDescription: description,
  }
}

function envFlag(name: string, fallback = false, env = process.env): boolean {
  const value = env[name]
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function missingEnv(names: string[], env = process.env): string[] {
  return names.filter((name) => !env[name]?.trim())
}

const providerDefinitions: IntegrationProviderDefinition[] = [
  {
    id: 'googleCalendar',
    displayName: 'Google Calendar',
    category: 'calendar',
    credentialOwnership: 'workspaceOAuth',
    connectionMethod: 'oauth',
    implementationState: 'implemented',
    capabilities: ['calendar.read', 'calendar.write', 'offlineAccess', 'sync'],
    capabilityLabels: {
      'calendar.read': 'Read calendar',
      'calendar.write': 'Create events',
      offlineAccess: 'Offline access',
      sync: 'Calendar sync',
    },
    requiredPlatformEnv: [
      'GOOGLE_CALENDAR_CLIENT_ID',
      'GOOGLE_CALENDAR_CLIENT_SECRET',
      'GOOGLE_CALENDAR_REDIRECT_URI',
    ],
    optionalPlatformEnv: ['GOOGLE_CALENDAR_WEBHOOK_URL'],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'Connect a Google account owned by this workspace or member. Skillify stores workspace tokens encrypted.',
    manageLaterLabel: 'Scheduling Settings',
    connectPath: (workspaceId) =>
      `/api/workspaces/${workspaceId}/scheduling/google/connect`,
    supportsCallback: true,
    supportsDisconnect: true,
    supportsReconnect: true,
    supportsHealthCheck: true,
    supportsTokenRefresh: true,
    allowsConnectAction: true,
    testConnection: readOnlyTestConnection({
      requiredCapabilities: ['calendar.read'],
      description:
        'Checks stored OAuth state, granted calendar scopes, and existing calendar-sync metadata without creating events.',
    }),
    billingResponsibility: 'workspaceCustomer',
  },
  {
    id: 'microsoftCalendar',
    displayName: 'Microsoft Outlook Calendar',
    category: 'calendar',
    credentialOwnership: 'workspaceOAuth',
    connectionMethod: 'oauth',
    implementationState: 'implemented',
    capabilities: ['calendar.read', 'calendar.write', 'offlineAccess', 'sync'],
    capabilityLabels: {
      'calendar.read': 'Read calendar',
      'calendar.write': 'Create events',
      offlineAccess: 'Offline access',
      sync: 'Calendar sync',
    },
    requiredPlatformEnv: [
      'MICROSOFT_CALENDAR_CLIENT_ID',
      'MICROSOFT_CALENDAR_CLIENT_SECRET',
      'MICROSOFT_CALENDAR_REDIRECT_URI',
    ],
    optionalPlatformEnv: [
      'MICROSOFT_CALENDAR_TENANT_ID',
      'MICROSOFT_CALENDAR_WEBHOOK_URL',
    ],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'Connect a Microsoft 365 account through delegated user authorization. Tokens are workspace-scoped and encrypted.',
    manageLaterLabel: 'Scheduling Settings',
    connectPath: (workspaceId) =>
      `/api/workspaces/${workspaceId}/scheduling/microsoft/connect`,
    supportsCallback: true,
    supportsDisconnect: true,
    supportsReconnect: true,
    supportsHealthCheck: true,
    supportsTokenRefresh: true,
    allowsConnectAction: true,
    testConnection: readOnlyTestConnection({
      requiredCapabilities: ['calendar.read'],
      description:
        'Checks delegated OAuth state, granted calendar permissions, and existing calendar-sync metadata without creating events.',
    }),
    billingResponsibility: 'workspaceCustomer',
  },
  {
    id: 'caldav',
    displayName: 'Apple Calendar / CalDAV',
    category: 'calendar',
    credentialOwnership: 'workspaceManual',
    connectionMethod: 'manualCredentials',
    implementationState: 'partiallyImplemented',
    capabilities: ['calendar.read', 'calendar.write', 'pollingSync'],
    capabilityLabels: {
      'calendar.read': 'Read calendars',
      'calendar.write': 'Create events',
      pollingSync: 'Polling sync',
    },
    requiredPlatformEnv: [],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'CalDAV uses workspace-provided server URL, username, and app password. Credentials must be encrypted before storage.',
    manageLaterLabel: 'Scheduling Settings',
    supportsCallback: false,
    supportsDisconnect: true,
    supportsReconnect: true,
    supportsHealthCheck: true,
    supportsTokenRefresh: false,
    allowsConnectAction: false,
    testConnection: deferredTestConnection(
      'CalDAV connection testing is deferred until manual credential setup is surfaced in this integration area.',
    ),
    billingResponsibility: 'workspaceCustomer',
  },
  {
    id: 'twilio',
    displayName: 'Twilio',
    category: 'messaging',
    credentialOwnership: 'workspaceOAuth',
    connectionMethod: 'oauth',
    implementationState: 'partiallyImplemented',
    capabilities: ['sms.send', 'sms.inbound', 'numberSelection'],
    capabilityLabels: {
      'sms.send': 'Send SMS',
      'sms.inbound': 'Receive SMS',
      numberSelection: 'Sending number selection',
    },
    requiredPlatformEnv: [
      'TWILIO_CONNECT_ENABLED',
      'TWILIO_CONNECT_APP_SID',
      'TWILIO_CONNECT_CALLBACK_URL',
    ],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'Connect your own Twilio account. Twilio bills your business directly for phone numbers and message usage.',
    manageLaterLabel: 'Settings → Integrations',
    supportsCallback: true,
    supportsDisconnect: true,
    supportsReconnect: true,
    supportsHealthCheck: true,
    supportsTokenRefresh: false,
    allowsConnectAction: false,
    testConnection: deferredTestConnection(
      'Twilio testing is available after live customer-owned Twilio Connect authorization is implemented.',
    ),
    billingResponsibility: 'workspaceCustomer',
  },
  {
    id: 'resend',
    displayName: 'Resend',
    category: 'email',
    credentialOwnership: 'workspaceApiKey',
    connectionMethod: 'apiKey',
    implementationState: 'partiallyImplemented',
    capabilities: ['email.send', 'domainVerification', 'brandedSender'],
    capabilityLabels: {
      'email.send': 'Send business email',
      domainVerification: 'Domain verification',
      brandedSender: 'Branded sender',
    },
    requiredPlatformEnv: [],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'Use your own Resend account and verified domain for workspace business email. Skillify platform emails remain separate.',
    manageLaterLabel: 'Settings → Integrations',
    supportsCallback: false,
    supportsDisconnect: true,
    supportsReconnect: true,
    supportsHealthCheck: true,
    supportsTokenRefresh: false,
    allowsConnectAction: true,
    testConnection: readOnlyTestConnection({
      requiredCapabilities: ['email.send', 'domainVerification'],
      description:
        'Checks encrypted credential storage and domain verification metadata without sending email.',
    }),
    billingResponsibility: 'workspaceCustomer',
  },
  {
    id: 'hubspot',
    displayName: 'HubSpot',
    category: 'crm',
    credentialOwnership: 'workspaceOAuth',
    connectionMethod: 'oauth',
    implementationState: 'implemented',
    capabilities: ['crm.contacts', 'crm.deals', 'webhooks'],
    capabilityLabels: {
      'crm.contacts': 'CRM contacts',
      'crm.deals': 'CRM deals',
      webhooks: 'CRM webhooks',
    },
    requiredPlatformEnv: [
      'HUBSPOT_CLIENT_ID',
      'HUBSPOT_CLIENT_SECRET',
      'HUBSPOT_REDIRECT_URI',
    ],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'Connect HubSpot for CRM contacts, deals, actions, and webhooks.',
    manageLaterLabel: 'Settings → Integrations',
    connectPath: (workspaceId) =>
      `/api/integrations/hubspot/connect?workspaceId=${workspaceId}`,
    supportsCallback: true,
    supportsDisconnect: true,
    supportsReconnect: true,
    supportsHealthCheck: true,
    supportsTokenRefresh: true,
    allowsConnectAction: true,
    testConnection: readOnlyTestConnection({
      requiredCapabilities: ['crm.contacts'],
      description:
        'Checks CRM connection state, scopes, and safe account metadata without creating or modifying CRM records.',
    }),
    billingResponsibility: 'workspaceCustomer',
  },
  {
    id: 'slack',
    displayName: 'Slack',
    category: 'communication',
    credentialOwnership: 'workspaceOAuth',
    connectionMethod: 'oauth',
    implementationState: 'comingSoon',
    capabilities: ['notifications'],
    capabilityLabels: { notifications: 'Slack notifications' },
    requiredPlatformEnv: [],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'Slack workspace notifications are planned for a later integration phase.',
    manageLaterLabel: 'Settings → Integrations',
    supportsCallback: false,
    supportsDisconnect: false,
    supportsReconnect: false,
    supportsHealthCheck: false,
    supportsTokenRefresh: false,
    allowsConnectAction: false,
    testConnection: deferredTestConnection(
      'Slack testing is deferred until the workspace-owned Slack provider is implemented.',
    ),
    billingResponsibility: 'workspaceCustomer',
  },
  {
    id: 'nativeWebsiteForm',
    displayName: 'Native Website Form',
    category: 'leadSource',
    credentialOwnership: 'workspaceWebhook',
    connectionMethod: 'webhook',
    implementationState: 'partiallyImplemented',
    capabilities: ['leadIntake'],
    capabilityLabels: { leadIntake: 'Native lead intake' },
    requiredPlatformEnv: [],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'Native lead intake uses Skillify-owned endpoints and does not require customer provider credentials.',
    manageLaterLabel: 'Leads → Lead Sources',
    supportsCallback: false,
    supportsDisconnect: true,
    supportsReconnect: true,
    supportsHealthCheck: true,
    supportsTokenRefresh: false,
    allowsConnectAction: false,
    testConnection: readOnlyTestConnection({
      requiredCapabilities: ['leadIntake'],
      description:
        'Checks native lead-intake registration and workspace routing without submitting a lead by default.',
      requiredConnectionStates: ['connected', 'actionRequired'],
    }),
    billingResponsibility: 'none',
  },
  {
    id: 'googleAds',
    displayName: 'Google Ads',
    category: 'leadSource',
    credentialOwnership: 'workspaceOAuth',
    connectionMethod: 'oauth',
    implementationState: 'comingSoon',
    capabilities: ['leadForms'],
    capabilityLabels: { leadForms: 'Lead forms' },
    requiredPlatformEnv: [],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'Google Ads lead forms are not connected in this phase.',
    manageLaterLabel: 'Leads → Lead Sources',
    supportsCallback: false,
    supportsDisconnect: false,
    supportsReconnect: false,
    supportsHealthCheck: false,
    supportsTokenRefresh: false,
    allowsConnectAction: false,
    testConnection: deferredTestConnection(
      'Google Ads lead-form testing is deferred until the provider endpoint is implemented.',
    ),
    billingResponsibility: 'workspaceCustomer',
  },
  {
    id: 'googleBusinessProfile',
    displayName: 'Google Business Profile',
    category: 'leadSource',
    credentialOwnership: 'workspaceOAuth',
    connectionMethod: 'oauth',
    implementationState: 'comingSoon',
    capabilities: ['leadIntake'],
    capabilityLabels: { leadIntake: 'Lead intake' },
    requiredPlatformEnv: [],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'Google Business Profile lead intake is planned for a later phase.',
    manageLaterLabel: 'Leads → Lead Sources',
    supportsCallback: false,
    supportsDisconnect: false,
    supportsReconnect: false,
    supportsHealthCheck: false,
    supportsTokenRefresh: false,
    allowsConnectAction: false,
    testConnection: deferredTestConnection(
      'Google Business Profile testing is deferred until the provider endpoint is implemented.',
    ),
    billingResponsibility: 'workspaceCustomer',
  },
  {
    id: 'metaLeadAds',
    displayName: 'Meta Lead Ads',
    category: 'leadSource',
    credentialOwnership: 'workspaceOAuth',
    connectionMethod: 'oauth',
    implementationState: 'comingSoon',
    capabilities: ['leadForms'],
    capabilityLabels: { leadForms: 'Lead forms' },
    requiredPlatformEnv: [],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'Facebook and Instagram lead ads are not connected in this phase.',
    manageLaterLabel: 'Leads → Lead Sources',
    supportsCallback: false,
    supportsDisconnect: false,
    supportsReconnect: false,
    supportsHealthCheck: false,
    supportsTokenRefresh: false,
    allowsConnectAction: false,
    testConnection: deferredTestConnection(
      'Meta Lead Ads testing is deferred until the provider endpoint is implemented.',
    ),
    billingResponsibility: 'workspaceCustomer',
  },
  {
    id: 'skillifyOpenAI',
    displayName: 'Skillify OpenAI',
    category: 'communication',
    credentialOwnership: 'platform',
    connectionMethod: 'none',
    implementationState: 'implemented',
    capabilities: ['ai.runtime'],
    capabilityLabels: { 'ai.runtime': 'AI runtime' },
    requiredPlatformEnv: ['OPENAI_API_KEY'],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'Skillify AI provider credentials are platform-owned and never entered by workspaces.',
    manageLaterLabel: 'Workspace AI Settings',
    supportsCallback: false,
    supportsDisconnect: false,
    supportsReconnect: false,
    supportsHealthCheck: true,
    supportsTokenRefresh: false,
    allowsConnectAction: false,
    testConnection: notApplicableTestConnection(
      'Workspace AI provider credentials are Skillify platform-owned and are monitored through platform health checks.',
    ),
    billingResponsibility: 'skillify',
  },
  {
    id: 'skillifyClerk',
    displayName: 'Skillify Authentication',
    category: 'communication',
    credentialOwnership: 'platform',
    connectionMethod: 'none',
    implementationState: 'implemented',
    capabilities: ['authentication', 'organizations'],
    capabilityLabels: {
      authentication: 'Authentication',
      organizations: 'Organizations',
    },
    requiredPlatformEnv: [
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY',
    ],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'Clerk credentials are Skillify platform credentials.',
    manageLaterLabel: 'Platform Admin',
    supportsCallback: false,
    supportsDisconnect: false,
    supportsReconnect: false,
    supportsHealthCheck: true,
    supportsTokenRefresh: false,
    allowsConnectAction: false,
    testConnection: notApplicableTestConnection(
      'Authentication is platform-managed and not tested through workspace provider cards.',
    ),
    billingResponsibility: 'skillify',
  },
  {
    id: 'skillifySystemEmail',
    displayName: 'Skillify System Email',
    category: 'email',
    credentialOwnership: 'platform',
    connectionMethod: 'none',
    implementationState: 'implemented',
    capabilities: ['platformEmail'],
    capabilityLabels: { platformEmail: 'Platform email' },
    requiredPlatformEnv: ['RESEND_API_KEY', 'EMAIL_FROM'],
    supportedEnvironments: ['development', 'preview', 'production'],
    customerFacingExplanation:
      'Skillify uses platform email for account, security, billing, and invitation messages.',
    manageLaterLabel: 'Platform Admin',
    supportsCallback: false,
    supportsDisconnect: false,
    supportsReconnect: false,
    supportsHealthCheck: true,
    supportsTokenRefresh: false,
    allowsConnectAction: false,
    testConnection: notApplicableTestConnection(
      'Skillify system email is platform-managed and separate from workspace business-email providers.',
    ),
    billingResponsibility: 'skillify',
  },
]

export function listIntegrationProviderDefinitions() {
  return providerDefinitions
}

export function validateIntegrationProviderDefinitions(
  definitions: Array<
    Partial<IntegrationProviderDefinition>
  > = providerDefinitions,
) {
  const issues: string[] = []
  for (const provider of definitions) {
    const id = provider.id ?? 'unknown-provider'
    if (!provider.testConnection) {
      issues.push(`${id}: missing testConnection metadata`)
      continue
    }
    if (
      !['supported', 'unsupported', 'deferred', 'notApplicable'].includes(
        provider.testConnection.support,
      )
    ) {
      issues.push(`${id}: invalid testConnection support`)
    }
    if (
      provider.testConnection.support === 'supported' &&
      !provider.testConnection.defaultTestType
    ) {
      issues.push(
        `${id}: supported Test Connection requires a default test type`,
      )
    }
    if (
      provider.testConnection.support === 'supported' &&
      !provider.testConnection.readOnlyByDefault
    ) {
      issues.push(`${id}: default Test Connection must be read-only`)
    }
    if (
      provider.testConnection.support !== 'supported' &&
      (provider.testConnection.supportedTestTypes?.length ?? 0) > 0
    ) {
      issues.push(`${id}: unsupported/deferred tests cannot expose test types`)
    }
    if (
      provider.implementationState === 'implemented' &&
      provider.credentialOwnership !== 'platform' &&
      provider.testConnection.support === 'notApplicable'
    ) {
      issues.push(
        `${id}: implemented workspace providers must declare supported, unsupported, or deferred Test Connection behavior`,
      )
    }
  }
  return issues
}

export function getIntegrationProviderDefinition(id: IntegrationProviderId) {
  return providerDefinitions.find((provider) => provider.id === id) ?? null
}

export function resolveIntegrationProviderAvailability({
  provider,
  workspaceId,
  env = process.env,
}: {
  provider: IntegrationProviderDefinition
  workspaceId?: string
  env?: NodeJS.ProcessEnv
}): IntegrationProviderAvailability {
  const enabledFlag =
    provider.id === 'googleCalendar'
      ? envFlag('GOOGLE_CALENDAR_SYNC_ENABLED', false, env)
      : provider.id === 'microsoftCalendar'
        ? envFlag('MICROSOFT_CALENDAR_SYNC_ENABLED', false, env)
        : provider.id === 'caldav'
          ? envFlag('CALDAV_SYNC_ENABLED', false, env)
          : provider.id === 'twilio'
            ? envFlag('TWILIO_CONNECT_ENABLED', false, env)
            : true
  const missingPlatformEnv = missingEnv(provider.requiredPlatformEnv, env)
  const requiresEncryption =
    provider.credentialOwnership === 'workspaceOAuth' ||
    provider.credentialOwnership === 'workspaceApiKey' ||
    provider.credentialOwnership === 'workspaceManual' ||
    provider.credentialOwnership === 'workspaceWebhook'
  const encryptionConfigured = isIntegrationEncryptionConfigured()

  let status: IntegrationConnectionStatus = 'notConnected'
  let safeMessage = `${provider.displayName} is ready to configure.`

  if (provider.implementationState === 'comingSoon') {
    status = 'comingSoon'
    safeMessage = `${provider.displayName} is coming soon.`
  } else if (provider.implementationState === 'unavailable') {
    status = 'unavailable'
    safeMessage = `${provider.displayName} is unavailable.`
  } else if (!enabledFlag && provider.requiredPlatformEnv.length > 0) {
    status = 'configurationRequired'
    safeMessage = `${provider.displayName} is disabled for this Skillify deployment.`
  } else if (missingPlatformEnv.length > 0) {
    status = 'configurationRequired'
    safeMessage = `${provider.displayName} requires Skillify deployment configuration.`
  } else if (requiresEncryption && !encryptionConfigured) {
    status = 'configurationRequired'
    safeMessage = `${provider.displayName} requires integration encryption before workspace credentials can be stored.`
  }

  const resolvedStatus = status as IntegrationConnectionStatus
  const canStartConnection =
    provider.allowsConnectAction &&
    (resolvedStatus === 'notConnected' ||
      resolvedStatus === 'actionRequired') &&
    provider.implementationState !== 'comingSoon' &&
    provider.implementationState !== 'unavailable'

  return {
    providerId: provider.id,
    displayName: provider.displayName,
    category: provider.category,
    credentialOwnership: provider.credentialOwnership,
    connectionMethod: provider.connectionMethod,
    status: resolvedStatus,
    implementationState: provider.implementationState,
    capabilities: provider.capabilities,
    capabilityLabels: provider.capabilityLabels,
    requiredPlatformEnv: provider.requiredPlatformEnv,
    missingPlatformEnv,
    encryptionConfigured,
    requiresEncryption,
    canStartConnection,
    safeMessage,
    customerFacingExplanation: provider.customerFacingExplanation,
    manageLaterLabel: provider.manageLaterLabel,
    billingResponsibility: provider.billingResponsibility,
    connectPath: workspaceId ? provider.connectPath?.(workspaceId) : undefined,
    supportsCallback: provider.supportsCallback,
    supportsDisconnect: provider.supportsDisconnect,
    supportsReconnect: provider.supportsReconnect,
    supportsHealthCheck: provider.supportsHealthCheck,
    supportsTokenRefresh: provider.supportsTokenRefresh,
    testConnection: provider.testConnection,
  }
}

export function listIntegrationProviderAvailability({
  workspaceId,
  env = process.env,
}: {
  workspaceId?: string
  env?: NodeJS.ProcessEnv
} = {}) {
  return providerDefinitions.map((provider) =>
    resolveIntegrationProviderAvailability({ provider, workspaceId, env }),
  )
}
