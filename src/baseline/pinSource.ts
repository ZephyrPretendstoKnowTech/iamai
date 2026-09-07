// The source→pin sanitisation boundary (baseline-onboarding §2 stage 2), lifted out
// of scripts/pin-baseline.ts so it is testable without the network. `pin-baseline`
// fetches the author's export and classifies their object GUIDs; this module turns
// one classified source policy into the pinned policy IAMAI ships.
//
// Task 020: the application-exclusion rule below decides whether an authored
// exclusion is portable. It asks `isFirstPartyApplicationId` — the same authority
// `src/baseline/references.ts` uses for reference portability and the `app-01`
// validator uses for its finding — so pinning and runtime cannot disagree about
// whether an application id is a stable Microsoft one. A registry gap here silently
// broadens the author's policy, which is what it did to the Admin Portal source.
import type { CaPolicy } from './types.ts'
import { isFirstPartyApplicationId } from './references.ts'

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PinnedPolicy = {
  id: string | null
  displayName: string
  state: string | null
  conditions: unknown
  grantControls: unknown
  sessionControls: unknown
  placeholders: Record<string, string>
}

const s = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/**
 * Whether an authored application reference survives pinning. A non-GUID token is a
 * Graph keyword or a named placeholder and is the author's own wording, so it is kept
 * as written; a GUID is kept only when it is a Microsoft first-party application id,
 * which is the same in every tenant. An unknown GUID is the author's own registration
 * or a tenant service principal and cannot be carried to somebody else's tenant.
 *
 * This is a property of the identifier, not of the array it sits in: the include and
 * exclude sides classify the same id the same way.
 */
export function retainsApplicationReference(id: string): boolean {
  return !GUID.test(id) || isFirstPartyApplicationId(id)
}

/** Turn one classified source policy into the pinned policy, recording what it dropped. */
export function pinPolicy(p: CaPolicy, placeholderFor: Map<string, string>): { policy: PinnedPolicy; stripped: string[] } {
  const placeholders: Record<string, string> = {}
  const note = (id?: string | null): void => {
    if (typeof id === 'string' && placeholderFor.has(id.toLowerCase())) placeholders[id] = placeholderFor.get(id.toLowerCase())!
  }
  const u = p.conditions?.users
  for (const g of [...s(u?.includeGroups), ...s(u?.excludeGroups)]) note(g)
  for (const l of [...s(p.conditions?.locations?.includeLocations), ...s(p.conditions?.locations?.excludeLocations)]) note(l)
  note(p.grantControls?.authenticationStrength?.id)
  // Strip author-specific app exclusions: an excluded application id that is not a
  // Microsoft first-party id is the author's own app (§2 stage 2, validator app-01).
  const stripped: string[] = []
  const exApps = s(p.conditions?.applications?.excludeApplications)
  const keptApps = exApps.filter((a) => {
    const keep = retainsApplicationReference(a)
    if (!keep) stripped.push(a)
    return keep
  })
  const conditions = JSON.parse(JSON.stringify(p.conditions))
  if (conditions.applications && exApps.length !== keptApps.length) conditions.applications.excludeApplications = keptApps
  return {
    policy: {
      id: p.id ?? null,
      displayName: p.displayName,
      state: p.state ?? null,
      conditions,
      grantControls: p.grantControls ?? null,
      sessionControls: p.sessionControls ?? null,
      placeholders,
    },
    stripped: stripped.map((a) => `${p.displayName}: ${a}`),
  }
}
