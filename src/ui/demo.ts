// Demo mode (prompt 45 Part 1).
//
// The tool asks a stranger to connect a production tenant before it has shown
// them anything, which is the largest single obstacle to somebody trying it or
// sharing it. Demo mode removes that: the whole flow, with no sign-in and no
// Graph call.
//
// It runs the real code paths over the `demo` fixture (prompt 50 item 9), built
// to show the finished product, so what a visitor sees is what the tool actually
// does, not a screenshot that drifts. It changes the tenant id, and shifts every
// date so the sample reads as of the day it is viewed.
import { fixture } from '../roadmap/fixtures/index.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { GroupMembers } from '../coverage/population.ts'
import type { StepDecision } from '../roadmap/decisions.ts'
import { planIdFor } from '../roadmap/generate.ts'
// The demo's switches and its tenant id live in demoMode.ts, which is light;
// this module carries the fixture and the engine, and loads only on demand.
// The tenant id is not a GUID, and not the fixture's own generated one,
// because every store in this app keys on the tenant id: IndexedDB scans,
// plans, mapping state and the baseline. A demo that reused a GUID-shaped id
// could collide with a real tenant's saved data, and "Forget this tenant" would
// then be ambiguous about which one it forgot.
import { DEMO_TENANT_ID } from './demoMode.ts'

export type DemoTenant = { snapshot: TenantSnapshot; mapping: MappingState; baseline: ReturnType<typeof fixture>['baseline']; operatorId: string; groups: GroupMembers; decisions: Record<string, StepDecision> | null; checkpoints: unknown[] | null }

/**
 * Shift every ISO date in a value by `offsetMs`, so the fixture reads as of now.
 *
 * A day is a date too. Sign-in records are bucketed by UTC day where what is
 * asked of them is which window they fall in (collect/types.ts
 * `reportOnlyDated`), and a day left behind while the instants around it moved
 * puts the demo's records outside the window its own policy is being watched
 * over — the readiness gate then reads the sample tenant as having no evidence
 * at all.
 */
function shiftDates<T>(value: T, offsetMs: number): T {
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return new Date(Date.parse(value) + offsetMs).toISOString() as unknown as T
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(Date.parse(`${value}T00:00:00.000Z`) + offsetMs).toISOString().slice(0, 10) as unknown as T
    return value as unknown as T
  }
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, offsetMs)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = shiftDates(v, offsetMs)
    return out as unknown as T
  }
  return value
}

/**
 * The sample tenant, with its ids rewritten so nothing it writes can land on a
 * real tenant's keys, and every date shifted so it reads as of the day it is
 * viewed (prompt 50 item 9): the `demo` fixture is built at a fixed instant for
 * the property tests, and shifted here. `week2` advances to the tracking view.
 * Its baseline is the product's pinned one (walk-51 item 9), so the demo plan
 * holds exactly the goals the pinned goal map holds.
 */
export function demoTenant(week2 = false): DemoTenant {
  const f = fixture(week2 ? 'demo-week2' : 'demo')
  const offset = Date.now() - Date.parse(f.snapshot.asOf)
  // The policies the plan created carry the plan's tag (generate.ts). The app's
  // plan id follows planIdFor over the tenant id, and the tenant id is rewritten
  // here, so the tags are rewritten with it; otherwise week two's report-only
  // policies never match their steps on screen.
  const retag = (v: unknown): unknown => (typeof v === 'string' ? v.replaceAll(`[IAMAI:${f.planId}:`, `[IAMAI:${planIdFor(DEMO_TENANT_ID)}:`) : v)
  const caPolicies = f.snapshot.config.caPolicies
  const rows = (caPolicies?.rows ?? []).map((p) => ({ ...(p as Record<string, unknown>), description: retag((p as { description?: unknown }).description) }))
  const snapshot = shiftDates({ ...f.snapshot, tenantId: DEMO_TENANT_ID, config: { ...f.snapshot.config, caPolicies: { ...caPolicies, rows } } }, offset)
  const mapping = { ...f.mapping, tenantId: DEMO_TENANT_ID }
  // The group members carry no dates, so they travel unshifted; they are what
  // lets coverage resolve each policy's exclusions (prompt 50.1 item 5).
  // Week two's decisions (the technician's answers from week one) are dated with the snapshot.
  const decisions = f.decisions ? shiftDates(f.decisions, offset) : null
  // Week two's checkpoints (the drill the technician recorded, E3) shift with the sign-ins they match.
  const checkpoints = f.checkpoints ? shiftDates(f.checkpoints, offset) : null
  return { snapshot, mapping, baseline: f.baseline, operatorId: f.operatorId, groups: f.groups, decisions, checkpoints }
}

