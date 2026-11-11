/** Formats seconds as `m:ss.t`, rounded to tenths first so 59.96 becomes 1:00.0, not 0:60.0. */
export function formatDuration(sec: number): string {
  const tenths = Math.round(Math.max(0, sec) * 10)
  const minutes = Math.floor(tenths / 600)
  const rest = (tenths % 600) / 10
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`
}
