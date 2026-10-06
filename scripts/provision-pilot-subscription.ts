import 'dotenv/config'

import { PilotProvisioningError } from '@/lib/billing/pilotProvisioning'
import { runPilotProvisioningCli } from '@/scripts/pilotProvisioningCli'

runPilotProvisioningCli(process.argv.slice(2)).catch((error: unknown) => {
  const message =
    error instanceof PilotProvisioningError
      ? `${error.code}: ${error.message}`
      : 'UNEXPECTED_ERROR: Pilot provisioning failed without making a confirmed complete change.'
  console.error(message)
  process.exitCode = 1
})
