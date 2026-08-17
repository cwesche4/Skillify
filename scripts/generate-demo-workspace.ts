#!/usr/bin/env tsx

import 'dotenv/config'
import { readFileSync } from 'node:fs'

import {
  DEMO_WORKSPACE_TIMEZONE,
  assertDemoWorkspaceGeneratorAllowed,
  getDemoWorkspaceSummary,
  populateDemoWorkspace,
  createDemoWorkspacePlan,
  resolveDemoWorkspaceGenerationConfig,
  type DemoScenarioPreset,
  type DemoWorkspaceGenerationConfig,
} from '@/lib/dev/demoWorkspaceGenerator'
import { getWorkspaceDateKey } from '@/lib/scheduling/schedulingDateTime'

type CliOptions = {
  workspaceId?: string
  workspaceSlug?: string
  anchorDate?: string
  timezone?: string
  configPath?: string
  preset?: DemoScenarioPreset
  seed?: number
  eventCount?: number
  dryRun: boolean
}

function readCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--workspace-id') options.workspaceId = argv[++index]
    else if (arg === '--workspace-slug') options.workspaceSlug = argv[++index]
    else if (arg === '--anchor-date') options.anchorDate = argv[++index]
    else if (arg === '--timezone') options.timezone = argv[++index]
    else if (arg === '--config') options.configPath = argv[++index]
    else if (arg === '--preset')
      options.preset = argv[++index] as DemoScenarioPreset
    else if (arg === '--seed') options.seed = Number(argv[++index])
    else if (arg === '--event-count') options.eventCount = Number(argv[++index])
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }
  return options
}

function printHelp() {
  console.log(`Skillify development demo workspace generator

Usage:
  npm run demo:workspace -- --workspace-slug <slug>
  npm run demo:workspace -- --workspace-id <workspaceId>
  npm run demo:workspace -- --workspace-slug <slug> --preset ai-playground-comprehensive --seed 42
  npm run demo:workspace -- --workspace-slug <slug> --config ./demo-config.json

Options:
  --anchor-date YYYY-MM-DD   Anchor generated dates around this workspace-local date.
  --timezone IANA_ZONE       Defaults to ${DEMO_WORKSPACE_TIMEZONE}.
  --preset NAME              Named scenario preset.
  --seed NUMBER              Deterministic seed recorded in the generation report.
  --event-count NUMBER       Override generated scheduling event count.
  --config PATH              JSON generation config file.
  --dry-run                  Print the deterministic plan summary without writing data.
`)
}

function readDemoConfig(options: CliOptions): DemoWorkspaceGenerationConfig {
  const fileConfig = options.configPath
    ? (JSON.parse(
        readFileSync(options.configPath, 'utf8'),
      ) as DemoWorkspaceGenerationConfig)
    : {}
  return resolveDemoWorkspaceGenerationConfig({
    ...fileConfig,
    preset: options.preset ?? fileConfig.preset,
    seed: options.seed ?? fileConfig.seed,
    scheduling: {
      ...fileConfig.scheduling,
      ...(options.eventCount !== undefined
        ? { eventCount: options.eventCount }
        : {}),
    },
  })
}

async function resolveWorkspaceId(options: CliOptions) {
  if (!options.workspaceId && !options.workspaceSlug) {
    throw new Error('Provide --workspace-id or --workspace-slug.')
  }
  const { prisma } = await import('@/lib/db')

  const [byId, bySlug] = await Promise.all([
    options.workspaceId
      ? prisma.workspace.findUnique({
          where: { id: options.workspaceId },
          select: { id: true, name: true, slug: true },
        })
      : null,
    options.workspaceSlug
      ? prisma.workspace.findUnique({
          where: { slug: options.workspaceSlug },
          select: { id: true, name: true, slug: true },
        })
      : null,
  ])

  if (
    options.workspaceId &&
    options.workspaceSlug &&
    byId &&
    bySlug &&
    byId.id !== bySlug.id
  ) {
    throw new Error(
      `Workspace ID ${options.workspaceId} and slug ${options.workspaceSlug} resolve to different workspaces.`,
    )
  }

  const workspace = byId ?? bySlug
  if (!workspace) {
    const available = await prisma.workspace.findMany({
      where: { archivedAt: null },
      select: { name: true, slug: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    const lookup = options.workspaceId
      ? `ID ${options.workspaceId}`
      : `slug ${options.workspaceSlug}`
    const suggestions = available.length
      ? ` Available development workspaces: ${available
          .map((item) => `${item.name} (${item.slug})`)
          .join(', ')}.`
      : ''
    throw new Error(
      `Workspace ${lookup} was not found. Check the workspace ID or slug and try again.${suggestions}`,
    )
  }
  return workspace.id
}

async function main() {
  assertDemoWorkspaceGeneratorAllowed()
  const options = readCliOptions(process.argv.slice(2))
  const timezone = options.timezone ?? DEMO_WORKSPACE_TIMEZONE
  const anchorDate =
    options.anchorDate ?? getWorkspaceDateKey(new Date(), timezone)
  const workspaceId = await resolveWorkspaceId(options)
  const config = readDemoConfig(options)

  if (options.dryRun) {
    const plan = createDemoWorkspacePlan({
      workspaceId,
      anchorDate,
      timezone,
      config,
    })
    console.log(JSON.stringify(getDemoWorkspaceSummary(plan), null, 2))
    return
  }

  const result = await populateDemoWorkspace({
    workspaceId,
    anchorDate,
    timezone,
    config,
  })
  console.log('Development demo workspace generated.')
  console.log(JSON.stringify(result.summary, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
