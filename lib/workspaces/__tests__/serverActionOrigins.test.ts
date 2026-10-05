import { describe, expect, it } from 'vitest'

import { getServerActionAllowedOrigins } from '@/lib/config/serverActionOrigins.mjs'

describe('Server Action origin allowlist', () => {
  it('allows the trusted canonical hostname and intentional local hosts', () => {
    expect(
      getServerActionAllowedOrigins({
        NEXT_PUBLIC_APP_URL: 'https://app.skillify.example/path',
      }),
    ).toEqual([
      'localhost:3000',
      '127.0.0.1:3000',
      '[::1]:3000',
      'app.skillify.example',
    ])
  })

  it('ignores malformed or non-http configuration without broadening access', () => {
    for (const configured of ['*', 'not a url', 'javascript:alert(1)']) {
      const origins = getServerActionAllowedOrigins({
        NEXT_PUBLIC_APP_URL: configured,
      })
      expect(origins).not.toContain('*')
      expect(origins).not.toContain('attacker.example')
      expect(origins).toEqual([
        'localhost:3000',
        '127.0.0.1:3000',
        '[::1]:3000',
      ])
    }
  })

  it('extracts exact HTTP hosts without trusting userinfo, substrings, paths, or queries', () => {
    const local = ['localhost:3000', '127.0.0.1:3000', '[::1]:3000']
    const cases: Array<[string | undefined, string | null]> = [
      [undefined, null],
      ['', null],
      ['https://trusted.example/path?next=attacker.example', 'trusted.example'],
      ['https://trusted.example:8443/path', 'trusted.example:8443'],
      ['https://trusted.example:443/path', 'trusted.example'],
      ['http://trusted.example:80/path', 'trusted.example'],
      ['https://trusted.example@attacker.example', 'attacker.example'],
      [
        'https://trusted.example.attacker.example',
        'trusted.example.attacker.example',
      ],
      ['https://attacker.example/trusted.example', 'attacker.example'],
      ['http://[::1]:4100/path', '[::1]:4100'],
      ['ftp://trusted.example', null],
      ['file:///trusted.example', null],
      ['mailto:owner@trusted.example', null],
      ['https://', null],
    ]

    for (const [configured, expectedHost] of cases) {
      const origins = getServerActionAllowedOrigins({
        NEXT_PUBLIC_APP_URL: configured,
      })
      expect(origins.slice(0, 3)).toEqual(local)
      expect(origins.slice(3)).toEqual(expectedHost ? [expectedHost] : [])
      expect(origins).not.toContain('*')
    }
  })
})
