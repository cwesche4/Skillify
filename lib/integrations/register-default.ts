import { registerIntegrationAdapter } from './registry'
import { hubspotAdapter } from './hubspot/adapter'
import { salesforceAdapter } from './salesforce/adapter'
import { pipedriveAdapter } from './pipedrive/adapter'

let registered = false

export function ensureIntegrationAdapters() {
  if (registered) return
  registerIntegrationAdapter(hubspotAdapter)
  registerIntegrationAdapter(salesforceAdapter)
  registerIntegrationAdapter(pipedriveAdapter)
  registered = true
}
