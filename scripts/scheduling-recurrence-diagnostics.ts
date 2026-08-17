import { schedulingRepository } from '@/lib/scheduling/repository'

function readArg(name: string) {
  const prefix = `--${name}=`
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length)
}

async function main() {
  const workspaceId = readArg('workspace')
  const seriesId = readArg('series')
  const repair = process.argv.includes('--repair')
  const apply = process.argv.includes('--apply')
  const actorUserId = readArg('actor') ?? 'system'

  if (!workspaceId) {
    throw new Error(
      'Usage: npx tsx scripts/scheduling-recurrence-diagnostics.ts --workspace=<workspaceId> [--series=<seriesId>] [--repair] [--apply] [--actor=<userId>]',
    )
  }

  if (repair) {
    if (!seriesId) {
      throw new Error('Repair requires --series=<seriesId>.')
    }
    const result = await schedulingRepository.repairRecurrenceIntegrity({
      workspaceId,
      seriesId,
      actorUserId,
      dryRun: !apply,
    })
    console.log(JSON.stringify(result, null, 2))
    return
  }

  const findings = await schedulingRepository.checkRecurrenceIntegrity({
    workspaceId,
    seriesId,
  })
  console.log(JSON.stringify({ workspaceId, seriesId, findings }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
