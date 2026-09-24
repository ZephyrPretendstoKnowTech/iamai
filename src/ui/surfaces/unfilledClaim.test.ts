// R4: a claim that cannot be filled says so, and never falls through to its own
// negation.
//
// The Who section of a step is a set of slots. Each slot holds one sentence: a
// claim about what the scan read, or — where it read the tenant and found
// nothing — the claim's negation. The two used to be chosen by different gates.
// whoEvidenceLines decided which lines *applied*, and each caller then dropped
// the ones that were not whole. A claim whose people were in hand but whose
// sentence named a date the plan does not hold was therefore dropped after the
// negation had already been let through, and the slot printed the opposite of
// what had been read: "Nobody used a legacy protocol since Jul 29, 2026" on a
// tenant whose own step named the three accounts that had.
//
// The gate is one gate now, and the rule below is the point of this file: the
// negation stands only where the tenant was read and found clean. The instances
// that remain are the ones the rule alone does not reach; the rule is what
// stops the next one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { WHO_UNRESOLVED, whoEvidenceLines, whoLeadTemplate } from './stepExport.ts'
import { boardReadingsOf, laneViewOf, prerequisiteLabelFor, readinessBlockersOf } from './planBoard.ts'
import { stepBodyOf } from './stepBody.ts'
import { whoBlocks } from './whoBlocks.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepById } from '../../content/content.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { listCountVars, missingVars, whole } from '../../content/render.ts'
import type { Step } from '../../roadmap/types.ts'

type Who = Record<string, unknown>
type Ex = Record<string, unknown>

const ctxFor = (f: ReturnType<typeof fixture>, r: ReturnType<typeof runFixture>): StepVarContext => ({
  snapshot: f.snapshot,
  mapping: f.mapping,
  nameOf: (id: string) => r.input.names!.label(id),
  signature: 'IT',
  operatorId: f.operatorId,
  now: f.snapshot.asOf,
  groups: f.groups,
  naming: r.coverage.organisation.naming,
})

/** Every sentence the step's Who section draws, lead included, on this tenant. */
function whoSentences(fixtureName: string, stepId: string): { lead: string | null; lines: string[]; names: string[] } {
  const f = fixture(fixtureName as never)
  const r = runFixture(f)
  const ctx = ctxFor(f, r)
  const step = r.steps.find((s) => s.id === stepId || s.goalId === stepId)
  assert.ok(step, `${fixtureName} carries ${stepId}`)
  const ex = stepVars(step!, ctx) as Ex
  const who = whoOf(step!)
  const { inline, held } = whoBlocks(who, ex)
  return {
    lead: whoLeadTemplate(who, ex),
    lines: [...inline, ...held].map((b) => b.lead),
    names: [...inline, ...held].flatMap((b) => b.names),
  }
}

const listKeysOf = (line: string): string[] => [...line.matchAll(/\{list:([a-zA-Z0-9_]+)\}/g)].map((m) => m[1])

/** The content step's Who, resolved the way the step body resolves it. */
const whoOf = (step: Step): Who => ((contentStepFor(step) ?? {}) as { who?: Who }).who ?? {}

/**
 * The keys whoEvidenceLines does not gate: the lead is drawn by whoLeadLine,
 * and the campaign's rungs and notes are drawn beside the blocks. The negation
 * stands in for one of the evidence sentences, so those are what it is tested
 * against.
 */
const NOT_EVIDENCE = ['$comment', 'lead', 'leadWhen', 'leadUndated', 'groups', 'adminsNote', 'timeline', 'overlap', 'none']

// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------

/**
 * The rule-shaped test. For every step whose Who has a negation branch, take
 * each claim the content writes with a list of people in it, put people in that
 * list and leave the rest of the sentence's variables unfilled — the shape the
 * legacy, geography and token-protection steps were all in — and assert the
 * negation does not render. Instances come back; this does not.
 */
test('a who-line never renders its negation because a claim could not be filled', () => {
  let checked = 0
  for (const [id, raw] of Object.entries(stepById)) {
    const who = (raw as { who?: Who }).who
    const none = who?.none
    if (!who || typeof none !== 'string') continue
    for (const [key, value] of Object.entries(who)) {
      if (NOT_EVIDENCE.includes(key)) continue
      const lines = Array.isArray(value) ? (value as string[]) : typeof value === 'string' ? [value] : []
      for (const line of lines) {
        const lists = listKeysOf(line)
        if (lists.length === 0) continue
        // The claim's people are in hand; nothing else about the sentence is.
        const ex: Ex = Object.fromEntries(lists.map((k) => [k, ['Someone Real']]))
        if (missingVars(line, listCountVars(line, ex) as Ex).length === 0) continue
        checked += 1
        const out = whoEvidenceLines(who, ex)
        assert.ok(
          !out.includes(none),
          `${id} who.${key}: the claim "${line.slice(0, 60)}…" could not be filled and the step answered with its own negation, "${none}"`,
        )
        // The slot says so - or holds the claim itself, in the undated form the
        // content writes for a line whose one hole was the day it names
        // (who.<key>Undated, stepExport.ts whoEvidenceLines): the people are
        // what was read, and the day is not.
        const forms = (who[`${key}Undated`] ?? {}) as Record<string, unknown>
        const undated: unknown = forms[String(lines.indexOf(line))]
        assert.ok(out.includes(WHO_UNRESOLVED) || (typeof undated === 'string' && out.includes(undated)), `${id} who.${key}: the slot the claim would have taken says nothing at all`)
      }
    }
  }
  assert.ok(checked >= 5, `the corpus of claim-with-a-negation steps is ${checked}; the rule is not being exercised`)
})

