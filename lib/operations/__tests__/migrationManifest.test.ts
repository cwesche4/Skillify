import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('release-candidate migration manifest', () => {
  it('matches the exact 45-directory migration chain and SQL checksums', () => {
    const root = process.cwd()
    const migrationsRoot = path.join(root, 'prisma', 'migrations')
    const migrationNames = fs
      .readdirSync(migrationsRoot, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          fs.existsSync(path.join(migrationsRoot, entry.name, 'migration.sql')),
      )
      .map((entry) => entry.name)
      .sort()
    const manifest = fs.readFileSync(
      path.join(
        root,
        'docs',
        'operations',
        'release-candidate-migration-manifest.md',
      ),
      'utf8',
    )
    const manifestEntries = Array.from(
      manifest.matchAll(/^\|\s*`([^`]+)`\s*\|\s*`([a-f0-9]{64})`\s*\|$/gm),
      (match) => ({ name: match[1], checksum: match[2] }),
    )

    expect(migrationNames).toHaveLength(45)
    expect(manifestEntries).toHaveLength(45)
    expect(manifestEntries.map((entry) => entry.name).sort()).toEqual(
      migrationNames,
    )
    for (const entry of manifestEntries) {
      const sql = fs.readFileSync(
        path.join(migrationsRoot, entry.name, 'migration.sql'),
      )
      expect(createHash('sha256').update(sql).digest('hex')).toBe(
        entry.checksum,
      )
    }
    expect(migrationNames.at(-1)).toBe(
      '20261005000000_estimate_decision_workspace_deletion',
    )
    expect(migrationNames.some((name) => name.includes('migration_46'))).toBe(
      false,
    )
  })
})
