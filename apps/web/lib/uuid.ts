// Lightweight UUID v4 wrapper that prefers the browser's crypto.randomUUID.
export function v4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback (RFC4122 v4-ish, sufficient for client message ids).
  const r = (n: number) => Math.floor(Math.random() * n)
  const hex = (n: number, len: number) => n.toString(16).padStart(len, '0')
  return [
    hex(r(0x1_0000_0000), 8),
    hex(r(0x1_0000), 4),
    hex(0x4000 | r(0x1000), 4),
    hex(0x8000 | r(0x4000), 4),
    hex(r(0x1_0000), 4) + hex(r(0x1_0000_0000), 8),
  ].join('-')
}
