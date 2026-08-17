import { beforeEach, describe, expect, it } from 'vitest'

import {
  decryptIntegrationPayload,
  encryptIntegrationPayload,
  maskSecretHint,
} from '@/lib/integrations/crypto'
import {
  resolveEmailDeliveryProvider,
  type EmailDeliveryResolution,
} from '@/lib/integrations/emailDeliveryPolicy'
import { resolveIntegrationCapabilities } from '@/lib/integrations/capabilities'
import { resolveIntegrationHealth } from '@/lib/integrations/health'
import {
  buildLeadIntakeDeduplicationKey,
  listLeadIntakeSourceDefinitions,
  resolveLeadIntakeSourceCards,
} from '@/lib/integrations/leadIntake'
import { resolveNotificationChannelAvailability } from '@/lib/integrations/notificationChannels'
import {
  createIntegrationOAuthState,
  verifyIntegrationOAuthState,
} from '@/lib/integrations/oauthState'
import {
  getIntegrationProviderDefinition,
  listIntegrationProviderAvailability,
  listIntegrationProviderDefinitions,
  validateIntegrationProviderDefinitions,
} from '@/lib/integrations/providerRegistry'
import type { SafeWorkspaceIntegrationConnection } from '@/lib/integrations/workspaceConnections'

const encryptionKey = Buffer.alloc(32, 4).toString('base64')

