// Rescan durability and identity continuity (task 043).
//
// One sentence holds this file together:
//
//   A rescan may update evidence. It must not rewrite history, identity, or
//   operator intent.
//
// Task 042 proved that inside one scan a fact has one authority. This proves
// that across scans the same authorities keep telling the truth: that a rename
// is not a new object, that a recreated object inherits nothing, that a
// confirmed choice survives a rename and dies with its object, that a window is
// earned by the policy that earned it, that readiness is what the records say
// today and not what they said last week — and that a scan which saw less of the
// tenant than the one before it deletes nothing.
//
// The corpus is `roadmap/fixtures/transitions.ts`: paired scans of one tenant
// with one thing changed between them, every subject chosen by asking a
// production authority a question rather than by naming an object. The last test
// asserts that by reading this file's and the corpus's own bytes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TRANSITION_KEYS, adminsIn, advance, ctxFor, rescan, rowIn, stepIn, transition, transitions, watchedStep } from './roadmap/fixtures/transitions.ts'
import type { Scan, Transition, TransitionKey } from './roadmap/fixtures/transitions.ts'
import { curatedFixture } from './roadmap/fixtures/index.ts'
import { runFixture } from './roadmap/fixtures/run.ts'
import { observationsOf } from './roadmap/tracking.ts'
import { historyReset } from './roadmap/observation.ts'
import { exclusionsGroupChoice, awaitsOperator, exclusionsGroupIdToVerify } from './mapping/safetyChoice.ts'
import { emergencySelection } from './mapping/emergencyChoice.ts'
import { stepContract } from './ui/surfaces/stepContract.ts'
import { stepExportView } from './ui/surfaces/stepExport.ts'
import { statusOf } from './ui/surfaces/statusWord.ts'
import { breakGlassFindings } from './validation/report.ts'
import { implementationOffered, unavailableReason } from './roadmap/operations.ts'
import { READINESS_STATES } from './scoring/phishingResistant.ts'
import { INACTIVE_DAYS } from './scoring/mfaViability.ts'
import { PINNED } from './baseline/pinned.ts'
import type { Step } from './roadmap/types.ts'

/** Every step's semantics in one scan, keyed by step: what a later scan must not move by accident. */
function semanticsById(scan: Scan): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of scan.steps) out[s.id] = `${s.state.lifecycle}/${s.state.condition}/${s.status}/${s.state.satisfied}/${s.state.inPlace}/${s.state.setAside}`
  return out
}

/** Every person's readiness in one scan, keyed by the account's immutable id. */
function readinessById(scan: Scan): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of scan.readiness.rows) out[r.user.id] = `${r.kind}/${r.active}/${r.state}/${r.readiness?.state ?? null}/${r.admin}/${(r.methods ?? ['unread']).join('+')}`
  return out
}

/** The group memberships one scan read, in the shape the validation rules take. */
function groupFactsOf(scan: Scan): { groupId: string; memberIds: string[]; memberCount: number; sampled: boolean; displayName?: string | null }[] {
  return [...scan.fixture.groups].map(([groupId, g]) => ({ groupId, ...g }))
}

/**
 * The history a record holds, without the stamp that moves on every scan. Two
 * scans of the same tenant differ in `lastSeenAt` because the second one looked;
 * everything else in an observation is what a scan may not move on its own.
 */
function historyIn(scan: Scan): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [id, rec] of Object.entries(scan.observations)) {
    for (const [key, o] of Object.entries(rec.members)) out[`${id}/${key}`] = `${o.artifact}/${o.state}/${o.semantics}/${o.firstSeenAt}/${o.since}/${o.evidenceAt}`
  }
  return out
}

/** The exclusions-group choice as one scan resolves it, through the one authority (Foundation C). */
function exclusionsIn(scan: Scan): ReturnType<typeof exclusionsGroupChoice> {
  return exclusionsGroupChoice({ snapshot: scan.fixture.snapshot, mapping: scan.fixture.mapping, groups: scan.fixture.groups, directory: scan.run.input.directory })
}

/** The step both scans hold, or null where one of them does not. */
function pairFor(t: Transition, id: string): { a: Step; b: Step } | null {
  const a = stepIn(t.a, id)
  const b = stepIn(t.b, id)
  return a && b ? { a, b } : null
}

/** The step a policy transition is about, in both scans. */
function watchedPair(t: Transition): { a: Step; b: Step } | null {
  const a = watchedStep(t.a.run)
  return a ? pairFor(t, a.id) : null
}

// ---- 0. the corpus builds every transition it names ----

