import {
  assertIntegrationEncryptionConfigured,
  isIntegrationEncryptionConfigured,
} from '@/lib/integrations/crypto'

export type SchedulingProviderKey =
  | 'google'
  | 'microsoft'
  | 'caldav'
  | 'appleIcloud'
  | 'ics'

export type SchedulingProviderStatus =
  | 'available'
  | 'disabled'
  | 'notConfigured'
  | 'encryptionMissing'

export type SchedulingProviderConfig = {
  key: SchedulingProviderKey
  label: string
  syncEnabled: boolean
  hasRequiredCredentials: boolean
  requiresEncryption: boolean
  status: SchedulingProviderStatus
  missing: string[]
}

function envFlag(name: string, fallback = false): boolean {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function missingEnv(names: string[]): string[] {
  return names.filter((name) => !process.env[name]?.trim())
}

function resolveProviderStatus({
  syncEnabled,
  missing,
  requiresEncryption,
}: {
  syncEnabled: boolean
  missing: string[]
  requiresEncryption: boolean
}): SchedulingProviderStatus {
  if (!syncEnabled) return 'disabled'
  if (missing.length > 0) return 'notConfigured'
  if (requiresEncryption && !isIntegrationEncryptionConfigured()) {
    return 'encryptionMissing'
  }
  return 'available'
}

export function isSchedulingPersistenceEnabled(): boolean {
  return envFlag('SCHEDULING_PERSISTENCE_ENABLED', true)
}

export function getSchedulingProviderConfigs(): SchedulingProviderConfig[] {
  const googleMissing = missingEnv([
    'GOOGLE_CALENDAR_CLIENT_ID',
    'GOOGLE_CALENDAR_CLIENT_SECRET',
    'GOOGLE_CALENDAR_REDIRECT_URI',
  ])
  const microsoftMissing = missingEnv([
    'MICROSOFT_CALENDAR_CLIENT_ID',
    'MICROSOFT_CALENDAR_CLIENT_SECRET',
    'MICROSOFT_CALENDAR_REDIRECT_URI',
  ])
  const icsMissing = missingEnv(['SCHEDULING_ICS_FEED_SECRET'])

  const configs = [
    {
      key: 'google' as const,
      label: 'Google Calendar',
      syncEnabled: envFlag('GOOGLE_CALENDAR_SYNC_ENABLED'),
      missing: googleMissing,
      requiresEncryption: true,
    },
    {
      key: 'microsoft' as const,
      label: 'Microsoft Outlook',
      syncEnabled: envFlag('MICROSOFT_CALENDAR_SYNC_ENABLED'),
      missing: microsoftMissing,
      requiresEncryption: true,
    },
    {
      key: 'caldav' as const,
      label: 'CalDAV',
      syncEnabled: envFlag('CALDAV_SYNC_ENABLED', true),
      missing: [],
      requiresEncryption: true,
    },
    {
      key: 'appleIcloud' as const,
      label: 'Apple Calendar',
      syncEnabled: false,
      missing: [],
      requiresEncryption: true,
    },
    {
      key: 'ics' as const,
      label: 'ICS feed',
      syncEnabled: false,
      missing: icsMissing,
      requiresEncryption: false,
    },
  ]

  return configs.map((config) => ({
    ...config,
    hasRequiredCredentials: config.missing.length === 0,
    status: resolveProviderStatus(config),
  }))
}

export function getSchedulingProviderConfig(
  key: SchedulingProviderKey,
): SchedulingProviderConfig {
  const config = getSchedulingProviderConfigs().find(
    (entry) => entry.key === key,
  )
  if (!config) {
    throw new Error(`Unsupported scheduling provider: ${key}`)
  }
  return config
}

export function assertSchedulingProviderCanStoreCredentials(
  key: SchedulingProviderKey,
): void {
  const config = getSchedulingProviderConfig(key)
  if (config.status === 'disabled') {
    throw new Error(`${config.label} sync is disabled.`)
  }
  if (config.status === 'notConfigured') {
    throw new Error(
      `${config.label} sync is missing required configuration: ${config.missing.join(', ')}`,
    )
  }
  if (config.requiresEncryption) {
    assertIntegrationEncryptionConfigured()
  }
}

export function getSchedulingIntegrationSummary() {
  const providers = getSchedulingProviderConfigs()
  return {
    nativePersistenceEnabled: isSchedulingPersistenceEnabled(),
    notificationsEnabled: envFlag('SCHEDULING_NOTIFICATIONS_ENABLED'),
    providers,
    externalSyncAvailable: providers.some(
      (provider) => provider.status === 'available',
    ),
  }
}
