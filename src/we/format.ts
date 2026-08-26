// Display-time formatting. Epoch millis are stored timezone-agnostic;
// Intl resolves the viewer's zone/locale at render time.

const abbreviator = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** "Aug 26, 2026, 2:05 PM" — abbreviated date + short time (Swift .formatted(date: .abbreviated, time: .shortened)). */
export const formatTimestamp = (epochMs: number): string => abbreviator.format(new Date(epochMs))

const timeOnly = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** "9:41 AM" — Swift .formatted(date: .omitted, time: .shortened). */
export const formatTimeOnly = (epochMs: number): string => timeOnly.format(new Date(epochMs))

/** Fixed CSV timestamp: "dd-MM-yyyy HH:mm:ss" — matches CSVGenerator.displayDate exactly. */
export const formatCsvDate = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** "1h 5m 30s" / "42s" — DateComponentsFormatter abbreviated hour/min/sec. */
export const formatDurationHms = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: Array<string> = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)
  return parts.join(' ')
}

/** "1h 5m" — DateComponentsFormatter abbreviated hour/minute only. */
export const formatDurationHm = (ms: number): string => {
  const minutes = Math.floor(Math.max(0, ms) / 60000)
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  if (hours === 0 && rem === 0) return '0m'
  return [hours > 0 ? `${hours}h` : null, rem > 0 || hours === 0 ? `${rem}m` : null]
    .filter(x => x !== null)
    .join(' ')
}

/** Live clock text: "05:42" under an hour, else "1:03:27". */
export const formatClock = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}