test('043.0: the corpus builds every transition it names, and both scans of each are real', () => {
  const built = transitions()
  assert.deepEqual(
    TRANSITION_KEYS.filter((k) => !built.some((t) => t.key === k)),
    [],
    'a transition no base tenant can produce: every assertion about it is vacuous',
  )
  for (const t of built) {
    assert.ok(t.a.steps.length > 0, `${t.key}: scan A derived no plan`)
    assert.ok(t.b.steps.length > 0, `${t.key}: scan B derived no plan`)
    assert.ok(Object.keys(t.a.observations).length > 0, `${t.key}: scan A left the next scan no record to compare against`)
    assert.ok(Date.parse(t.b.fixture.snapshot.asOf) >= Date.parse(t.a.fixture.snapshot.asOf), `${t.key}: scan B is not later than scan A`)
  }
  // The corpus has to contain a case where the second scan sees LESS of the
  // tenant than the first, because that is the case a record can lose history
  // to; and one where a deployed object is replaced, because that is the case a
  // fingerprint cannot see.
  assert.ok(transition('coverageUnreadable').b.steps.length < transition('coverageUnreadable').a.steps.length, 'the corpus has no scan that could assess less than the one before it')
  assert.equal(watchedPair(transition('policyReplaced'))?.b.state.observation?.changed, 'artifact', 'the corpus has no replaced deployed object')
})

// ---- 1. a rescan with nothing to report reports nothing ----

test('043.1: a repeat scan with no material change moves nothing', () => {
  const t = transition('unchanged')
  assert.deepEqual(
    t.b.steps.map((s) => s.id),
    t.a.steps.map((s) => s.id),
    'the plan gained, lost or reordered a step on a scan that found nothing new',
  )
  assert.deepEqual(semanticsById(t.b), semanticsById(t.a), 'a step changed lifecycle, condition or status with nothing behind it')
  assert.deepEqual(readinessById(t.b), readinessById(t.a), 'a person moved readiness, methods or category with nothing behind it')
  assert.deepEqual(t.b.readiness.counts, t.a.readiness.counts, 'the readiness summary moved with no evidence')
  // The operator's decisions are the record's, and a scan is not an author.
  assert.deepEqual(t.b.fixture.mapping.breakGlassUserIds, t.a.fixture.mapping.breakGlassUserIds, 'a scan rewrote the emergency-access set')
  assert.equal(exclusionsIn(t.b).actionableId, exclusionsIn(t.a).actionableId, 'a scan rewrote the exclusions-group choice')
  // And the history it leaves for the next scan is the history it was given.
  assert.deepEqual(t.b.observations, t.a.observations, 'a scan that saw nothing new rewrote the record anyway')
  for (const s of t.b.steps) {
    if (!s.state.observation) continue
    assert.equal(s.state.observation.changed, s.state.observation.prior === null ? 'first-scan' : 'none', `${s.id}: the second scan called an unchanged policy changed`)
    assert.equal(s.state.observation.reviewRequired, false, `${s.id}: a second look at an unchanged policy asked for a person`)
  }
})

// ---- 2. a label is not an identity ----

test('043.2: a rename is not a new object, and no fact is keyed on a name', () => {
  const t = transition('renamed')
  const pair = watchedPair(t)
  assert.ok(pair, 'the corpus lost the watched step to a rename')
  const change = pair.b.state.observation
  assert.equal(change?.changed, 'none', 'a rename read as a change to what the policy does')
  assert.equal(change?.continuity, 'continues', 'a rename restarted the observation window')
  assert.equal(change?.reviewRequired, false, 'a rename asked for a person to look')
  assert.equal(change?.latest.firstSeenAt, pair.a.state.observation?.latest.firstSeenAt, 'a rename moved the date IAMAI first saw the policy')
  assert.equal(change?.latest.evidenceAt, pair.a.state.observation?.latest.evidenceAt, 'a rename discarded Microsoft’s own evidence about the same object')
  assert.equal(historyReset(change!), false, 'a rename reset the history of a policy nobody changed')

  // The people were relabelled too — display name and sign-in name — and every
  // person-level fact is keyed on the immutable id, so the whole page is the
  // page it was.
  assert.deepEqual(readinessById(t.b), readinessById(t.a), 'a person’s readiness moved when their name did')
  assert.deepEqual(semanticsById(t.b), semanticsById(t.a), 'a step moved when the policy and the people were relabelled')
  const renamed = t.b.fixture.snapshot.users.filter((u) => (t.a.fixture.snapshot.users.find((x) => x.id === u.id)?.displayName ?? '') !== (u.displayName ?? ''))
  assert.ok(renamed.length > 0, 'the rename case renamed nobody: the assertions above are vacuous')
  // The confirmed decisions are about ids, so they survive a relabelling of
  // everything they point at.
  assert.deepEqual(t.b.fixture.mapping.breakGlassUserIds, t.a.fixture.mapping.breakGlassUserIds, 'the emergency-access set followed a name')
  assert.equal(exclusionsIn(t.b).status, 'confirmed', 'the exclusions-group choice was lost when its group was relabelled')
  assert.equal(exclusionsIn(t.b).actionableId, exclusionsIn(t.a).actionableId, 'the exclusions-group choice moved to another object on a rename')
})