/**
 * The other half of the same rule: the negation is still drawn where the tenant
 * was read and found clean. "I don't know" must not replace "nothing here".
 */
test('a who-line still renders its negation where the tenant was read and found clean', () => {
  const who = (stepById['block-legacy-auth'] as { who: Who }).who
  const out = whoEvidenceLines(who, { from: 'Jul 29, 2026', legacyUsers: [] })
  assert.deepEqual(out, ['Nobody signed in with legacy authentication in the last 30 days.'])
})

/** One gate, not two: every sentence whoEvidenceLines returns is whole, so no caller can drop one and leave a slot for the negation. */
test('whoEvidenceLines returns only sentences that render', () => {
  for (const name of ['small', 'demo', 'demo-week2', 'hostile']) {
    const f = fixture(name as never)
    const r = runFixture(f)
    const ctx = ctxFor(f, r)
    for (const step of r.steps) {
      const who = whoOf(step)
      if (Object.keys(who).length === 0) continue
      const ex = stepVars(step, ctx) as Ex
      for (const line of whoEvidenceLines(who, ex)) {
        assert.ok(whole(line, listCountVars(line, ex) as Ex), `${name} ${step.id}: "${line.slice(0, 70)}…" is returned with a hole in it`)
      }
    }
  }
})

// ---------------------------------------------------------------------------
// The instances
// ---------------------------------------------------------------------------

/**
 * Instance 1, the root. Block Legacy Authentication on the demo tenant: three
 * accounts used a legacy protocol, the step is already enforced so there is no
 * date to fix them before, and the step said nobody had.
 */
test('the legacy-authentication step does not say nobody while it holds three accounts that did', () => {
  for (const name of ['demo', 'demo-week2', 'small']) {
    const f = fixture(name as never)
    const r = runFixture(f)
    const step = r.steps.find((s) => s.goalId === 'block-legacy-auth')!
    const ex = stepVars(step, ctxFor(f, r)) as Ex
    assert.ok(Array.isArray(ex.legacyUsers) && (ex.legacyUsers as string[]).length > 0, `${name} has accounts on a legacy protocol`)
    assert.equal(ex.enforce, undefined, `${name}: and no date to fix them before, which is what used to drop the claim`)
    const { lines, names } = whoSentences(name, 'block-legacy-auth')
    assert.ok(!lines.some((l) => /Nobody signed in with legacy authentication/.test(l)), `${name}: ${JSON.stringify(lines)}`)
    // The claim itself, in its undated form (who.evidenceUndated): the accounts
    // the scan read, and no day to fix them before. It used to say only that
    // IAMAI could not finish the line, though it had read every account in it.
    assert.ok(lines.some((l) => /signed in with legacy authentication in the last 30 days/.test(l) && !/before/.test(l)), `${name}: the slot names the accounts, without a day: ${JSON.stringify(lines)}`)
    for (const who of ex.legacyUsers as string[]) assert.ok(names.includes(who), `${name}: ${who} is not named`)
    assert.ok(!lines.includes(WHO_UNRESOLVED), `${name}: the slot says IAMAI could not finish a line it read`)
  }
})

/**
 * Instance 2. Require MFA for Guests on a tenant with no guests in the
 * directory: a cross-tenant sign-in in the records named a member of staff, and
 * the step listed that employee as somebody the guest policy reaches.
 */
test('a guest step on a tenant with no guests names nobody', () => {
  const f = fixture('small')
  f.snapshot = { ...f.snapshot, users: f.snapshot.users.slice(0, 16) } as never
  const r = runFixture(f)
  const guests = f.snapshot.users.filter((u) => u.userType === 'guest')
  assert.equal(guests.length, 0, 'the sliced tenant holds no guests at all')
  const step = r.steps.find((s) => s.goalId === 'guests-mfa')!
  const ex = stepVars(step, ctxFor(f, r)) as Ex
  assert.deepEqual(ex.guestsWithState, [], 'and no account is offered as one')
  const who = (stepById['guests-mfa'] as { who: Who }).who
  const { inline, held } = whoBlocks(who, ex)
  assert.deepEqual([...inline, ...held].flatMap((b) => b.names), [], 'the Who section names nobody')
})

