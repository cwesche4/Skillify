type Env = {
  HUBSPOT_CLIENT_ID: string
  HUBSPOT_CLIENT_SECRET: string
  HUBSPOT_REDIRECT_URI: string
  INTEGRATIONS_ENCRYPTION_KEY?: string
}

function required(key: keyof Env, env: NodeJS.ProcessEnv): string {
  const val = env[key]
  if (!val) throw new Error(`Missing env ${key} for HubSpot integration`)
  return val
}

export function loadIntegrationEnv(): Env {
  const env = process.env
  return {
    HUBSPOT_CLIENT_ID: required('HUBSPOT_CLIENT_ID', env),
    HUBSPOT_CLIENT_SECRET: required('HUBSPOT_CLIENT_SECRET', env),
    HUBSPOT_REDIRECT_URI: required('HUBSPOT_REDIRECT_URI', env),
    INTEGRATIONS_ENCRYPTION_KEY: env.INTEGRATIONS_ENCRYPTION_KEY,
  }
}

let validated = false

/**
 * Lazily validates CRM env. Call inside CRM routes/adapter paths so unused
 * environments do not crash startup.
 */
export function ensureIntegrationEnv() {
  if (validated) return
  loadIntegrationEnv()
  validated = true
}
