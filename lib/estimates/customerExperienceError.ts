export class EstimateExperienceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 429 | 503,
    readonly code:
      | 'VALIDATION_ERROR'
      | 'NOT_FOUND'
      | 'CONFLICT'
      | 'UNAVAILABLE'
      | 'RATE_LIMITED'
      | 'CONFIGURATION_REQUIRED',
    readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message)
    this.name = 'EstimateExperienceError'
  }
}
