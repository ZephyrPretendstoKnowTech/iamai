// A person whose method list this scan missed, with no registration report row
// for them: the state behind MFA Readiness's Unknown group and behind a readiness
// the scan can only put a floor under ("At least 34%"). The sample tenant reads
// every method list (OWN-B3: its one unread person put "couldn't read" on the
// demo), so the tests that need the state make it here, on the demo's people.
import type { Fixture } from '../roadmap/fixtures/index.ts'
import { readinessView } from '../derive/mfaReadiness.ts'

/** The fixture with one counted person who needs a method read as not read this scan; `id` names them. */
export function withOneMethodListMissed(f: Fixture): Fixture & { missedId: string } {
  const id = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.find((r) => r.state === 'method')?.user.id
  if (!id) throw new Error(`${f.name}: nobody counted needs a method`)
  const snapshot = structuredClone(f.snapshot)
  snapshot.authMethods = { ...snapshot.authMethods, [id]: 'unknown' }
  snapshot.registrationDetails = snapshot.registrationDetails.filter((r) => r.id !== id)
  snapshot.sources = { ...snapshot.sources, authMethods: { ...snapshot.sources.authMethods!, status: 'partial', reason: "1 users' methods unavailable" } }
  return { ...f, snapshot, missedId: id }
}
