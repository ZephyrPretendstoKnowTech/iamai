// §10.5 of docs/design/collection.md — Authenticator platform derivation and
// tenant version baseline. Pure: no DOM, no network.

export type DerivedPlatform = 'ios' | 'android' | 'unknown'
export type PlatformSource = 'deviceTag' | 'version' | 'displayName' | 'none'

const IOS_NAME = /iphone|ipad|\bios\b/i
const ANDROID_NAME = /android|pixel|galaxy|samsung|\bsm-|oneplus|xiaomi|motorola/i

// Order: deviceTag when it identifies an OS; else the version numbering scheme
// (Android Authenticator uses date-based minors like 6.2506.x, iOS small
// minors like 6.8.x); else displayName keywords; else unknown.
export function deriveAuthenticatorPlatform(m: {
  deviceTag?: string
  phoneAppVersion?: string
  displayName?: string
}): { platform: DerivedPlatform; from: PlatformSource } {
  if (m.deviceTag && /android/i.test(m.deviceTag)) return { platform: 'android', from: 'deviceTag' }
  if (m.deviceTag && /ios|iphone|ipad/i.test(m.deviceTag)) return { platform: 'ios', from: 'deviceTag' }
  if (m.phoneAppVersion) {
    const minor = Number(m.phoneAppVersion.split('.')[1])
    if (Number.isFinite(minor)) return { platform: minor >= 1000 ? 'android' : 'ios', from: 'version' }
  }
  const name = m.displayName ?? ''
  if (IOS_NAME.test(name)) return { platform: 'ios', from: 'displayName' }
  if (ANDROID_NAME.test(name)) return { platform: 'android', from: 'displayName' }
  return { platform: 'unknown', from: 'none' }
}

function parseVersion(v: string): number[] {
  return v.split('.').map((s) => Number(s) || 0)
}

function newerVersion(a: string, b: string): boolean {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

// Scheme-aware version lag. The Android Authenticator line uses date-based
// minors (6.YYMM.build) — lag is months between the YYMM values, correct
// across year boundaries. The iOS line (6.8.x) increments the third segment —
// lag is the difference there; a minor bump on that line is rare and counts
// as stale outright. A lower major is always stale; mixed schemes are
// incomparable (null).
export function releasesBehind(seen: string, newest: string): number | null {
  const ps = parseVersion(seen)
  const pn = parseVersion(newest)
  if (ps.length < 2 || pn.length < 2) return null
  if (ps[0] < pn[0]) return Infinity
  if (ps[0] > pn[0]) return 0
  const isDateScheme = (minor: number) => minor >= 1000
  if (isDateScheme(ps[1]) !== isDateScheme(pn[1])) return null
  if (isDateScheme(ps[1])) {
    const months = (minor: number) => Math.floor(minor / 100) * 12 + (minor % 100)
    return Math.max(0, months(pn[1]) - months(ps[1]))
  }
  if (ps[1] < pn[1]) return Infinity
  if (ps[1] > pn[1]) return 0
  return Math.max(0, (pn[2] ?? 0) - (ps[2] ?? 0))
}

// Max observed version per derived platform; a platform with a single
// observed device has no baseline (§10.5).
export function computeAuthenticatorBaseline(
  methods: { platform?: string; phoneAppVersion?: string }[],
): Record<string, string> {
  const byPlatform = new Map<string, string[]>()
  for (const m of methods) {
    if (!m.platform || m.platform === 'unknown' || !m.phoneAppVersion) continue
    const list = byPlatform.get(m.platform) ?? []
    list.push(m.phoneAppVersion)
    byPlatform.set(m.platform, list)
  }
  const out: Record<string, string> = {}
  for (const [platform, versions] of byPlatform) {
    if (versions.length < 2) continue
    out[platform] = versions.reduce((max, v) => (newerVersion(v, max) ? v : max))
  }
  return out
}