function workspaceConnection(
  overrides: Partial<SafeWorkspaceIntegrationConnection> = {},
): SafeWorkspaceIntegrationConnection {
  return {
    id: 'connection-1',
    workspaceId: 'workspace-1',
    providerId: 'resend',
    category: 'email',
    ownershipType: 'workspaceApiKey',
    status: 'connected',
    externalAccountId: 'example.com',
    externalAccountLabel: 'hello@example.com',
    credentialHint: '••••cdef',
    grantedScopes: null,
    tokenExpiresAt: null,
    refreshStatus: null,
    providerMetadata: {
      domainStatus: 'verified',
      fromEmail: 'hello@example.com',
      fromName: 'Acme',
    },
    connectedByUserId: null,
    connectedByWorkspaceMemberId: null,
    connectedAt: null,
    lastValidatedAt: null,
    lastSuccessfulSyncAt: null,
    lastErrorCode: null,
    lastErrorAt: null,
    disabledAt: null,
    revokedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

describe('integration connection foundation', () => {
  beforeEach(() => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = encryptionKey
    process.env.SECRET_ENCRYPTION_KEY = encryptionKey
    delete process.env.GOOGLE_CALENDAR_SYNC_ENABLED
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET
    delete process.env.GOOGLE_CALENDAR_REDIRECT_URI
    delete process.env.MICROSOFT_CALENDAR_SYNC_ENABLED
    delete process.env.MICROSOFT_CALENDAR_CLIENT_ID
    delete process.env.MICROSOFT_CALENDAR_CLIENT_SECRET
    delete process.env.MICROSOFT_CALENDAR_REDIRECT_URI
    delete process.env.TWILIO_CONNECT_ENABLED
    delete process.env.TWILIO_CONNECT_APP_SID
    delete process.env.TWILIO_CONNECT_CALLBACK_URL
    delete process.env.HUBSPOT_CLIENT_ID
    delete process.env.HUBSPOT_CLIENT_SECRET
    delete process.env.HUBSPOT_REDIRECT_URI
  })

  it('classifies platform credentials separately from workspace-owned credentials', () => {
    expect(
      getIntegrationProviderDefinition('googleCalendar')?.credentialOwnership,
    ).toBe('workspaceOAuth')
    expect(
      getIntegrationProviderDefinition('microsoftCalendar')
        ?.credentialOwnership,
    ).toBe('workspaceOAuth')
    expect(
      getIntegrationProviderDefinition('twilio')?.credentialOwnership,
    ).toBe('workspaceOAuth')
    expect(
      getIntegrationProviderDefinition('resend')?.credentialOwnership,
    ).toBe('workspaceApiKey')
    expect(
      getIntegrationProviderDefinition('skillifyOpenAI')?.credentialOwnership,
    ).toBe('platform')
    expect(
      getIntegrationProviderDefinition('skillifySystemEmail')
        ?.credentialOwnership,
    ).toBe('platform')
  })

  it('requires every provider to declare explicit Test Connection metadata', () => {
    expect(validateIntegrationProviderDefinitions()).toEqual([])
    expect(
      listIntegrationProviderDefinitions().every((provider) =>
        Boolean(provider.testConnection),
      ),
    ).toBe(true)
    expect(
      validateIntegrationProviderDefinitions([
        {
          id: 'googleCalendar',
          implementationState: 'implemented',
          credentialOwnership: 'workspaceOAuth',
        },
      ]),
    ).toEqual(['googleCalendar: missing testConnection metadata'])
  })

  it('classifies Test Connection support without fabricating deferred providers', () => {
    expect(
      getIntegrationProviderDefinition('googleCalendar')?.testConnection,
    ).toMatchObject({
      support: 'supported',
      defaultTestType: 'readOnly',
      readOnlyByDefault: true,
      mutationRequiresConfirmation: false,
    })
    expect(
      getIntegrationProviderDefinition('resend')?.testConnection,
    ).toMatchObject({
      support: 'supported',
      requiredCapabilities: ['email.send', 'domainVerification'],
    })
    expect(
      getIntegrationProviderDefinition('twilio')?.testConnection,
    ).toMatchObject({
      support: 'deferred',
      supportedTestTypes: [],
    })
    expect(
      getIntegrationProviderDefinition('skillifyOpenAI')?.testConnection,
    ).toMatchObject({
      support: 'notApplicable',
    })
  })

  it('reports exact provider configuration states without exposing values', () => {
    const google = listIntegrationProviderAvailability({
      workspaceId: 'workspace-1',
      env: {
        ...process.env,
        GOOGLE_CALENDAR_SYNC_ENABLED: 'true',
        GOOGLE_CALENDAR_CLIENT_ID: 'client-id',
      },
    }).find((provider) => provider.providerId === 'googleCalendar')

    expect(google?.status).toBe('configurationRequired')
    expect(google?.missingPlatformEnv).toEqual([
      'GOOGLE_CALENDAR_CLIENT_SECRET',
      'GOOGLE_CALENDAR_REDIRECT_URI',
    ])
    expect(JSON.stringify(google)).not.toContain('client-id')
  })

  it('allows Google initiation only when platform config and encryption are ready', () => {
    const google = listIntegrationProviderAvailability({
      workspaceId: 'workspace-1',
      env: {
        ...process.env,
        GOOGLE_CALENDAR_SYNC_ENABLED: 'true',
        GOOGLE_CALENDAR_CLIENT_ID: 'client-id',
        GOOGLE_CALENDAR_CLIENT_SECRET: 'client-secret',
        GOOGLE_CALENDAR_REDIRECT_URI:
          'http://localhost:3000/api/scheduling/google/callback',
      },
    }).find((provider) => provider.providerId === 'googleCalendar')

    expect(google?.status).toBe('notConnected')
    expect(google?.canStartConnection).toBe(true)
    expect(google?.connectPath).toBe(
      '/api/workspaces/workspace-1/scheduling/google/connect',
    )
    expect(JSON.stringify(google)).not.toContain('client-secret')
  })

  it('keeps unsupported lead providers truthful and non-connectable', () => {
    const providers = listIntegrationProviderAvailability({
      workspaceId: 'workspace-1',
    })
    expect(
      providers.find((provider) => provider.providerId === 'googleAds')?.status,
    ).toBe('comingSoon')
    expect(
      providers.find((provider) => provider.providerId === 'metaLeadAds')
        ?.canStartConnection,
    ).toBe(false)
  })

  it('encrypts workspace API-key payloads with a versioned envelope', () => {
    const encrypted = encryptIntegrationPayload({
      apiKey: 're_1234567890abcdef',
    })

    expect(encrypted).not.toContain('re_1234567890abcdef')
    expect(JSON.parse(encrypted)).toMatchObject({
      version: 1,
      algorithm: 'aes-256-gcm',
      keyId: 'integrations:v1',
    })
    expect(decryptIntegrationPayload(encrypted)).toEqual({
      apiKey: 're_1234567890abcdef',
    })
    expect(maskSecretHint('re_1234567890abcdef')).toBe('••••cdef')
  })

  it('signs OAuth state and rejects workspace tampering and open redirects', () => {
    const state = createIntegrationOAuthState({
      providerId: 'googleCalendar',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      workspaceMemberId: 'member-1',
      returnDestination: {
        kind: 'setup',
        path: '/dashboard/acme?setup=1&setupStep=calendars',
        setupStep: 'calendars',
      },
    })

    expect(
      verifyIntegrationOAuthState({
        state,
        expectedProviderId: 'googleCalendar',
        expectedWorkspaceId: 'workspace-1',
      }).workspaceMemberId,
    ).toBe('member-1')
    expect(() =>
      verifyIntegrationOAuthState({
        state,
        expectedProviderId: 'googleCalendar',
        expectedWorkspaceId: 'workspace-2',
      }),
    ).toThrow(/workspace mismatch/i)
    expect(() =>
      createIntegrationOAuthState({
        providerId: 'googleCalendar',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        returnDestination: { kind: 'settings', path: 'https://evil.test' },
      }),
    ).toThrow(/safe relative path/i)
  })

  it('keeps platform email separate from workspace Resend business email', () => {
    const workspaceResend = {
      id: 'connection-1',
      workspaceId: 'workspace-1',
      providerId: 'resend',
      category: 'email',
      ownershipType: 'workspaceApiKey',
      status: 'connected',
      externalAccountId: 'example.com',
      externalAccountLabel: 'Acme <hello@example.com>',
      credentialHint: '••••cdef',
      grantedScopes: null,
      tokenExpiresAt: null,
      refreshStatus: null,
      providerMetadata: {
        domainStatus: 'verified',
        fromEmail: 'hello@example.com',
        fromName: 'Acme',
      },
      connectedByUserId: 'user-1',
      connectedByWorkspaceMemberId: 'member-1',
      connectedAt: null,
      lastValidatedAt: null,
      lastSuccessfulSyncAt: null,
      lastErrorCode: null,
      lastErrorAt: null,
      disabledAt: null,
      revokedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } satisfies Parameters<
      typeof resolveEmailDeliveryProvider
    >[0]['workspaceConnections'][number]

    expect(
      resolveEmailDeliveryProvider({
        purpose: 'workspaceInvitation',
        workspaceConnections: [workspaceResend],
        platformEmailAvailable: true,
      }),
    ).toEqual({ provider: 'platformEmail', reason: 'platformMessage' })

    const businessResolution = resolveEmailDeliveryProvider({
      purpose: 'schedulingReminder',
      workspaceConnections: [workspaceResend],
      platformEmailAvailable: true,
    }) as Extract<EmailDeliveryResolution, { provider: 'workspaceResend' }>

    expect(businessResolution.provider).toBe('workspaceResend')
    expect(businessResolution.fromEmail).toBe('hello@example.com')
  })

  it('does not treat an unverified customer Resend domain as ready', () => {
    const resolution = resolveEmailDeliveryProvider({
      purpose: 'customerFollowUp',
      platformEmailAvailable: true,
      workspaceConnections: [
        {
          id: 'connection-1',
          workspaceId: 'workspace-1',
          providerId: 'resend',
          category: 'email',
          ownershipType: 'workspaceApiKey',
          status: 'connected',
          externalAccountId: 'example.com',
          externalAccountLabel: 'hello@example.com',
          credentialHint: '••••cdef',
          grantedScopes: null,
          tokenExpiresAt: null,
          refreshStatus: null,
          providerMetadata: { domainStatus: 'verificationPending' },
          connectedByUserId: null,
          connectedByWorkspaceMemberId: null,
          connectedAt: null,
          lastValidatedAt: null,
          lastSuccessfulSyncAt: null,
          lastErrorCode: null,
          lastErrorAt: null,
          disabledAt: null,
          revokedAt: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    })

    expect(resolution).toEqual({
      provider: 'disabled',
      reason: 'workspaceSenderUnverified',
    })
  })

  it('resolves provider capabilities from connection state and provider-specific readiness', () => {
    const resend = getIntegrationProviderDefinition('resend')
    expect(resend).not.toBeNull()
    const unverified = workspaceConnection({
      providerMetadata: { domainStatus: 'verificationPending' },
    })

    const capabilities = resolveIntegrationCapabilities({
      provider: resend!,
      connection: unverified,
    })

    expect(
      capabilities.find((capability) => capability.id === 'email.send'),
    ).toMatchObject({
      label: 'Send business email',
      available: false,
      blockedReason: 'workspaceSenderUnverified',
    })

    const verified = resolveIntegrationCapabilities({
      provider: resend!,
      connection: workspaceConnection(),
    })
    expect(
      verified.find((capability) => capability.id === 'email.send'),
    ).toMatchObject({ available: true })
  })

  it('resolves local integration health without making provider calls', () => {
    const healthy = resolveIntegrationHealth({
      providerId: 'resend',
      connection: workspaceConnection({
        lastValidatedAt: new Date('2026-01-01T12:00:00.000Z'),
        lastSuccessfulSyncAt: new Date('2026-01-01T12:00:00.000Z'),
      }),
      now: new Date('2026-01-01T13:00:00.000Z'),
    })

    expect(healthy).toMatchObject({
      state: 'healthy',
      label: 'Healthy',
      stale: false,
    })

    const degraded = resolveIntegrationHealth({
      providerId: 'resend',
      connection: workspaceConnection({ lastErrorCode: 'domainCheckFailed' }),
    })
    expect(degraded).toMatchObject({
      state: 'degraded',
      requiredAction: 'Test the connection.',
    })
  })

  it('keeps notification channel preferences separate from provider readiness', () => {
    expect(
      resolveNotificationChannelAvailability({
        channel: 'inApp',
        enabled: true,
        workspaceConnections: [],
        platformEmailAvailable: false,
      }),
    ).toMatchObject({
      available: true,
      enabled: true,
      selectedProvider: 'skillify',
    })

    expect(
      resolveNotificationChannelAvailability({
        channel: 'email',
        enabled: true,
        workspaceConnections: [workspaceConnection()],
        platformEmailAvailable: true,
      }),
    ).toMatchObject({
      available: true,
      enabled: true,
      selectedProvider: 'connection-1',
    })

    process.env.TWILIO_CONNECT_ENABLED = 'true'
    process.env.TWILIO_CONNECT_APP_SID = 'app-sid'
    process.env.TWILIO_CONNECT_CALLBACK_URL = 'https://example.com/twilio'

    expect(
      resolveNotificationChannelAvailability({
        channel: 'sms',
        enabled: true,
        workspaceConnections: [],
        platformEmailAvailable: true,
      }),
    ).toMatchObject({
      available: false,
      blockedReason: 'twilioNotConnected',
    })
  })

  it('defines truthful lead-intake sources and stable deduplication keys', () => {
    const sources = listLeadIntakeSourceDefinitions()
    expect(sources.map((source) => source.id)).toEqual(
      expect.arrayContaining([
        'nativeWebsiteForm',
        'inboundWebhook',
        'hubspot',
        'googleAdsLeadForms',
        'googleBusinessProfile',
        'metaLeadAds',
      ]),
    )
    expect(
      sources.find((source) => source.id === 'googleAdsLeadForms')
        ?.setupAvailability,
    ).toBe('comingSoon')
    expect(
      buildLeadIntakeDeduplicationKey({
        workspaceId: 'workspace-1',
        sourceId: 'nativeWebsiteForm',
        email: 'ALICE@example.com',
        phone: '+1 555 123 4567',
        externalLeadId: 'lead-123',
      }),
    ).toBe('workspace-1:nativeWebsiteForm:no-connection:lead-123')
  })

  it('resolves truthful lead-intake card statuses and actions', () => {
    const missingConfig = resolveLeadIntakeSourceCards({
      workspaceId: 'workspace-1',
      workspaceSlug: 'acme',
      manualSelected: true,
      env: {} as NodeJS.ProcessEnv,
    })

    expect(
      missingConfig.find((source) => source.id === 'manualEntry'),
    ).toMatchObject({
      status: 'selected',
      statusLabel: 'Selected fallback',
      action: { kind: 'selectManual', disabled: true },
    })
    expect(
      missingConfig.find((source) => source.id === 'hubspot'),
    ).toMatchObject({
      status: 'configurationRequired',
      statusLabel: 'Configuration Required',
    })
    expect(
      missingConfig.find((source) => source.id === 'googleAdsLeadForms'),
    ).toMatchObject({
      status: 'comingSoon',
      action: undefined,
    })

    const previousEncryptionKey = process.env.INTEGRATIONS_ENCRYPTION_KEY
    process.env.INTEGRATIONS_ENCRYPTION_KEY = encryptionKey
    const readyHubSpot = resolveLeadIntakeSourceCards({
      workspaceId: 'workspace-1',
      workspaceSlug: 'acme',
      env: {
        HUBSPOT_CLIENT_ID: 'client',
        HUBSPOT_CLIENT_SECRET: 'secret',
        HUBSPOT_REDIRECT_URI:
          'https://app.example.com/api/integrations/hubspot/callback',
      } as unknown as NodeJS.ProcessEnv,
    }).find((source) => source.id === 'hubspot')
    if (previousEncryptionKey === undefined) {
      delete process.env.INTEGRATIONS_ENCRYPTION_KEY
    } else {
      process.env.INTEGRATIONS_ENCRYPTION_KEY = previousEncryptionKey
    }

    expect(readyHubSpot).toMatchObject({
      status: 'ready',
      action: {
        kind: 'connect',
        href: '/api/integrations/hubspot/connect?workspaceId=workspace-1',
      },
    })
  })
})
