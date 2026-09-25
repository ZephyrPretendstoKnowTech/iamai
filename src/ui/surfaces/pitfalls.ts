// The pitfalls a step names before the person acts (intent.md question 3; round
// 1, owner 2026-09-24): what the scan already knows will bite if the step is
// done as written, who or what it is, and the fix, as a Tasks Remaining card.
// A pitfall is specific or it isn't drawn: a card names its people, or the
// setting and how many it stops, and says what to do. Nothing is drawn where
// IAMAI could not read, and nothing on a finished step (a Completed step shows
// no remaining tasks).
//
// Each card reads the one reading its fact already has: MFA Readiness's setup
// checks (derive/readinessSetup.ts), Microsoft's SMS and voice retirement
// (derive/smsRetirement.ts), the people Require MFA for Everyone would prompt
// for the first time (derive/contentLists.ts unprovenIdsOf), and each person's
// next step on MFA Readiness (personNext.ts). None holds a turn-on: they
// inform, and the fix is the person's to make.
//
// The words are each step's own `pitfalls` block in docs/design/content.json.
//
// Pure: no DOM, no React, no network.
import type { Step } from '../../roadmap/types.ts'
import { CAMPAIGN_STEP_ID } from '../../roadmap/followUp.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { app, stepById } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import { tenantSetupChecks } from '../../derive/readinessSetup.ts'
import { readinessContextOf } from '../../derive/readinessContext.ts'
import { SMS_RETIREMENT_DATES, smsRetirementOf } from '../../derive/smsRetirement.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { unprovenIdsOf } from '../../derive/contentLists.ts'
import { personLines } from './personNext.ts'
import { personLabels } from '../../names.ts'
import type { ReadinessTile } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'

const MFA_EVERYONE_STEP_ID = 's-goal-mfa-all-users'

type Words = Record<string, string>
const wordsOf = (step: Step): Words => ((contentStepFor(step) as unknown as { pitfalls?: Words }).pitfalls ?? {})
// A card draws no bold: a line the procedures share, as plain text.
const plain = (s: string): string => s.replace(/\*\*/g, '')

/** How a card opens another step, handed in by the contract (stepContract.ts stepLink), so this module imports no value from it. */
export type StepLinkOf = (id: string, title: string) => ReadinessTile['link']

/** The step's pitfall cards, open steps only; none on a step that names none. */
export function pitfallTilesOf(step: Step, ctx: StepVarContext, satisfied: boolean, stepLink: StepLinkOf): ReadinessTile[] {
  if (satisfied || step.status === 'done' || step.status === 'skipped' || step.state.setAside) return []
  if (step.id === CAMPAIGN_STEP_ID) return campaignPitfalls(step, ctx)
  if (step.id === MFA_EVERYONE_STEP_ID) return mfaEveryonePitfalls(step, ctx, stepLink)
  if ((step.methodShort ?? []).length > 0) return methodShortPitfalls(step, ctx)
  return []
}

/** The shared words of a card naming people short of a method (pages.app.plan.stepContract.methodGate). */
const GATE = (app.plan as unknown as { stepContract: { methodGate: Record<string, string> } }).stepContract.methodGate

/**
 * A risk step whose policy asks for a strength (owner decision 11, 2026-09-25):
 * each person it reaches who holds nothing it accepts, with MFA Readiness's next
 * step, and the page that lists them (roadmap/generate.ts Step.methodShort). It
 * informs and holds nothing.
 */
function methodShortPitfalls(step: Step, ctx: StepVarContext): ReadinessTile[] {
  const ids = step.methodShort ?? []
  return [{ key: 'pitfall:no-accepted-method', label: GATE.methodShortLabel, tone: 'warn', value: fillText(GATE.methodShortValue, { n: ids.length }), note: GATE.methodShortNote, names: personLines(ctx, ids), link: { label: GATE.readinessLink, href: `#/readiness/step/${step.id}` } }]
}

/**
 * Prepare Your Team for MFA:
 * - Temporary Access Pass off, where people with no method need one to register
 *   (MFA Readiness's own setup check, and its count);
 * - the people whose only method is a text or a call, named with MFA
 *   Readiness's next step: Microsoft retires both (smsRetirement.ts), and anyone
 *   left with nothing else then meets a blocking passkey prompt.
 */
function campaignPitfalls(step: Step, ctx: StepVarContext): ReadinessTile[] {
  const W = wordsOf(step)
  const out: ReadinessTile[] = []
  const view = readinessView(ctx.snapshot, ctx.now, ctx.mapping)
  const tap = tenantSetupChecks(ctx.snapshot, view).find((c) => c.key === 'tap')
  if (tap?.outcome === 'fail' && tap.affects > 0) {
    out.push({ key: 'pitfall:tap-off', label: W.tapOffLabel, tone: 'warn', value: fillText(W.tapOffValue, { n: tap.affects }), note: plain(fillText(W.tapOffNote, {})) })
  }
  const windowStart = readinessContextOf(ctx.snapshot, ctx.mapping, ctx.now).windowStart
  const textOnly = smsRetirementOf(ctx.snapshot, step.preparation?.ids ?? [], windowStart).people.filter((p) => p.onlySmsVoice).map((p) => p.userId)
  if (textOnly.length > 0) {
    out.push({ key: 'pitfall:text-only', label: W.textOnlyLabel, tone: 'warn', value: fillText(W.textOnlyValue, { n: textOnly.length }), note: fillText(W.textOnlyNote, { smsEveryone: absoluteDate(SMS_RETIREMENT_DATES.everyone), smsAdmins: absoluteDate(SMS_RETIREMENT_DATES.adminsAndExternal) }), names: personLines(ctx, textOnly) })
  }
  return out
}

/**
 * Require MFA for Everyone, while it is not On: the people who hold a method it
 * accepts and have no MFA sign-in in the last 30 days. Its first prompt would be
 * the first time they use it, and a phone that has gone since is a lockout
 * found on turn-on day. Each is named with MFA Readiness's next step, and the
 * card opens the step that sets them up.
 */
function mfaEveryonePitfalls(step: Step, ctx: StepVarContext, stepLink: StepLinkOf): ReadinessTile[] {
  if (step.state.lifecycle === 'enforced') return []
  const W = wordsOf(step)
  const out: ReadinessTile[] = []
  const ids = unprovenIdsOf({ snapshot: ctx.snapshot, mapping: ctx.mapping, now: ctx.now })
  if (ids.length > 0) {
    const campaign = stepById[CAMPAIGN_STEP_ID]?.title ?? CAMPAIGN_STEP_ID
    out.push({ key: 'pitfall:unproven', label: W.unprovenLabel, tone: 'warn', value: fillText(W.unprovenValue, { n: ids.length }), note: plain(fillText(W.unprovenNote, {})), names: personLines(ctx, ids), link: stepLink(CAMPAIGN_STEP_ID, campaign) })
  }
  // The accounts MFA Readiness sets aside as scripts: outside the campaign, inside
  // this policy. The scan cannot tell a script from a person at PowerShell, so the
  // note gives the fix for each, and the card names them only.
  const labels = personLabels(ctx.snapshot.users, { address: true })
  const scripts = readinessView(ctx.snapshot, ctx.now, ctx.mapping).rows.filter((r) => r.explained === 'script').map((r) => labels.get(r.user.id) ?? ctx.nameOf(r.user.id))
  if (scripts.length > 0) out.push({ key: 'pitfall:script', label: W.scriptLabel, tone: 'warn', value: fillText(W.scriptValue, { n: scripts.length }), note: W.scriptNote, names: scripts })
  return out
}
