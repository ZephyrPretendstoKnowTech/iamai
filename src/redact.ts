// Shared identifier redaction (CLAUDE.md: never commit tenant-derived data;
// docs/design/diagnostics.md: every log line and diagnostic artifact obeys
// this). Pure: no DOM, no network. Placeholders are stable within one text so
// correlations survive redaction.
export function redactIdentifiers(text: string): string {
  const seen = new Map<string, string>()
  let upns = 0
  let guids = 0
  const sub = (raw: string, make: () => string): string => {
    const key = raw.toLowerCase()
    let v = seen.get(key)
    if (!v) {
      v = make()
      seen.set(key, v)
    }
    return v
  }
  return text
    .replace(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => sub(m, () => `upn-${++upns}@redacted`))
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, (m) =>
      sub(m, () => `guid-${String(++guids).padStart(4, '0')}`),
    )
}

// SHA-256 hex of a tenant id for diagnostics (works in window and worker).
export async function hashTenantId(tenantId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tenantId))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
