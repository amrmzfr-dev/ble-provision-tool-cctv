// The camera's QR sticker may encode the bare serial or something wrapped around it
// (e.g. a "SN:" prefix or a URL with the serial as the last path segment). Keep only
// the alphanumeric run so odd formatting doesn't break the match.
export function normalizeSerial(raw: string): string {
  const alnumRuns = raw.toUpperCase().match(/[A-Z0-9]+/g) ?? []
  return alnumRuns.sort((a, b) => b.length - a.length)[0] ?? ''
}

// Advertised name = a 4-character prefix + the serial number (see constants.ts).
// The prefix isn't confirmed yet, so match by "contains" rather than an exact suffix.
export function deviceMatchesSerial(deviceName: string, expectedSerial: string): boolean {
  if (!expectedSerial) return false
  const normalizedName = deviceName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return normalizedName.includes(expectedSerial)
}
