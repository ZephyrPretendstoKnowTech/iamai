// The three sections a plan cannot be built without: the Conditional Access
// policies, the people, and the sign-in records. A scan that could not read one
// of them ends with gaps: Connect lists them with the roles that read them, no
// plan is built or stored, and the last good plan and its record stay as they
// were. A section a licence withholds (sign-in records without Entra ID P1) is
// not a gap: there was nothing to read, and the plan says so where it matters.
// Pure; the runner (ui/scan/useScanRunner.ts) decides from it.
import { isLicenceGate, rolesForSource } from './roles.ts'
import type { TenantSnapshot } from './types.ts'

export const CORE_SOURCES = ['config:caPolicies', 'users', 'signInEvidence'] as const
export type CoreSource = (typeof CORE_SOURCES)[number]

export type CoreGap = {
  source: CoreSource
  /** Graph's reason, or null when the scan lacks the section altogether. */
  reason: string | null
  /** The least-privileged roles that read the section, from the registry. */
  roles: string[]
}

const READ = new Set(['ok', 'partial'])

function stateOf(snapshot: TenantSnapshot, source: CoreSource): { status: string; reason: string | null } | null {
  if (source === 'config:caPolicies') {
    const s = snapshot.config?.caPolicies
    return s ? { status: s.status, reason: s.reason } : null
  }
  const s = snapshot.sources?.[source]
  return s ? { status: s.status, reason: s.reason } : null
}

/** The core sections the scan could not read, in registry order; empty when the scan can build a plan. */
export function coreGaps(snapshot: TenantSnapshot): CoreGap[] {
  const gaps: CoreGap[] = []
  for (const source of CORE_SOURCES) {
    const s = stateOf(snapshot, source)
    if (s && READ.has(s.status)) continue
    if (s && s.status === 'disabled' && isLicenceGate(s.reason)) continue
    gaps.push({ source, reason: s?.reason ?? null, roles: rolesForSource(source).least })
  }
  return gaps
}
