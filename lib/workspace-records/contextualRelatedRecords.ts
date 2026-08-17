export type ContextualRelatedRecordType =
  | 'lead'
  | 'opportunity'
  | 'sale'
  | 'client'
  | 'serviceRequest'
  | 'workItem'
  | 'project'
  | 'invoice'
  | 'activity'
  | 'estimate'
  | 'assignee'
  | 'checklist'

export type ContextualRelatedRecord = {
  id: string
  type: ContextualRelatedRecordType
  label: string
  value: string
  helper?: string
  href?: string
}

const contextualDefaults: Record<string, ContextualRelatedRecordType[]> = {
  lead: ['opportunity', 'sale', 'activity'],
  opportunity: ['lead', 'sale', 'client'],
  sale: ['opportunity', 'lead', 'client'],
  client: ['serviceRequest', 'project', 'workItem', 'invoice'],
  serviceRequest: ['client', 'workItem', 'estimate', 'invoice'],
  project: ['client', 'workItem', 'invoice'],
  task: ['serviceRequest', 'project', 'assignee', 'checklist'],
  workItem: ['serviceRequest', 'project', 'assignee', 'checklist'],
}

export function getContextualRelatedRecords({
  module,
  records,
}: {
  module: keyof typeof contextualDefaults
  records: ContextualRelatedRecord[]
}) {
  const preferredTypes = contextualDefaults[module]
  const recordsByType = new Map<
    ContextualRelatedRecordType,
    ContextualRelatedRecord[]
  >()

  for (const record of records) {
    const nextRecords = recordsByType.get(record.type) ?? []
    nextRecords.push(record)
    recordsByType.set(record.type, nextRecords)
  }

  const compactRecords = preferredTypes.flatMap(
    (type) => recordsByType.get(type) ?? [],
  )
  const compactIds = new Set(compactRecords.map((record) => record.id))
  const explorerRecords = records.filter((record) => !compactIds.has(record.id))

  return {
    compactRecords,
    explorerRecords,
    allRecords: [...compactRecords, ...explorerRecords],
  }
}

export function getExistingRelationshipTypes(
  records: ContextualRelatedRecord[],
) {
  return Array.from(new Set(records.map((record) => record.type)))
}
