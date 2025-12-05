export type APIResult<T = any> = {
  success: boolean
  data?: T
  message?: string
}
