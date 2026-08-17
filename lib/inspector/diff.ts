export type InspectorDiff<T = any> = {
  before: T
  after: T
  summary?: string
}
