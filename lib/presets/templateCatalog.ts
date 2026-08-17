export type PresetTemplate = {
  id: string
  name: string
  description?: string
  presetId: string
  version: string
  source: 'org' | 'marketplace'
}

export type PresetTemplateCatalog = {
  templates: PresetTemplate[]
}

export const emptyPresetTemplateCatalog: PresetTemplateCatalog = {
  templates: [],
}
