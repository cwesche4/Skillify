export type PresetSharingStatus = 'draft' | 'active' | 'revoked'

export type SharedPresetRef = {
  id: string
  sourceOrgId: string
  targetOrgId: string
  presetId: string
  presetVersion: number
  status: PresetSharingStatus
  createdAt: string
  updatedAt: string
}

export type PresetSharingModel = {
  references: SharedPresetRef[]
}

export const emptyPresetSharingModel: PresetSharingModel = { references: [] }
