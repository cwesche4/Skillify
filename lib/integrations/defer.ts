export function shouldDeferCRMAction(opts: {
  timeoutMs?: number
  expectedMs?: number
}): boolean {
  const expected = opts.expectedMs ?? 0
  const timeout = opts.timeoutMs ?? Number.MAX_SAFE_INTEGER
  // Conservative: suggest defer only if we expect to exceed 3s OR if configured timeout is very low
  return expected > 3000 || timeout <= 2000
}

export function buildDeferMeta(opts: {
  reason: string
  expectedMs?: number
}): Record<string, any> {
  return {
    deferred: true,
    deferReason: opts.reason,
    expectedMs: opts.expectedMs,
  }
}
