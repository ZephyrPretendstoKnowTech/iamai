// The scan summary line's values (Connect, pages.tenant.scanLine): the people,
// the policies, and the sign-in window — or "sign-ins not read" when the records
// were not read, so the line never renders an empty window.
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { monthDay } from '../../copy/dates.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'

export function scanLineVars(snapshot: TenantSnapshot): { people: number; policies: number; signIns: string } {
  const T = pages.tenant as { signIns: string; signInsNotRead: string }
  const w = snapshot.sources.signInEvidence?.coveredWindow ?? null
  return {
    people: snapshot.users.length,
    policies: snapshot.config.caPolicies?.rows.length ?? 0,
    signIns: w ? fillText(T.signIns, { from: monthDay(w.from), to: monthDay(w.to) }) : T.signInsNotRead,
  }
}