// ---- 3. a new object inherits nothing ----

test('043.3: a recreated policy with the same name and body inherits no history', () => {
  const t = transition('policyReplaced')
  const pair = watchedPair(t)
  assert.ok(pair, 'the corpus lost the watched step to a replacement')
  const before = pair.a.state.observation!
  const change = pair.b.state.observation!
  assert.equal(change.changed, 'artifact', 'a different object delivering the step read as the same one')
  assert.equal(change.continuity, 'reset', 'a replacement carried the window the object it replaced had earned')
  assert.ok(historyReset(change), 'a replacement kept a history nobody watched it earn')
  assert.notEqual(change.latest.artifact, before.latest.artifact, 'the replacement fingerprinted as the same object')
  assert.equal(change.latest.semantics, before.latest.semantics, 'the case did not replace the object with an identical one: it is testing something else')
  assert.equal(change.latest.firstSeenAt, t.b.fixture.snapshot.asOf, 'the new object was credited with time before it existed')
  assert.equal(change.latest.evidenceAt, null, 'evidence about the policy that was replaced was read as evidence about the one that replaced it')
  assert.equal(change.latest.since, 'first-scan', 'IAMAI claimed to have watched an object change that it had never seen before')
  // And the member is not ready to enforce on a window it has not served.
  const member = pair.b.tracking?.members?.[0]
  assert.notEqual(member?.lifecycle, 'ready-to-enforce', 'a policy deployed today reached ready to enforce on its predecessor’s window')
})

test('043.3b: a replacement never inherits an operator’s confirmation by name', () => {
  const t = transition('newCandidateGroup')
  const a = exclusionsIn(t.a)
  const b = exclusionsIn(t.b)
  assert.equal(a.status, 'confirmed', 'the case starts from an unconfirmed choice: it is testing something else')
  assert.equal(b.status, 'confirmed', 'a new candidate unsettled a choice the operator had already made')
  assert.equal(b.actionableId, a.actionableId, 'a new candidate object took over a confirmation the operator gave another object')
  assert.ok(b.candidates.length > a.candidates.length, 'the case added no candidate: the assertion above is vacuous')
  assert.equal(b.recommended, null, 'a scan put a recommendation where the operator had already answered')
})

// ---- 4. a material change invalidates what it touches, and nothing else ----

test('043.4: a policy rewritten in the tenant is held for review, and only that step', () => {
  const t = transition('rewritten')
  const pair = watchedPair(t)
  assert.ok(pair, 'the corpus lost the watched step to a rewrite')
  const change = pair.b.state.observation!
  assert.equal(change.changed, 'semantics', 'a narrowed grant read as something other than a change to what the policy does')
  assert.equal(change.expected, false, 'a change the plan never asked for read as the plan’s own work landing')
  assert.equal(change.reviewRequired, true, 'a policy nobody explained is trusted without a person looking at it')
  assert.equal(change.continuity, 'reset', 'the window earned by what the policy used to be carried into what it is now')
  assert.equal(pair.b.state.condition, 'review-required', 'the step does not say a person has to look')
  assert.notEqual(pair.b.tracking?.members?.[0]?.lifecycle, 'ready-to-enforce', 'a rewritten policy is one switch away from enforcement')
  // Every other step is where the clock left it: one policy changed, one step
  // moved beyond what the passage of time moved on its own.
  const control = semanticsById(t.control)
  const b = semanticsById(t.b)
  const moved = Object.keys(b).filter((id) => control[id] !== undefined && control[id] !== b[id])
  assert.deepEqual(moved, [pair.b.id], `one policy was rewritten and the plan moved ${moved.length} steps`)
})

// ---- 5. a confirmed choice dies with its object and is never replaced ----

test('043.5: a confirmed object proved gone becomes unresolved, and nothing takes its place', () => {
  const t = transition('decisionTargetGone')
  const a = exclusionsIn(t.a)
  const b = exclusionsIn(t.b)
  assert.equal(a.status, 'confirmed', 'the case starts from an unconfirmed choice: it is testing something else')
  assert.equal(b.status, 'invalidated', 'an object Graph proved gone is still a usable answer')
  assert.equal(b.actionableId, null, 'a plan still writes policies against an object that is not there')
  assert.equal(b.storedId, a.storedId, 'the operator’s own answer was rewritten by a scan')
  assert.equal(b.recommended, null, 'a scan put forward a replacement for a decision only the operator may make')
  assert.ok(awaitsOperator(b), 'nothing tells the operator their answer needs one from them again')
  // The step that owns the question reopens, and the steps that depend on it stop.
  const owner = t.b.steps.find((s) => s.state.condition === 'needs-decision')
  assert.ok(owner, 'no step asks the operator the question their answer no longer settles')
})

