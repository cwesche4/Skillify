import fs from 'fs'
import path from 'path'

import { describe, expect, it } from 'vitest'

const rootDir = process.cwd()
const ignoredDirectories = new Set([
  '.git',
  '.next',
  'node_modules',
  'coverage',
  'dist',
])
const ignoredFiles = new Set(['package-lock.json', 'project_tree.txt'])
const scannedExtensions = new Set([
  '.cjs',
  '.js',
  '.json',
  '.mjs',
  '.prisma',
  '.ts',
  '.tsx',
])

const documentedTemplateOnlyVariables = new Set([
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_DEFAULT_MODEL',
  'AI_PLAYGROUND_ENABLED',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_API_VERSION',
  'AZURE_OPENAI_DEPLOYMENT',
  'AZURE_OPENAI_ENDPOINT',
  'CLERK_AFTER_SIGN_IN_URL',
  'CLERK_AFTER_SIGN_UP_URL',
  'CLERK_JWT_KEY',
  'CLERK_SIGN_IN_URL',
  'CLERK_SIGN_UP_URL',
  'GEMINI_API_KEY',
  'GEMINI_DEFAULT_MODEL',
  'GOOGLE_CALENDAR_ID',
  'GOOGLE_SERVICE_ACCOUNT',
  'LOG_LEVEL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_TELEMETRY_DISABLED',
  'R2_ACCESS_KEY_ID',
  'R2_ACCOUNT_ID',
  'R2_BUCKET',
  'R2_SECRET_ACCESS_KEY',
  'S3_ACCESS_KEY_ID',
  'S3_BUCKET',
  'S3_REGION',
  'S3_SECRET_ACCESS_KEY',
  'SCHEDULING_ICS_ENABLED',
  'SCHEDULING_NOTIFICATIONS_ENABLED',
  'SENTRY_DSN',
  'STORAGE_PROVIDER',
  'STRIPE_PRICE_BASIC_MONTHLY',
  'STRIPE_PRICE_ELITE_MONTHLY',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_WEBHOOK_SECRET',
  'UPLOAD_MAX_BYTES',
])

const removedTemplateVariables = [
  'OWNER_MOBILE',
  'TWILIO_FROM',
  'UPSELL_NOTIFY_EMAIL_TO',
]

function readEnvKeys(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return []
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
    .filter((key): key is string => Boolean(key))
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates].sort()
}

function listProjectFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  return entries.flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return []
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listProjectFiles(absolutePath)
    if (ignoredFiles.has(entry.name)) return []
    if (!scannedExtensions.has(path.extname(entry.name))) return []
    return [absolutePath]
  })
}

function extractReferencedEnvKeys(source: string): string[] {
  const keys = new Set<string>()
  const patterns = [
    /process\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\])/g,
    /env\(['"]([A-Za-z_][A-Za-z0-9_]*)['"]\)/g,
    /envFlag\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
    /required\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
  ]

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const key = match[1] ?? match[2]
      if (key) keys.add(key)
    }
  }

  for (const match of source.matchAll(/missingEnv\(\s*\[([\s\S]*?)\]\s*\)/g)) {
    for (const keyMatch of (match[1] ?? '').matchAll(
      /['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
    )) {
      keys.add(keyMatch[1])
    }
  }

  return [...keys]
}

function referencedEnvKeys(): string[] {
  const keys = new Set<string>()
  for (const filePath of listProjectFiles(rootDir)) {
    const source = fs.readFileSync(filePath, 'utf8')
    for (const key of extractReferencedEnvKeys(source)) {
      keys.add(key)
    }
  }
  return [...keys].sort()
}

describe('environment configuration templates', () => {
  it('documents every directly referenced environment variable in .env.example', () => {
    const exampleKeys = new Set(readEnvKeys(path.join(rootDir, '.env.example')))

    expect(referencedEnvKeys().filter((key) => !exampleKeys.has(key))).toEqual(
      [],
    )
  })

  it('does not define duplicate variables in .env.example or .env.local', () => {
    expect(
      findDuplicates(readEnvKeys(path.join(rootDir, '.env.example'))),
    ).toEqual([])
    expect(
      findDuplicates(readEnvKeys(path.join(rootDir, '.env.local'))),
    ).toEqual([])
  })

  it('keeps .env.local aligned to documented project variables by key', () => {
    const exampleKeys = new Set(readEnvKeys(path.join(rootDir, '.env.example')))
    const localKeys = readEnvKeys(path.join(rootDir, '.env.local'))

    expect(localKeys.filter((key) => !exampleKeys.has(key))).toEqual([])
  })

  it('keeps template-only placeholders explicit and removes obsolete names', () => {
    const exampleKeys = new Set(readEnvKeys(path.join(rootDir, '.env.example')))
    const referencedKeys = new Set(referencedEnvKeys())
    const unusedKeys = [...exampleKeys]
      .filter((key) => !referencedKeys.has(key))
      .filter((key) => !documentedTemplateOnlyVariables.has(key))

    expect(unusedKeys).toEqual([])
    for (const key of removedTemplateVariables) {
      expect(exampleKeys.has(key)).toBe(false)
    }
  })
})
