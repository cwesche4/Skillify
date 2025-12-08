export function formatNumber(num: number) {
  return Intl.NumberFormat('en-US').format(num)
}