test('043.5b: a confirmed emergency-access account gone from the directory holds the plan', () => {
  const t = transition('emergencyTargetGone')
  const gone = t.focus.userId
  assert.ok(gone, 'the case names no account')
  assert.ok(t.a.fixture.snapshot.users.some((u) => u.id === gone), 'the account was never in the tenant: the case is testing nothing')
  assert.equal(t.b.fixture.snapshot.users.some((u) => u.id === gone), false, 'the account is still in the tenant')
  // The decision is the operator's and a scan does not edit it.
  assert.deepEqual(t.b.fixture.mapping.breakGlassUserIds, t.a.fixture.mapping.breakGlassUserIds, 'a scan quietly dropped an account from the emergency-access decision')
  assert.equal(emergencySelection({ snapshot: t.b.fixture.snapshot, mapping: t.b.fixture.mapping }).confirmedIds.length, t.a.fixture.mapping.breakGlassUserIds.length, 'the confirmed set changed without the operator')
  // And the plan fails closed: something blocks, naming the account.
  const before = breakGlassFindings({ snapshot: t.a.fixture.snapshot, state: t.a.fixture.mapping, groupMembers: groupFactsOf(t.a) })
  const after = breakGlassFindings({ snapshot: t.b.fixture.snapshot, state: t.b.fixture.mapping, groupMembers: groupFactsOf(t.b) })
  assert.equal(before[gone]?.toFix ?? 0, 0, 'the account already had something to fix before it went missing: the case is testing something else')
  assert.ok((after[gone]?.toFix ?? 0) > 0, 'an emergency-access account that is not in the tenant passes every safety check')
})

// ---- 6. history is what was watched, never what is assumed ----

test('043.6: no scan discovers history it did not watch', () => {
  for (const t of transitions()) {
    for (const s of t.b.steps) {
      for (const m of s.state.members) {
        const { prior, latest, continuity } = m.change
        assert.ok(Date.parse(latest.firstSeenAt) <= Date.parse(t.b.fixture.snapshot.asOf), `${t.key}/${s.id}: a policy was first seen after the scan that saw it`)
        if (prior) {
          assert.ok(Date.parse(latest.firstSeenAt) >= Date.parse(prior.firstSeenAt), `${t.key}/${s.id}: a later scan found an EARLIER first sighting than the record held`)
          if (continuity === 'continues') assert.equal(latest.firstSeenAt, prior.firstSeenAt, `${t.key}/${s.id}: an unbroken window restarted anyway`)
          // "IAMAI watched this object move" is a claim, and it needs the same
          // object on both sides of the move.
          if (latest.since === 'observed-change') assert.equal(latest.artifact, prior.artifact, `${t.key}/${s.id}: IAMAI claimed to have watched a change to an object it had not been watching`)
        } else {
          assert.equal(latest.since, 'first-scan', `${t.key}/${s.id}: a first sighting was recorded as a change IAMAI watched happen`)
        }
        // Microsoft's evidence is admissible only about the object deployed now.
        if (latest.evidenceAt !== null && latest.since === 'observed-change') {
          assert.ok(Date.parse(latest.evidenceAt) >= Date.parse(latest.firstSeenAt), `${t.key}/${s.id}: evidence from before a watched change was read as evidence about what came after it`)
        }
      }
      // "In report-only since" is one of two dated facts and says which it is.
      const tr = s.tracking
      if (tr?.reportOnlyAt) assert.ok(tr.reportOnlyAtSource === 'sign-in-evidence' || tr.reportOnlyAtSource === 'first-seen-by-iamai', `${t.key}/${s.id}: a report-only date with no provenance`)
      else assert.equal(tr?.reportOnlyAtSource ?? null, null, `${t.key}/${s.id}: a provenance for a date that is not there`)
    }
  }
})

// ---- 7. actionability is this scan's, never the last one's ----

