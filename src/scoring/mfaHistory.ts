// The small derived evidence history MFA Readiness keeps across scans (Step 7,
// owner decision). It owns one thing: folding a completed scan into what earlier
// scans established, so readiness can see a qualifying method disappear and keep
// proof older than the sign-in records Microsoft still returns.
//
// What it keeps, per person, and nothing else: the qualifying methods seen (the
// method id where Graph gave one, the class, first and last seen, present now or
// not), the latest qualifying proof per method class and platform family, and
// the platform families seen. No raw sign-in record, no address, no user agent.
// Nothing expires: older proof is shown as older, never as lapsed.
//
// A read that failed changes nothing it could not see. A person whose methods
// were not read keeps their methods as known; sign-in records that could not be
// read add no proof and remove none. Disappearance is only ever the difference
// between two readable inventories. Forget this tenant deletes it with the scan
// it rides in (graph/collect/cache.ts forgetTenant). Pure.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { PLATFORMS, classOfKind, isQualifying, latestProofs } from './phishingResistant.ts'
import type { MethodClass, MfaHistory, PersonHistory, PlatformSeen } from './phishingResistant.ts'

const readable = (s: { status: string } | undefined): boolean => s?.status === 'ok' || s?.status === 'partial'

function latestPlatforms(seen: readonly PlatformSeen[]): PlatformSeen[] {
  const out = new Map<string, string>()
  for (const p of seen) if (!out.has(p.os) || p.at > (out.get(p.os) as string)) out.set(p.os, p.at)
  return PLATFORMS.filter((os) => out.has(os)).map((os) => ({ os, at: out.get(os) as string }))
}

/** A prior history this version can read; anything else starts afresh rather than being guessed at. */
function usable(prior: MfaHistory | null | undefined): MfaHistory | null {
  return prior && prior.schema === 1 && prior.people && typeof prior.people === 'object' ? prior : null
}

export function mergeMfaHistory(prior: MfaHistory | null | undefined, snapshot: TenantSnapshot): MfaHistory {
  const asOf = snapshot.asOf
  const people: Record<string, PersonHistory> = {}
  const directory = new Set(snapshot.users.map((u) => u.id))
  const directoryRead = readable(snapshot.sources.users) && snapshot.users.length > 0
  for (const [id, h] of Object.entries(usable(prior)?.people ?? {})) {
    // An account a directory read in full no longer has is gone; a directory that could not be read removes nobody.
    if (directoryRead && !directory.has(id)) continue
    people[id] = { methods: h.methods.map((m) => ({ ...m })), proofs: [...h.proofs], platforms: [...h.platforms] }
  }
  const into = (id: string): PersonHistory => (people[id] ??= { methods: [], proofs: [], platforms: [] })

  if (readable(snapshot.sources.authMethods)) {
    for (const [id, list] of Object.entries(snapshot.authMethods)) {
      if (!Array.isArray(list)) continue
      const held = list.flatMap((m) => {
        const cls = classOfKind(m.kind)
        return cls && isQualifying(cls) ? [{ key: m.id ?? `${cls}:${m.createdDateTime ?? ''}`, cls: cls as MethodClass }] : []
      })
      if (held.length === 0 && !people[id]) continue
      const h = into(id)
      const keys = new Set(held.map((m) => m.key))
      for (const m of held) {
        const known = h.methods.find((x) => x.key === m.key)
        if (known) Object.assign(known, { lastSeen: asOf, present: true })
        else h.methods.push({ key: m.key, cls: m.cls, firstSeen: asOf, lastSeen: asOf, present: true })
      }
      for (const m of h.methods) if (!keys.has(m.key)) m.present = false
    }
  }

  if (readable(snapshot.sources.signInEvidence)) {
    for (const [id, e] of Object.entries(snapshot.signInEvidence)) {
      const proofs = (e.proofs ?? []).filter((p) => isQualifying(p.cls))
      const platforms = e.platforms ?? []
      if (proofs.length === 0 && platforms.length === 0) continue
      const h = into(id)
      h.proofs = latestProofs([...h.proofs, ...proofs])
      h.platforms = latestPlatforms([...h.platforms, ...platforms])
    }
  }

  return { schema: 1, asOf, people }
}
