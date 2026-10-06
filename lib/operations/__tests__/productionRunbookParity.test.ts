import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

describe('production worker runbook parity', () => {
  it('lists every scheduled worker and cadence in the opening inventory', () => {
    const root = process.cwd()
    const config = JSON.parse(
      fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'),
    ) as { crons: Array<{ path: string; schedule: string }> }
    const runbook = fs.readFileSync(
      path.join(
        root,
        'docs/operations/simple-automations-production-operations.md',
      ),
      'utf8',
    )
    const openingInventory = runbook.split(
      '## Production environment prerequisites',
    )[0]

    const expectedSchedules = new Map([
      ['/api/internal/domain-events/process', '* * * * *'],
      ['/api/internal/scheduling/notifications', '* * * * *'],
      ['/api/internal/scheduling/notifications/recovery', '*/5 * * * *'],
      ['/api/internal/scheduling/recurrence-horizon', '0 2 * * *'],
      ['/api/internal/estimates/deliveries/process', '* * * * *'],
    ])

    expect(
      config.crons.map(({ path: route, schedule }) => [route, schedule]),
    ).toEqual(Array.from(expectedSchedules))
    for (const route of expectedSchedules.keys()) {
      expect(openingInventory).toContain(route)
    }
    expect(openingInventory).toMatch(/every minute/i)
    expect(openingInventory).toMatch(/every five minutes/i)
    expect(openingInventory).toMatch(/daily at 02:00 UTC/i)
    expect(openingInventory).toMatch(
      /Estimate delivery and\s+follow-up processing/i,
    )
    expect(openingInventory).toMatch(/CRON_SECRET/)
  })
})