test('043.7: a blocker that appears stops the step, and one that clears releases it', () => {
  // Satisfied -> blocked: the confirmed group is still there and no longer holds
  // the emergency accounts, which is a safety check and not a missing object.
  const broke = transition('safetyMembershipChanged')
  assert.equal(exclusionsIn(broke.b).status, 'confirmed', 'the group was not still there: the case is testing a missing object instead')
  const brokeMoved = broke.b.steps.filter((s) => s.state.condition === 'blocked' && stepIn(broke.control, s.id)?.state.condition !== 'blocked')
  assert.ok(brokeMoved.length > 0, 'the exclusions group stopped protecting the emergency accounts and no step noticed')
  // Condition and lifecycle are two axes (Foundation B), so a step already in
  // report-only stays in report-only and is held; what none of them may be is
  // something the operator can act on today.
  for (const s of brokeMoved) {
    assert.ok(s.blockers.length > 0, `${s.id}: a blocked condition with nothing named as the cause`)
    assert.notEqual(s.status, 'ready', `${s.id}: a blocked step still reads as ready to do`)
  }

  // Blocked -> satisfied and back: the prerequisite object the plan waited on
  // exists this scan, and on the same tenant it does not. The axis a missing
  // prerequisite object moves is availability, not condition (Foundation A):
  // what changes is whether the step has an implementation to offer at all,
  // plus the Preparation step that would make the object.
  const cleared = transition('prerequisiteCleared')
  const released = cleared.b.steps.filter((s) => implementationOffered(s) && stepIn(cleared.control, s.id) !== null && !implementationOffered(stepIn(cleared.control, s.id)!))
  assert.ok(released.length > 0, 'the prerequisite object exists and nothing in the plan became offerable')
  for (const s of released) {
    assert.equal(unavailableReason(s), null, `${s.id}: offered and still naming a reason it cannot be written`)
    assert.equal(unavailableReason(stepIn(cleared.control, s.id)!), 'missing-object', `${s.id}: the case is not about a missing object`)
    assert.equal(s.blockers.some((x) => x.kind === 'step'), false, `${s.id}: released and still held by the step that would make the object`)
  }
  assert.ok(cleared.control.steps.some((s) => !cleared.b.steps.some((x) => x.id === s.id)), 'the Preparation step for the object stayed in a plan whose tenant has it')

  const appeared = transition('prerequisiteAppeared')
  const held = appeared.b.steps.filter((s) => !implementationOffered(s) && stepIn(appeared.control, s.id) !== null && implementationOffered(stepIn(appeared.control, s.id)!))
  assert.ok(held.length > 0, 'the object a step needed went missing and the step stayed offerable')
  for (const s of held) {
    assert.equal(unavailableReason(s), 'missing-object', `${s.id}: unavailable for a reason other than the object that went missing`)
    assert.ok(s.blockers.some((x) => x.kind === 'step'), `${s.id}: nothing names the step that would make the object`)
  }
  assert.ok(appeared.b.steps.some((s) => !appeared.control.steps.some((x) => x.id === s.id)), 'the object went missing and no Preparation step appeared to make it')

  // Nothing anywhere keeps a stale ready: every ready step in scan B is ready on
  // scan B's own condition.
  for (const t of transitions()) {
    for (const s of t.b.steps) {
      if (s.status !== 'ready') continue
      assert.equal(s.state.condition, 'healthy', `${t.key}/${s.id}: a step reads Ready under a condition that is not healthy`)
      assert.deepEqual(s.blockers, [], `${t.key}/${s.id}: a step reads Ready with a blocker on it`)
    }
  }
})

// ---- 8. proof ages, registration does not ----

test('043.8: proof ages by the clock and registration survives it', () => {
  const t = transition('proofAged')
  const id = t.focus.userId
  assert.ok(id, 'the case names nobody')
  const a = rowIn(t.a, id)!
  const b = rowIn(t.b, id)!
  const since = (Date.parse(t.b.fixture.snapshot.asOf) - Date.parse(a.user.lastSuccessfulSignIn!)) / 86_400_000
  assert.ok(since > INACTIVE_DAYS, 'the clock did not pass the boundary the case is about')
  assert.equal(a.active, true, 'the person was not counted before the clock moved')
  assert.equal(b.active, false, 'a person past the inactivity boundary is still counted among the active')
  assert.equal(b.state, null, 'a person the page does not count still carries a readiness state')
  // What they hold has not changed, and the page still says so.
  assert.deepEqual(b.viability?.registered, a.viability?.registered, 'a registered method expired with the clock')
  assert.deepEqual(b.methods, a.methods, 'the methods column changed because time passed')
  assert.equal(b.readiness?.state, a.readiness?.state, 'the readiness a person’s methods and records give them moved with nobody’s evidence')
  // Nobody else moved except by the same rule.
  for (const row of t.b.readiness.rows) {
    const was = rowIn(t.a, row.user.id)
    if (!was || was.active === row.active) continue
    const last = row.user.lastSuccessfulSignIn
    assert.ok(last !== null && (Date.parse(t.b.fixture.snapshot.asOf) - Date.parse(last)) / 86_400_000 > INACTIVE_DAYS, `${row.user.id}: left the active population without passing the boundary`)
  }
  // The four readiness states still partition the people the page counts.
  assert.equal(READINESS_STATES.reduce((n, s) => n + t.b.readiness.counts[s], 0), t.b.readiness.facts.active, 'the readiness states no longer sum to the active people')
})

// ---- 9. proof is kept per method and platform ----

