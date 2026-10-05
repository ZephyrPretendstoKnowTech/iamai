// Which tenant policy is whose, across the whole plan (audit, 2026-10-05: the
// adversarial engine review of "policy identity is the name"). One policy is one
// step's own at most; Retire Replaced Policies retires a policy only once every
// step whose policy replaces it, and every other goal it does a job for, is On;
// an accepted difference reads the same in generation and tracking; a held
// ambiguous step never guesses; a duplicate of the plan's name is never ignored.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asCuratedBaseline, fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { observationsOf } from './tracking.ts'
import { materialFieldsOf } from './observation.ts'
import type { Step } from './types.ts'

type Row = Record<string, unknown>
const DC = 's-goal-block-device-code'
const AT = 's-goal-block-auth-transfer'
const MFA = 's-goal-mfa-all-users'
const SESSION = 's-goal-all-users-no-persistence'
const COMBINED = 'c0500000-0000-4000-8000-0000000000f1'

function fresh(): Fixture {
  return withFoundationSettled({ ...fixture('small'), baseline: asCuratedBaseline(pinnedPackage() as never) })
}
function rowsOf(f: Fixture): Row[] {
  return f.snapshot.config.caPolicies!.rows as Row[]
}
function edit(f: Fixture, change: (rows: Row[]) => Row[]): Fixture {
  const g = structuredClone(f)
  const at = g.snapshot.asOf
  g.snapshot.config.caPolicies!.rows = change(rowsOf(g)).map((p) => ({ createdDateTime: at, modifiedDateTime: at, ...p })) as never
  return g
}
const run = (f: Fixture, record: ReturnType<typeof observationsOf> | null = null) => runFixture(f, {}, record, f.snapshot.asOf)
const stepIn = (steps: readonly Step[], id: string): Step => steps.find((s) => s.id === id)!
/** A step's planned create, as the whole policy a person builds from its procedure (no IAMAI tag). */
function bodyOf(f: Fixture, id: string): Row {
  const op = stepIn(run(f).steps, id).action.resolution?.policies.find((o) => o.mode === 'create')
  assert.ok(op, `the premise: ${id} creates on a fresh tenant`)
  const body = structuredClone(op.body as Row)
  delete body.description
  return body
}
const retireOf = (r: ReturnType<typeof run>) => r.schedule.cleanup?.rows.find((x) => x.kind === 'retire') ?? null
const without = (names: RegExp) => (rows: Row[]): Row[] => rows.filter((p) => !names.test(String(p.displayName)))

/** One tenant policy blocking both device code flow and authentication transfer: what Entra builds with both ticked. */
function combined(extra: (p: Row) => void = () => {}): Fixture {
  const base = fresh()
  const p = structuredClone(bodyOf(base, AT))
  ;(p.conditions as { authenticationFlows: { transferMethods: string } }).authenticationFlows.transferMethods = 'deviceCodeFlow,authenticationTransfer'
  extra(p)
  return edit(base, (rows) => [...without(/Device code|MFA for all users/i)(rows), { ...p, id: COMBINED, displayName: 'Contoso - Block - Transfer flows', state: 'enabled' }])
}

test('F1: one tenant policy is renamed by one step at most, and never retired while it is another step’s own', () => {
  const f = combined()
  const first = run(f)
  const renaming = [DC, AT].filter((id) => (stepIn(first.steps, id).action.resolution?.policies ?? []).some((o) => o.mode === 'update' && o.policyId === COMBINED))
  assert.ok(renaming.length <= 1, `two steps rename the one policy: ${renaming.join(', ')}`)
  // Renamed to the step that took it, it is that step's own; the other step never renames it back.
  if (renaming.length === 1) {
    const taker = stepIn(first.steps, renaming[0])
    const renamed = edit(f, (rows) => rows.map((p) => (p.id === COMBINED ? { ...p, displayName: taker.createName } : p)))
    const second = run(renamed)
    for (const id of [DC, AT].filter((x) => x !== taker.id)) {
      assert.ok(!(stepIn(second.steps, id).action.resolution?.policies ?? []).some((o) => o.policyId === COMBINED), `${id} edits ${taker.id}'s own policy`)
      assert.ok(!(stepIn(second.steps, id).action.besidePolicies ?? []).some((p) => p.policyId === COMBINED), `${id} lists ${taker.id}'s own policy to retire`)
    }
    assert.ok(!(retireOf(second)?.lists.retiring ?? []).some((l) => l.includes(COMBINED)), 'Retire Replaced Policies lists a step’s own policy')
  }
})

test('F2: a policy listed beside two steps is retired only once both their policies are On', () => {
  const base = fresh()
  const f = combined((p) => { ((p.conditions as Row).users as Row).excludeUsers = [String((base.snapshot.users ?? [])[0]?.id)] })
  const r = run(f)
  const listing = [DC, AT].filter((id) => (stepIn(r.steps, id).action.besidePolicies ?? []).some((p) => p.policyId === COMBINED))
  assert.deepEqual(listing.sort(), [AT, DC].sort(), 'the premise: both steps list the combined policy beside them')
  const retire = retireOf(r)!
  for (const id of [DC, AT]) assert.ok((retire.waitsOn ?? []).includes(id), `Retire Replaced Policies does not wait on ${id}`)
  const line = (retire.lists.retiring ?? []).find((l) => l.includes(COMBINED))!
  assert.match(line, /keep it until .+ and .+ are On/)
})

