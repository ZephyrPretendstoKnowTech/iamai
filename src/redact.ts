// Shared identifier redaction (CLAUDE.md: never commit tenant-derived data;
// docs/design/diagnostics.md: every log line and diagnostic artifact obeys
// this). Pure: no DOM, no network. Placeholders are stable within one text so
// correlations survive redaction. `keep` names GUIDs that are vendor constants
// rather than tenant data (lower case), which a runbook needs as they are.

/**
 * A sign-in address. Before the @, every character Entra allows in a sign-in
 * name (A-Z a-z 0-9 ' . - _ ! # ^ ~; '#' also carries a guest's #EXT#,
 * jane_contoso.com#EXT#@tenant…, F-195), and the '+' and '%' a guest's own email
 * keeps. A character missing here ended the match early and left the start of
 * the address in a "masked" file ('john!smith' came out 'john!upn-1', security
 * audit, 2026-09-29). The other characters RFC 5322 allows (/ = ? & * | { } ` $)
 * are not Entra's, and they are what separates an address from a key, a path or
 * another address ('upn=', '/users/', 'a@x.com/b@x.com'): taken in, they went
 * into the placeholder and gave one address a placeholder per prefix (security
 * review, 2026-09-29). So they end the address.
 */
const ADDRESS = /[A-Za-z0-9.!#%'+^_~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

/**
 * How long the run of characters that opens a matched address is, where the
 * text closes that run right after it: '…', __…__. Those characters may stand
 * in a sign-in name, so the match takes them; closed right after the address,
 * they are the text's wrapping, kept outside the placeholder, so the address has
 * one placeholder however it is wrapped.
 */
function wrapperLength(match: string, after: string): number {
  const lead = /^[^A-Za-z0-9@]*/.exec(match)![0]
  for (let n = lead.length; n > 0; n--) {
    const close = [...lead.slice(0, n)].reverse().join('')
    if (after.startsWith(close)) return n
  }
  return 0
}

export function redactIdentifiers(text: string, keep: ReadonlySet<string> = new Set()): string {
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
    .replace(ADDRESS, (m: string, offset: number, source: string) => {
      const n = wrapperLength(m, source.slice(offset + m.length))
      return m.slice(0, n) + sub(m.slice(n), () => `upn-${++upns}@redacted`)
    })
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, (m) =>
      keep.has(m.toLowerCase()) ? m : sub(m, () => `guid-${String(++guids).padStart(4, '0')}`),
    )
}