test('043.9: a phishing-resistant proof makes a person Ready, and a later weaker record does not take it away', () => {
  const up = transition('strongerProof')
  const upId = up.focus.userId!
  const before = rowIn(up.a, upId)!
  const after = rowIn(up.b, upId)!
  assert.notEqual(before.state, 'ready', 'the case starts from somebody already Ready: it is testing something else')
  assert.equal(after.state, 'ready', 'a passkey proved on every platform the person uses did not make them Ready')
  assert.equal(after.state, after.viability!.readiness.state, 'the row and the scoring disagree about readiness')
  assert.equal(up.b.readiness.counts.ready, up.a.readiness.counts.ready + 1, 'the summary did not follow the person who became Ready')

  // Step 7: proof is kept per method and platform, so a newer record that names
  // no method never erases the passkey proof the records still hold.
  const down = transition('weakerLaterEvidence')
  const downId = down.focus.userId!
  const was = rowIn(down.a, downId)!
  const now = rowIn(down.b, downId)!
  assert.equal(was.state, 'ready', 'the case does not start from a Ready person: it is testing something else')
  assert.deepEqual(now.viability?.registered, was.viability?.registered, 'the case took the method away too: it is testing something else')
  assert.equal(now.viability?.evidence?.method, 'Multifactor authentication', 'the newest record names no method')
  assert.equal(now.state, 'ready', 'a later record that names no method erased the phishing-resistant proof the records hold')
  assert.equal(down.b.readiness.counts.ready, down.a.readiness.counts.ready, 'the summary stopped counting a person whose proof the records still hold')
})

// ---- 10. an account's category is what the directory says today ----

test('043.10: role and account-category changes move the rows and the counts together', () => {
  const gained = transition('roleGained')
  const gId = gained.focus.userId!
  assert.equal(rowIn(gained.a, gId)?.admin, false, 'the case starts from an administrator')
  assert.equal(rowIn(gained.b, gId)?.admin, true, 'a new role holder is not shown as an administrator')
  assert.ok(adminsIn(gained.b).has(gId), 'the directory’s own role table and the row disagree')
  assert.equal(gained.b.readiness.rows.filter((r) => r.admin).length, gained.a.readiness.rows.filter((r) => r.admin).length + 1, 'the administrator count did not follow the role')

  const lost = transition('roleLost')
  const lId = lost.focus.userId!
  assert.equal(rowIn(lost.a, lId)?.admin, true, 'the case starts from somebody who was never an administrator')
  assert.equal(rowIn(lost.b, lId)?.admin, false, 'an account keeps an administrator badge after the role is taken off it')
  assert.equal(lost.b.readiness.rows.filter((r) => r.admin).length, lost.a.readiness.rows.filter((r) => r.admin).length - 1, 'the administrator count kept a role nobody holds')

  const off = transition('accountDisabled')
  const oId = off.focus.userId!
  assert.equal(rowIn(off.a, oId)?.kind, 'person', 'the case starts from an account that is not a person')
  assert.equal(rowIn(off.b, oId)?.kind, 'disabled', 'a disabled account is still counted as a person')
  assert.equal(rowIn(off.b, oId)?.active, false, 'a disabled account is still counted among the active people')
  assert.equal(off.b.readiness.facts.active, off.a.readiness.facts.active - 1, 'the active count kept an account the directory disabled')
  // Every account is still counted exactly once, on both sides.
  for (const scan of [off.a, off.b]) assert.equal(scan.readiness.rows.length, scan.readiness.ladder.accounts, 'an account is listed a different number of times than it is counted')
})

// ---- 11. the same input gives the same plan ----

test('043.11: unchanged semantic input produces the same plan, in the same order', () => {
  const t = transition('unchanged')
  assert.deepEqual(t.b.steps.map((s) => s.id), t.a.steps.map((s) => s.id), 'the plan reordered itself on a scan that found nothing')
  assert.deepEqual(t.b.steps.map((s) => s.phase), t.a.steps.map((s) => s.phase), 'a step changed phase with nothing behind it')
  assert.deepEqual(t.b.run.schedule.waves.map((w) => w.stepIds), t.a.run.schedule.waves.map((w) => w.stepIds), 'the schedule reshuffled itself')
  for (const s of t.b.steps) {
    const was = stepIn(t.a, s.id)!
    assert.equal(statusOf(s).word, statusOf(was).word, `${s.id}: the status word moved with nothing behind it`)
    assert.equal(stepContract(s, ctxFor(t.b, s)).whatToDo.kind, stepContract(was, ctxFor(t.a, was)).whatToDo.kind, `${s.id}: the action classification moved with nothing behind it`)
  }
  // A materially changed input is allowed to move the plan, and does.
  const changed = transition('rewritten')
  const pair = watchedPair(changed)!
  assert.notEqual(statusOf(pair.b).word + pair.b.state.condition, statusOf(pair.a).word + pair.a.state.condition, 'a rewritten policy left the plan saying exactly what it said before')
})

// ---- 12. Export speaks for this scan ----

