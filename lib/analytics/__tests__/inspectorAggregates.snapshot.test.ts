import { describe, expect, it } from 'vitest'

import {
  getInspectorAIEventCounts,
  getInspectorAIHeatmap,
  getInspectorAISuggestionRates,
  getInspectorPresetHeatmap,
  getInspectorPresetUsage,
  getInspectorTabHeatmap,
  getInspectorTabUsage,
  getInspectorValidationFrequency,
  getInspectorValidationHeatmap,
} from '../inspectorAggregates'
import { inspectorTelemetryEntries } from './fixtures/inspectorTelemetry.fixture'

const sortEntries = <T>(entries: [string, T][]) =>
  [...entries].sort((a, b) => a[0].localeCompare(b[0]))

const sortHeatmap = (points: Array<Record<string, any>>) => {
  const key = (p: any) =>
    `${p.workspaceId ?? ''}|${p.nodeType ?? ''}|${p.tab ?? ''}|${p.event ?? ''}|${p.bucket ?? ''}`
  return [...points].sort((a, b) => key(a).localeCompare(key(b)))
}

describe('inspectorAggregates', () => {
  it('getInspectorTabUsage snapshot', () => {
    const baseline = [...inspectorTelemetryEntries]
    const result = getInspectorTabUsage(inspectorTelemetryEntries)
    expect(inspectorTelemetryEntries).toEqual(baseline)
    expect(sortEntries(Array.from(result.entries()))).toMatchSnapshot()

    const result2 = getInspectorTabUsage(inspectorTelemetryEntries)
    expect(result2).not.toBe(result)
    expect(sortEntries(Array.from(result2.entries()))).toMatchSnapshot()
  })

  it('getInspectorValidationFrequency snapshot', () => {
    const baseline = [...inspectorTelemetryEntries]
    const result = getInspectorValidationFrequency(inspectorTelemetryEntries)
    expect(inspectorTelemetryEntries).toEqual(baseline)
    expect(sortEntries(Array.from(result.entries()))).toMatchSnapshot()

    const result2 = getInspectorValidationFrequency(inspectorTelemetryEntries)
    expect(result2).not.toBe(result)
    expect(sortEntries(Array.from(result2.entries()))).toMatchSnapshot()
  })

  it('getInspectorAISuggestionRates snapshot', () => {
    const baseline = [...inspectorTelemetryEntries]
    const result = getInspectorAISuggestionRates(inspectorTelemetryEntries)
    expect(inspectorTelemetryEntries).toEqual(baseline)
    expect(sortEntries(Array.from(result.entries()))).toMatchSnapshot()

    const result2 = getInspectorAISuggestionRates(inspectorTelemetryEntries)
    expect(result2).not.toBe(result)
    expect(sortEntries(Array.from(result2.entries()))).toMatchSnapshot()
  })

  it('getInspectorPresetUsage snapshot', () => {
    const baseline = [...inspectorTelemetryEntries]
    const result = getInspectorPresetUsage(inspectorTelemetryEntries)
    expect(inspectorTelemetryEntries).toEqual(baseline)
    expect(sortEntries(Array.from(result.entries()))).toMatchSnapshot()

    const result2 = getInspectorPresetUsage(inspectorTelemetryEntries)
    expect(result2).not.toBe(result)
    expect(sortEntries(Array.from(result2.entries()))).toMatchSnapshot()
  })

  it('getInspectorAIEventCounts snapshot', () => {
    const baseline = [...inspectorTelemetryEntries]
    const result = getInspectorAIEventCounts(inspectorTelemetryEntries)
    expect(inspectorTelemetryEntries).toEqual(baseline)
    const sorted = [...result].sort((a, b) => a.key.localeCompare(b.key))
    expect(sorted).toMatchSnapshot()

    const result2 = getInspectorAIEventCounts(inspectorTelemetryEntries)
    const sorted2 = [...result2].sort((a, b) => a.key.localeCompare(b.key))
    expect(result2).not.toBe(result)
    expect(sorted2).toMatchSnapshot()
  })

  it('getInspectorTabHeatmap snapshot', () => {
    const baseline = [...inspectorTelemetryEntries]
    const result = getInspectorTabHeatmap(inspectorTelemetryEntries)
    expect(inspectorTelemetryEntries).toEqual(baseline)
    expect(sortHeatmap(result)).toMatchSnapshot()

    const result2 = getInspectorTabHeatmap(inspectorTelemetryEntries)
    expect(result2).not.toBe(result)
    expect(sortHeatmap(result2)).toMatchSnapshot()
  })

  it('getInspectorValidationHeatmap snapshot', () => {
    const baseline = [...inspectorTelemetryEntries]
    const result = getInspectorValidationHeatmap(inspectorTelemetryEntries)
    expect(inspectorTelemetryEntries).toEqual(baseline)
    expect(sortHeatmap(result)).toMatchSnapshot()

    const result2 = getInspectorValidationHeatmap(inspectorTelemetryEntries)
    expect(result2).not.toBe(result)
    expect(sortHeatmap(result2)).toMatchSnapshot()
  })

  it('getInspectorAIHeatmap snapshot', () => {
    const baseline = [...inspectorTelemetryEntries]
    const result = getInspectorAIHeatmap(inspectorTelemetryEntries)
    expect(inspectorTelemetryEntries).toEqual(baseline)
    expect(sortHeatmap(result)).toMatchSnapshot()

    const result2 = getInspectorAIHeatmap(inspectorTelemetryEntries)
    expect(result2).not.toBe(result)
    expect(sortHeatmap(result2)).toMatchSnapshot()
  })

  it('getInspectorPresetHeatmap snapshot', () => {
    const baseline = [...inspectorTelemetryEntries]
    const result = getInspectorPresetHeatmap(inspectorTelemetryEntries)
    expect(inspectorTelemetryEntries).toEqual(baseline)
    expect(sortHeatmap(result)).toMatchSnapshot()

    const result2 = getInspectorPresetHeatmap(inspectorTelemetryEntries)
    expect(result2).not.toBe(result)
    expect(sortHeatmap(result2)).toMatchSnapshot()
  })
})
