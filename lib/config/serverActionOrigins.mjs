const LOCAL_DEVELOPMENT_ORIGINS = [
  'localhost:3000',
  '127.0.0.1:3000',
  '[::1]:3000',
]

function configuredOrigin(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.host || null
  } catch {
    return null
  }
}

export function getServerActionAllowedOrigins(env = process.env) {
  const origins = new Set(LOCAL_DEVELOPMENT_ORIGINS)
  const canonical = configuredOrigin(env.NEXT_PUBLIC_APP_URL)
  if (canonical) origins.add(canonical)
  return [...origins]
}
