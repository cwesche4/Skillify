export function insertTextAtCursor({
  value,
  insert,
  selectionStart,
  selectionEnd,
}: {
  value: string
  insert: string
  selectionStart?: number | null
  selectionEnd?: number | null
}) {
  const start = Math.max(
    0,
    Math.min(value.length, selectionStart ?? value.length),
  )
  const end = Math.max(start, Math.min(value.length, selectionEnd ?? start))
  const spacerBefore =
    start > 0 && value[start - 1] && !/\s/.test(value[start - 1]) ? ' ' : ''
  const spacerAfter = value[end] && !/\s/.test(value[end]) ? ' ' : ''
  const next = `${value.slice(0, start)}${spacerBefore}${insert}${spacerAfter}${value.slice(end)}`
  const cursor =
    start + spacerBefore.length + insert.length + spacerAfter.length
  return { value: next, cursor }
}