// R4-38, as the owner settled it (walk list 4.x items 18, 51, 52 and 53): Turn
// Off Security Defaults completes on security defaults read off and on nothing
// else, and its Completion Criteria says only that. Its procedure — turn them
// off, then turn the four policies on in the same change — and its way back are
// the same in every state: Completed where the scan read them off after a plan
// saw them on, and open where it reads them on.
test('the security-defaults step claims only what completes it, and reads the same in every state', () => {
  const sd = stepById['s-prereq-security-defaults'] as unknown as { doneWhen: string[] }
  assert.deepEqual(sd.doneWhen, ['IAMAI reads security defaults as Disabled.'])
  const drawn = (name: 'small' | 'hostile' | 'messy') => {
    const f = fixture(name)
    const r = runFixture(f, { securityDefaultsSeenOnAt: '2026-08-01T00:00:00.000Z' })
    const step = r.steps.find((s) => s.id === 's-prereq-security-defaults')!
    const { readings, titleOf } = boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
    const lane = laneViewOf(readings.get(step.id)!, titleOf)
    const ctx = ctxFor(f, r)
    const b = stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(readings.get(step.id)!, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) })
    const lines = (b.artifacts.find((a) => a.id === 'portal')?.lines ?? []).filter((l): l is string => typeof l === 'string')
    return { lane, b, lines }
  }
  const on = drawn('messy')
  assert.notEqual(on.lane.lane, 'Completed', 'the premise: messy reads security defaults on')
  for (const name of ['small', 'hostile'] as const) {
    const off = drawn(name)
    assert.equal(off.lane.lane, 'Completed', `${name}: the premise: the step is complete on security defaults read off`)
    assert.deepEqual(off.b.contract.doneWhen, sd.doneWhen, `${name}: the Completion Criteria is not the step's one line`)
    assert.deepEqual(off.lines.slice(0, 3), on.lines.slice(0, 3), `${name}: the procedure changed with the state`)
    assert.equal(off.b.ifWrong, on.b.ifWrong, `${name}: the way back changed with the state`)
  }
  assert.deepEqual(on.b.contract.doneWhen, sd.doneWhen)
})

/**
 * The sweep, instance 5. Token protection claimed every Windows sign-in came
 * from a joined or registered device — on every tenant, because the list of
 * people it was the negation of was never produced at all.
 */
test('the token-protection step reads the devices it makes a claim about', () => {
  for (const name of ['demo', 'large']) {
    const f = fixture(name as never)
    const r = runFixture(f)
    const step = r.steps.find((s) => s.goalId === 'token-protection')!
    const ex = stepVars(step, ctxFor(f, r)) as Ex
    assert.ok(Array.isArray(ex.unboundUsers), `${name}: the list the claim is about is produced, not absent`)
    assert.ok((ex.unboundUsers as string[]).length > 0, `${name}: and it has people in it`)
    const { lines } = whoSentences(name, 'token-protection')
    assert.ok(!lines.some((l) => /came from a joined or registered device/.test(l)), `${name}: ${JSON.stringify(lines)}`)
  }
  // And where the records were read and held nobody, the negation names the
  // window it read, so a tenant with no records at all cannot inherit it.
  const who = (stepById['token-protection'] as { who: Who }).who
  assert.ok(String(who.none).includes('{from}'), 'the negation names the records window it was read from')
  assert.ok(whoEvidenceLines(who, { from: 'Jul 29, 2026', unboundUsers: [] }).includes(String(who.none)), 'records read and nobody in them: the negation stands')
  assert.ok(!whoEvidenceLines(who, { unboundUsers: [] }).includes(String(who.none)), 'no records read at all: it does not')
})

/**
 * The sweep, instance 7. "None matches the baseline's Modern MFA + TAP" is the
 * negation of a claim about the authentication strengths this tenant holds, and
 * it fired whenever no strength matched — including on a tenant whose strengths
 * section never read, where IAMAI had not looked at all. The step now declares
 * its own evidence unread and the slot says so, which is the same rule as the
 * other six and needs no second mechanism.
 */
test('the authentication-strength step does not say none matches when it never read the strengths', () => {
  const who = (stepById['s-prereq-auth-strength'] as { who: Who }).who
  const ex = { tenant: 'Contoso Pty Ltd', strengthName: 'Modern MFA + TAP', strengths: ['Passwordless MFA'] }
  const read = whoEvidenceLines(who, ex)
  assert.ok(read.some((l) => /None matches the baseline/.test(l)), `read and nothing matched: the negation stands — ${JSON.stringify(read)}`)
  const unread = whoEvidenceLines(who, { ...ex, evidenceNotRead: true })
  assert.ok(!unread.some((l) => /None matches the baseline/.test(l)), JSON.stringify(unread))
  assert.ok(unread.includes(WHO_UNRESOLVED), JSON.stringify(unread))
})
