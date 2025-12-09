/** ========================================================================
 *  SKILLIFY — Semantic Release Config (Full Suite)
 *  - Conventional commits drive versions
 *  - CHANGELOG.md auto-updated
 *  - package.json version bumped
 *  - GitHub Releases created
 * ======================================================================= */

module.exports = {
  branches: ['main'],

  plugins: [
    // 1. Analyze commit messages to decide version bump
    '@semantic-release/commit-analyzer',

    // 2. Generate release notes from commits
    '@semantic-release/release-notes-generator',

    // 3. Update CHANGELOG.md
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],

    // 4. Commit CHANGELOG + package.json back to the repo
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message:
          'chore(release): ${nextRelease.version}\n\n${nextRelease.notes}',
      },
    ],

    // 5. Create a GitHub Release + attach notes
    '@semantic-release/github',
  ],
}
