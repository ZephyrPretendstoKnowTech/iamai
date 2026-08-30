// Redaction that knows what a tenant looks like.
//
// `redactIdentifiers` (src/redact.ts) matches two shapes — UPN-shaped strings
// and GUIDs — which is everything an identifier looks like and almost nothing a
// tenant is actually named. The audit found the consequence in the artifact the
// product presents as the safe one: the "redacted" grounding bundle still
// carried Conditional Access policy names, Entra group names, departments and
// named-location CIDRs, because the only structural substitution it had was
// built from `snapshot.users` (audit redact-02, redact-03, redact-07).
//
// So this builds the vocabulary from the snapshot itself. Every display name
// the tenant contains becomes a placeholder that says what class of thing it
// was, because a redacted sentence still has to be readable: "excluded by the
// group [a group]" is useful, "excluded by the group [redacted]" is not.
//
// Structure-aware where the structure is known. The audit's specific complaint
// about key-name matching was that it misses fields in nested positions, so the
// substitution runs over *values wherever they appear* — the vocabulary is
// gathered by walking the snapshot's known shape, and applied to any string
// anywhere in the artifact, at any depth, including inside prose.
import type { TenantSnapshot } from './graph/collect/types.ts'
import { redactIdentifiers } from './redact.ts'

/** What a redacted value is replaced with, by what it was. */
export type Vocabulary = Map<string, string>

const CLASS_LABEL = {
  user: 'a person',
  group: 'a group',
  policy: 'a policy',
  location: 'a named location',
  device: 'a device',
  role: 'a role',
  app: 'an application',
  department: 'a department',
  jobTitle: 'a job title',
  office: 'an office',
  organisation: 'the organisation',
  domain: 'a domain',
  network: 'a network range',
} as const
export type NameClass = keyof typeof CLASS_LABEL

/**
 * Too short to substitute safely. A two-letter group name would rewrite every
 * occurrence of those letters inside unrelated words, which corrupts the
 * artifact without protecting anything — the identifier regexes already cover
 * anything short and genuinely identifying.
 */
const MIN_LENGTH = 4

const rows = (snapshot: TenantSnapshot, key: string): Record<string, unknown>[] => {
  const section = (snapshot.config as Record<string, { rows?: unknown[] } | undefined>)[key]
  return ((section?.rows ?? []) as Record<string, unknown>[]).filter((r) => r && typeof r === 'object')
}

const add = (v: Vocabulary, counts: Map<NameClass, number>, cls: NameClass, raw: unknown): void => {
  if (typeof raw !== 'string') return
  const value = raw.trim()
  if (value.length < MIN_LENGTH) return
  const key = value.toLowerCase()
  if (v.has(key)) return
  const n = (counts.get(cls) ?? 0) + 1
  counts.set(cls, n)
  v.set(key, `[${CLASS_LABEL[cls]} ${n}]`)
}

/**
 * Every name in the tenant, longest first.
 *
 * Order matters and it is not cosmetic: replacing "Sales" before "Sales
 * Managers" leaves "[a group 1] Managers" behind, which both corrupts the text
 * and leaks the part that was not matched. Longest-first makes the most
 * specific name win (audit redact-10).
 */
export function tenantVocabulary(snapshot: TenantSnapshot): Vocabulary {
  const v: Vocabulary = new Map()
  const counts = new Map<NameClass, number>()

  for (const u of snapshot.users ?? []) {
    add(v, counts, 'user', u.displayName)
    add(v, counts, 'user', u.userPrincipalName)
    add(v, counts, 'department', u.department)
    add(v, counts, 'jobTitle', u.jobTitle)
    add(v, counts, 'office', u.officeLocation)
  }
  for (const d of snapshot.devices ?? []) add(v, counts, 'device', d.displayName)

  for (const p of rows(snapshot, 'caPolicies')) add(v, counts, 'policy', p.displayName)
  for (const g of rows(snapshot, 'groups')) add(v, counts, 'group', g.displayName)
  for (const r of rows(snapshot, 'roleDefinitions')) add(v, counts, 'role', r.displayName)
  for (const a of rows(snapshot, 'applications')) add(v, counts, 'app', a.displayName)
  for (const a of snapshot.appSignInSummary ?? []) add(v, counts, 'app', (a as Record<string, unknown>).appDisplayName)

  for (const l of rows(snapshot, 'namedLocations')) {
    add(v, counts, 'location', l.displayName)
    // A CIDR is as identifying as a name — it is the office's public address —
    // and it is nested two levels down, which is exactly the shape key-name
    // matching missed.
    for (const range of (l.ipRanges ?? []) as Record<string, unknown>[]) {
      add(v, counts, 'network', range?.cidrAddress)
    }
  }

  for (const o of rows(snapshot, 'organization')) {
    add(v, counts, 'organisation', o.displayName)
    for (const d of (o.verifiedDomains ?? []) as Record<string, unknown>[]) add(v, counts, 'domain', d?.name)
  }

  return new Map([...v.entries()].sort((a, b) => b[0].length - a[0].length))
}

/** Replace every known name in a string, then the identifier shapes. */
export function redactText(text: string, vocabulary: Vocabulary): string {
  let out = text
  for (const [name, placeholder] of vocabulary) {
    // Case-insensitive: Graph returns the casing whoever typed it used, and the
    // same name reaches different artifacts through different code paths
    // (audit redact-10).
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, (m) => `\\${m}`)
    out = out.replace(new RegExp(escaped, 'gi'), placeholder)
  }
  return redactIdentifiers(out)
}

/**
 * Redact anything: a string, an array, an object, at any depth. Keys are
 * rewritten too, because a group name can be an object key (member maps are
 * keyed by id, but display-name-keyed maps exist in generated artifacts).
 */
export function redactDeep<T>(value: T, vocabulary: Vocabulary): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return redactText(v, vocabulary)
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
        out[redactText(k, vocabulary)] = walk(val)
      }
      return out
    }
    return v
  }
  return walk(value) as T
}
