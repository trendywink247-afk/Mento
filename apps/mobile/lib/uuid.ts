// UUID v4 wrapper that uses native crypto when available.
// Avoids depending on react-native-get-random-values for the simple client-message-id case.

export function uuid(): string {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID()
  }
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
