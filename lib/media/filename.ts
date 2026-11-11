const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * `clip.mp4` at 2026-11-11 14:32:05 local -> `clip_trim_2026-11-11_14-32-05.mp4`.
 * Only a trailing extension is dropped, so `a.b.mp4` keeps `a.b`.
 * The timestamp keeps repeated exports of one source from colliding; no spaces or colons, so it is safe on every filesystem.
 */
export function trimFileName(name: string, now: Date): string {
  const dot = name.lastIndexOf('.')
  // dot <= 0: no extension, or a dotfile like ".mp4" where the whole name is the "extension".
  const base = dot > 0 ? name.slice(0, dot) : name
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  return `${base.length > 0 ? base : 'clip'}_trim_${date}_${time}.mp4`
}
