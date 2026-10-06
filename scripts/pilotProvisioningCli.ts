import { createHash } from 'node:crypto'

import {
  parsePilotEnvironment,
  parsePilotExpiration,
  parsePilotPlan,
  PilotProvisioningError,
  provisionPilotSubscription,
  type PilotProvisioningInput,
} from '@/lib/billing/pilotProvisioning'

const VALUE_FLAGS = new Set([
  'clerk-user-id',
  'plan',
  'expires-at',
  'operator',
  'reason',
  'workspace-id',
  'environment',
  'confirm',
  'confirm-production',
])
const BOOLEAN_FLAGS = new Set(['execute'])

function parseFlags(argv: string[]) {
  const values = new Map<string, string>()
  const booleans = new Set<string>()

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) {
      throw new PilotProvisioningError(
        'INVALID_ARGUMENT',
        `Unexpected positional argument at position ${index + 1}.`,
      )
    }

    const equalsIndex = argument.indexOf('=')
    const name = argument.slice(2, equalsIndex === -1 ? undefined : equalsIndex)
    if (BOOLEAN_FLAGS.has(name)) {
      if (equalsIndex !== -1 || booleans.has(name)) {
        throw new PilotProvisioningError(
          'INVALID_ARGUMENT',
          `--${name} must be supplied once without a value.`,
        )
      }
      booleans.add(name)
      continue
    }
    if (!VALUE_FLAGS.has(name)) {
      throw new PilotProvisioningError(
        'INVALID_ARGUMENT',
        `Unknown option --${name}.`,
      )
    }
    if (values.has(name)) {
      throw new PilotProvisioningError(
        'INVALID_ARGUMENT',
        `--${name} must not be supplied more than once.`,
      )
    }

    const value =
      equalsIndex === -1 ? argv[index + 1] : argument.slice(equalsIndex + 1)
    if (!value || (equalsIndex === -1 && value.startsWith('--'))) {
      throw new PilotProvisioningError(
        'INVALID_ARGUMENT',
        `--${name} requires a value.`,
      )
    }
    values.set(name, value)
    if (equalsIndex === -1) index += 1
  }

  return { values, booleans }
}

export function parsePilotProvisioningArguments(
  argv: string[],
  now = new Date(),
): PilotProvisioningInput {
  const { values, booleans } = parseFlags(argv)
  return {
    clerkUserId: values.get('clerk-user-id') ?? '',
    plan: parsePilotPlan(values.get('plan')),
    expiresAt: parsePilotExpiration(values.get('expires-at'), now),
    operator: values.get('operator') ?? '',
    reason: values.get('reason') ?? '',
    workspaceId: values.get('workspace-id'),
    environment: parsePilotEnvironment(values.get('environment')),
    execute: booleans.has('execute'),
    confirmation: values.get('confirm'),
    productionConfirmation: values.get('confirm-production'),
  }
}

function redactIdentifier(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

export async function runPilotProvisioningCli(
  argv: string[],
  dependencies: {
    now?: Date
    databaseUrl?: string
    provision?: typeof provisionPilotSubscription
    write?: (message: string) => void
  } = {},
) {
  const write = dependencies.write ?? console.log
  const input = parsePilotProvisioningArguments(argv, dependencies.now)
  const result = await (dependencies.provision ?? provisionPilotSubscription)(
    input,
    {
      now: dependencies.now,
      databaseUrl: dependencies.databaseUrl,
    },
  )

  write(
    JSON.stringify(
      {
        status: result.status,
        changesMade: result.changed,
        targetFingerprint: redactIdentifier(result.userId),
        plan: result.plan,
        expiresAt: result.expiresAt,
        workspaceScoped: result.workspaceId !== null,
        environment: result.environment,
        databaseTarget: result.databaseTarget,
        confirmationToken:
          result.status === 'DRY_RUN' ? result.confirmationToken : undefined,
      },
      null,
      2,
    ),
  )
  if (result.status === 'DRY_RUN') {
    write('DRY RUN — NO CHANGES MADE')
  } else if (result.status === 'ALREADY_PROVISIONED') {
    write('ALREADY PROVISIONED — NO CHANGE')
  } else {
    write('CONTROLLED PILOT PROVISIONED')
  }
  return result
}