test('043.12: the export view is the current scan’s, never the last one’s', () => {
  let differed = 0
  for (const t of transitions()) {
    for (const s of t.b.steps) {
      const contract = stepContract(s, ctxFor(t.b, s))
      const view = stepExportView(s, ctxFor(t.b, s))
      assert.equal(view.status, contract.state.word, `${t.key}/${s.id}: the export view and the opened step give different status words`)
      assert.equal(view.stage, contract.state.stage, `${t.key}/${s.id}: the export view and the opened step give different stages`)
      assert.equal(view.condition, contract.state.conditionLabel, `${t.key}/${s.id}: the export view and the opened step give different conditions`)
      const was = stepIn(t.a, s.id)
      if (!was) continue
      const before = stepExportView(was, ctxFor(t.a, was))
      // Where the step's semantics moved, the export moved with them; where they
      // did not, it did not invent a difference.
      if (`${s.state.lifecycle}/${s.state.condition}` !== `${was.state.lifecycle}/${was.state.condition}`) {
        assert.notEqual(`${view.stage}/${view.condition}`, `${before.stage}/${before.condition}`, `${t.key}/${s.id}: the step moved and the export still speaks for the scan before it`)
        differed++
      }
    }
  }
  assert.ok(differed > 0, 'no transition moved a step’s stage or condition: the assertion above is vacuous')
})

// ---- 13. a scan updates the record; it never deletes what it did not look at ----

test('043.13: a scan that could assess less of the tenant loses no rollout history', () => {
  const t = transition('coverageUnreadable')
  const watched = watchedStep(t.a.run)!
  const first = t.a.observations[watched.id]
  assert.ok(first, 'scan A recorded nothing about the step it was watching')
  assert.equal(stepIn(t.b, watched.id), null, 'the case did not make the step unassessable: it is testing something else')
  // The step is not in this plan, so this scan saw nothing of it — and saw
  // nothing is not the same as saw it gone.
  assert.deepEqual(t.b.observations[watched.id], first, 'a scan that could not assess a goal deleted the history of the policy already deployed for it')

  // The third scan: the read succeeds again, and the window is the window it was.
  const back = rescan(t.b, advance(t.a.fixture, t.days * 2))
  const returned = stepIn(back, watched.id)
  assert.ok(returned, 'the step did not come back when the tenant could be read again')
  assert.equal(returned.state.observation?.changed, 'none', 'a policy IAMAI had been watching for a week read as a first sighting')
  assert.equal(returned.state.observation?.latest.firstSeenAt, watched.state.observation?.latest.firstSeenAt, 'the report-only window restarted because one group read failed')

  // The control: the same third scan reached without the blind scan in between
  // gives the same history, so the blind scan cost nothing at all.
  const control = rescan(t.a, advance(t.a.fixture, t.days * 2))
  assert.equal(returned.state.observation?.latest.firstSeenAt, stepIn(control, watched.id)?.state.observation?.latest.firstSeenAt, 'a scan that saw less of the tenant left the plan worse off than one that never happened')
  assert.equal(returned.state.lifecycle, stepIn(control, watched.id)?.state.lifecycle, 'a blind scan cost the step its lifecycle')
})

test('043.13b: a record a scan carries forward still has to prove itself against what is deployed', () => {
  // Carrying a record forward is only safe because nothing reads it as a
  // conclusion: it is put through `observe` against the object deployed now.
  // Scan A watches a policy; scan B cannot assess the goal; between them the
  // tenant replaces the policy with a different object.
  const t = transition('coverageUnreadable')
  const watched = watchedStep(t.a.run)!
  const target = watched.tracking!.policyId!
  const f = t.a.fixture
  const rows = (f.snapshot.config.caPolicies?.rows ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return row.id === target ? { ...structuredClone(row), id: `${target}-recreated` } : row
  })
  const replaced = advance({ ...f, snapshot: { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...f.snapshot.config.caPolicies!, rows } } } as typeof f.snapshot }, t.days * 2)
  const back = rescan(t.b, replaced)
  const step = stepIn(back, watched.id)!
  assert.equal(step.state.observation?.changed, 'artifact', 'a record carried across a blind scan was accepted without asking which object it was about')
  assert.ok(historyReset(step.state.observation!), 'a carried-forward record handed its window to an object nobody had watched')
})

