// release.config.js
/** @type {import('semantic-release').Options} */
const releaseConfig = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'docs/CHANGELOG.md',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['docs/CHANGELOG.md', 'package.json', 'package-lock.json'],
        message:
          'chore(release): ${nextRelease.version}\n\n${nextRelease.notes}',
      },
    ],
    '@semantic-release/github',
  ],
}

export default releaseConfig