test('F3: a policy that also does another goal’s job is retired only once that goal’s step is On too', () => {
  const base = fresh()
  const mfa = bodyOf(base, MFA)
  const session = bodyOf(base, SESSION)
  const both = { ...mfa, sessionControls: structuredClone(session.sessionControls), id: COMBINED, displayName: 'Contoso - Everyone - MFA and session', state: 'enabled' }
  const f = edit(base, (rows) => [...without(/MFA for all users/i)(rows), both])
  const r = run(f)
  const listed = (stepIn(r.steps, MFA).action.besidePolicies ?? []).find((p) => p.policyId === COMBINED)
  assert.ok(listed, 'the premise: Require MFA for Everyone lists the combined policy beside it')
  assert.ok((listed.alsoGoals ?? []).includes('all-users-no-persistence'), `the session goal is not named: ${JSON.stringify(listed.alsoGoals)}`)
  assert.ok((retireOf(r)!.waitsOn ?? []).includes(SESSION), 'Retire Replaced Policies does not wait on the session step')
})

test('F4: a step held on two policies carrying its name never ties itself to one by the last scan’s record', () => {
  const base = fresh()
  const body = bodyOf(base, MFA)
  const name = stepIn(run(base).steps, MFA).createName
  const one = edit(base, (rows) => [...without(/MFA for all users/i)(rows), { ...body, id: 'c0500000-0000-4000-8000-0000000000a1', displayName: name, state: 'enabled' }])
  const first = run(one)
  const two = edit(one, (rows) => [...rows, { ...body, id: 'c0500000-0000-4000-8000-0000000000a2', displayName: name, state: 'enabledForReportingButNotEnforced' }])
  const step = stepIn(run(two, observationsOf(first.steps)).steps, MFA)
  assert.equal(step.action.ambiguousTarget, true, 'the premise: two live policies carry the plan name')
  assert.ok(!(step.tracking?.members ?? []).some((m) => m.policyId), `the held step tied itself to ${JSON.stringify(step.tracking?.members?.map((m) => m.policyId))}`)
})

test('F5: an accepted difference never accepts the exclusions group gone: the step writes it back', () => {
  const base = fresh()
  const body = bodyOf(base, MFA)
  const name = stepIn(run(base).steps, MFA).createName
  const user = String((base.snapshot.users ?? [])[0]?.id)
  const users = (body.conditions as Row).users as Row
  const narrowed = { ...body, id: 'c0500000-0000-4000-8000-0000000000b1', displayName: name, state: 'enabled', conditions: { ...(body.conditions as Row), users: { ...users, excludeUsers: [user] } } }
  const f = edit(base, (rows) => [...without(/MFA for all users/i)(rows), narrowed])
  f.mapping.acceptedDeviations = { ...f.mapping.acceptedDeviations, [MFA]: { fields: { 'conditions.users': materialFieldsOf(narrowed)['conditions.users'] }, reason: 'A shared kiosk', at: f.snapshot.asOf } }
  assert.equal(stepIn(run(f).steps, MFA).status, 'done', 'the premise: the accepted narrowing completes the step')
  // The exclusions group taken off as well: never accepted, so the step corrects it.
  const gone = edit(f, (rows) => rows.map((p) => (p.id === narrowed.id ? { ...p, conditions: { ...(p.conditions as Row), users: { ...((p.conditions as Row).users as Row), excludeGroups: [] } } } : p)))
  const step = stepIn(run(gone).steps, MFA)
  assert.notEqual(step.status, 'done', 'the exclusions group gone reads done')
  assert.ok((step.action.resolution?.policies ?? []).some((o) => o.mode === 'update' && o.policyId === narrowed.id), 'nothing writes the exclusions group back')
})

test('F6: a second live policy carrying the plan’s name beside the step’s tagged own is listed to retire', () => {
  const base = fresh()
  const op = stepIn(run(base).steps, MFA).action.resolution!.policies.find((o) => o.mode === 'create')!
  const name = stepIn(run(base).steps, MFA).createName
  const tagged = { ...structuredClone(op.body as Row), id: 'c0500000-0000-4000-8000-0000000000c1', displayName: 'MFA everyone (renamed by hand)', state: 'enabled' }
  const dup = { ...structuredClone(op.body as Row), id: 'c0500000-0000-4000-8000-0000000000c2', displayName: name, state: 'enabled' }
  delete (dup as Row).description
  const f = edit(base, (rows) => [...without(/MFA for all users/i)(rows), tagged, dup])
  const step = stepIn(run(f).steps, MFA)
  assert.ok((step.action.besidePolicies ?? []).some((p) => p.policyId === dup.id), 'the duplicate of the plan’s name is ignored')
})