test('043.13c: another tenant’s record confers nothing on this one', () => {
  // The record is keyed by tenant at the persistence boundary (planData.ts
  // savePlanRecord(snapshot.tenantId), planIdFor), so two tenants never share
  // one. That is the guarantee; this is what stands behind it if it were ever
  // breached. Two different synthetic organisations produce the same step ids —
  // a step id is the goal's, not the tenant's — and different policy objects,
  // which is exactly the shape a record could be misfiled into.
  const one = curatedFixture('small')
  const two = curatedFixture('getiamai')
  assert.notEqual(one.snapshot.tenantId, two.snapshot.tenantId, 'the two tenants are one tenant: the case is testing nothing')
  // The store key is the tenant's own id and nothing derived from it.
  assert.match(readFileSync('src/ui/surfaces/planData.ts', 'utf8'), /savePlanRecord\(snapshot\.tenantId/, 'the plan record is not keyed on the tenant it belongs to')
  const foreign = observationsOf(runFixture(one).steps)
  const shared = Object.keys(foreign).filter((id) => runFixture(two).steps.some((s) => s.id === id))
  assert.ok(shared.length > 0, 'the two tenants share no step id: the assertion below is vacuous')
  const crossed = runFixture(two, {}, foreign)
  for (const s of crossed.steps) {
    for (const m of s.state.members) {
      if (m.change.prior === null || m.change.latest.artifact === null) continue
      assert.ok(historyReset(m.change), `${s.id}: a record from another tenant handed this one a window`)
    }
  }
  // And the demo is a mode, not a tenant fact: the surfaces read it from one
  // module rather than from a snapshot they happen to be holding.
  const demoSrc = readFileSync('src/ui/demoMode.ts', 'utf8')
  assert.ok(demoSrc.length > 0, 'the demo has no module of its own')
  assert.equal(/savePlanRecord|saveMappingState/.test(demoSrc), false, 'the demo writes into the store a real tenant’s plan is kept in')
})

// ---- 14. the baseline is a repo fact and a scan never re-pins it ----

test('043.14: a change of baseline provenance moves no conclusion', () => {
  const t = transition('baselineProvenanceChanged')
  assert.notDeepEqual(t.b.fixture.baseline.origins, t.a.fixture.baseline.origins, 'the case changed no provenance: it is testing nothing')
  assert.equal(t.b.run.input.baselineAuthor, null, 'the case left the author in place: it is testing nothing')
  assert.deepEqual(t.b.fixture.baseline.policies, t.a.fixture.baseline.policies, 'a provenance change rewrote what the baseline asks for')
  assert.deepEqual(semanticsById(t.b), semanticsById(t.a), 'a step moved because the baseline’s provenance did')
  assert.deepEqual(historyIn(t.b), historyIn(t.a), 'a provenance change restarted an observation window')
  // The pinned baseline is a repo fact with a commit behind it, and a scan is
  // not a re-pin: nothing in the derivation reads or writes the pinned commit,
  // and it is the same commit before and after this transition.
  assert.match(PINNED.commit, /^[0-9a-f]{40}$/, 'the pinned baseline names no commit')
  assert.equal(PINNED.commit, JSON.parse(readFileSync('baselines/jhope188-conditionalaccesspolicies.index.json', 'utf8')).commit, 'the pinned package and the fetch allowlist disagree about which commit is pinned')
})

// ---- 15. no transition is selected by an identifier ----

test('043.15: the transition corpus and this file select by semantics, never by identity', () => {
  const guid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  const stepId = /['"`]s-goal-[a-z0-9-]+['"`]/
  const nameIdentity = /(displayName|userPrincipalName)\s*===/
  const pageImport = /from '[^']*\.tsx'/
  for (const path of ['src/roadmap/fixtures/transitions.ts', 'src/rescanDurability.test.ts']) {
    const src = readFileSync(path, 'utf8')
    // One exception, and it is not an identity: the Global Administrator role id
    // is Microsoft's own well-known constant, the same value the fixtures and
    // roles.ts already name, and it is what "an administrator" means.
    const withoutWellKnown = src.replace(/62e90394-69f5-4237-9190-012177145e10/g, '')
    assert.equal(guid.test(withoutWellKnown), false, `${path} names a tenant object id: the case it covers stops existing when the fixture moves`)
    assert.equal(stepId.test(src), false, `${path} names a step id`)
    assert.equal(nameIdentity.test(src), false, `${path} treats a display name as identity`)
    assert.equal(pageImport.test(src), false, `${path} imports a page: a transition is a fact about the tenant, and a surface is where one is shown`)
  }
  // Every subject the corpus works on is chosen from a scan's own derivation.
  const corpusSrc = readFileSync('src/roadmap/fixtures/transitions.ts', 'utf8')
  const builders = corpusSrc.slice(corpusSrc.indexOf('const BUILDERS'), corpusSrc.indexOf('// ---- the corpus ----'))
  assert.equal(/f\.name|fixture\.name|\.label\b/.test(builders), false, 'a transition builder reads a fixture name')
  // And no transition needs a wall clock: time is the fixture's, injected.
  for (const path of ['src/roadmap/fixtures/transitions.ts', 'src/rescanDurability.test.ts']) {
    // Built rather than written, so the guard does not match its own bytes.
    const wallClock = new RegExp(['set' + 'Timeout', 'Date\\.now\\(\\)', 'new Date\\(\\)'].join('|'))
    assert.equal(wallClock.test(readFileSync(path, 'utf8')), false, `${path} reads the wall clock: a transition is deterministic or it is not a regression test`)
  }
})

/** Type-only guard: a key added to the union has to be added to the list the corpus builds. */
const _keys: readonly TransitionKey[] = TRANSITION_KEYS
void _keys
