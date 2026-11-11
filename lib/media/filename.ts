/** `clip.mp4` -> `clip_trim.mp4`. Only a trailing extension is dropped, so `a.b.mp4` keeps `a.b`. */
export function trimFileName(name: string): string {
  const dot = name.lastIndexOf('.')
  // dot <= 0: no extension, or a dotfile like ".mp4" where the whole name is the "extension".
  const base = dot > 0 ? name.slice(0, dot) : name
  return `${base.length > 0 ? base : 'clip'}_trim.mp4`
}