// ---------------------------------------------------------------------------
// The two snapshots' plan records (task 026 correction)
// ---------------------------------------------------------------------------
//
// A plan record holds the operator's inputs and the one thing a scan cannot
// work out for itself: what the last scan saw of each policy (observations).
// The app stores one per tenant, and the sample is one tenant read twice, so
// when the visitor selected the initial scan again the follow-up scan's seeded
// decisions, its checkpoints and its observations were still in that record and
// the initial plan rendered over week two's inputs — a hybrid neither snapshot
// ever was.
//
// So the demo keeps a record per snapshot and the tenant's record is a copy of
// the selected one. Selecting a snapshot restores that snapshot's own record;
// the fixture's seed is written once, when a snapshot is first entered, so a
// visitor's edits are theirs from then on and no seed comes back over them.
// Going forward for the first time (Scan again, day one to week two) carries
// the visitor's record with it, because that is what a re-scan of one tenant
// does: the plan does not restart because the tool looked again.

export type DemoSnapshotKey = 'initial' | 'followUp'
/** A stored plan record, in whatever shape it was written (roadmap/decisions.ts owns the shape). */
export type DemoPlanRecord = Record<string, unknown> & { stepDecisions?: Record<string, unknown>; checkpoints?: unknown[] }
/** The demo's own row: a record per snapshot, and which one the tenant's record is a copy of. */
export type DemoSnapshotState = { current: DemoSnapshotKey; records: Partial<Record<DemoSnapshotKey, DemoPlanRecord>> }
/** What the fixture supplies for a snapshot: its technician's answers and the checkpoints they recorded. */
export type DemoSeed = { decisions: Record<string, StepDecision> | null; checkpoints: unknown[] | null }

export function demoSnapshotKey(followUp: boolean): DemoSnapshotKey {
  return followUp ? 'followUp' : 'initial'
}

/** The stored row carries its store key; a copy held inside the demo's row must not. */
function withoutTenantId(rec: DemoPlanRecord): DemoPlanRecord {
  const out = { ...rec }
  delete out.tenantId
  return out
}

/**
 * The fixture's seed, under whatever the record already says: a decision the
 * visitor saved themselves wins over the sample technician's, and a checkpoint
 * the record already holds is not recorded twice.
 */
function seedInto(rec: DemoPlanRecord, seed: DemoSeed): DemoPlanRecord {
  const have = new Set((rec.checkpoints ?? []).map((c) => JSON.stringify(c)))
  const added = (seed.checkpoints ?? []).filter((c) => !have.has(JSON.stringify(c)))
  return { ...rec, stepDecisions: { ...(seed.decisions ?? {}), ...(rec.stepDecisions ?? {}) }, checkpoints: [...(rec.checkpoints ?? []), ...added] }
}

/**
 * Which plan record the sample tenant should hold for the snapshot being shown,
 * and the demo's row to store beside it. Pure: App.tsx reads the two rows,
 * calls this, and writes the two back.
 *
 * `live` with no `stored` row is a record written before this rule existed (or
 * by a build that had none): it cannot be said which snapshot it belongs to, so
 * it is not carried into one. The sample re-seeds and the visitor's first
 * selection is the sample as its author built it.
 */
export function nextDemoRecord(args: { want: DemoSnapshotKey; stored: DemoSnapshotState | null; live: DemoPlanRecord | null; seed: DemoSeed }): { record: DemoPlanRecord; state: DemoSnapshotState } {
  const { want, stored, live, seed } = args
  const records: Partial<Record<DemoSnapshotKey, DemoPlanRecord>> = { ...(stored?.records ?? {}) }
  const from = stored?.current ?? null
  // The record on screen belongs to the snapshot it was selected for; put it away under that one.
  if (from && live) records[from] = withoutTenantId(live)
  const kept = records[want]
  // Day one to week two, the first time: the same tenant, scanned again.
  const carried = from === 'initial' && want === 'followUp' && live ? withoutTenantId(live) : null
  const record = kept ?? seedInto(carried ?? { planId: planIdFor(DEMO_TENANT_ID), skips: {}, checkpoints: [] }, seed)
  records[want] = record
  return { record, state: { current: want, records } }
}
