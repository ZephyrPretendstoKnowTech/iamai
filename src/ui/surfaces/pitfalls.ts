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
// (derive/smsRetirement.ts), and each person's next step on MFA Readiness
// (personNext.ts). None holds a turn-on: they inform, and the fix is the
// person's to make.
//
// Pure: no DOM, no React, no network.
import type { Step } from '../../roadmap/types.ts'
import { CAMPAIGN_STEP_ID } from '../../roadmap/followUp.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import { tenantSetupChecks } from '../../derive/readinessSetup.ts'
import { readinessContextOf } from '../../derive/readinessContext.ts'
import { smsRetirementOf } from '../../derive/smsRetirement.ts'
import { personLines } from './personNext.ts'
import type { ReadinessTile } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'

type CampaignPitfallWords = { person: string; tapOffLabel: string; tapOffValue: string; tapOffNote: string; textOnlyLabel: string; textOnlyValue: string; textOnlyNote: string }

/** The step's pitfall cards, open steps only; none on a step that names none. */
export function pitfallTilesOf(step: Step, ctx: StepVarContext, satisfied: boolean): ReadinessTile[] {
  if (satisfied || step.status === 'done' || step.status === 'skipped' || step.state.setAside) return []
  if (step.id === CAMPAIGN_STEP_ID) return campaignPitfalls(step, ctx)
  return []
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
  const W = (contentStepFor(step) as unknown as { card: CampaignPitfallWords }).card
  const out: ReadinessTile[] = []
  const view = readinessView(ctx.snapshot, ctx.now, ctx.mapping)
  const tap = tenantSetupChecks(ctx.snapshot, view).find((c) => c.key === 'tap')
  if (tap?.outcome === 'fail' && tap.affects > 0) {
    // A card draws no bold: the procedure's line, as plain text.
    out.push({ key: 'pitfall:tap-off', label: W.tapOffLabel, tone: 'warn', value: fillText(W.tapOffValue, { n: tap.affects }), note: fillText(W.tapOffNote, {}).replace(/\*\*/g, '') })
  }
  const windowStart = readinessContextOf(ctx.snapshot, ctx.mapping, ctx.now).windowStart
  const textOnly = smsRetirementOf(ctx.snapshot, step.preparation?.ids ?? [], windowStart).people.filter((p) => p.onlySmsVoice).map((p) => p.userId)
  if (textOnly.length > 0) {
    out.push({ key: 'pitfall:text-only', label: W.textOnlyLabel, tone: 'warn', value: fillText(W.textOnlyValue, { n: textOnly.length }), note: W.textOnlyNote, names: personLines(ctx, textOnly, W.person) })
  }
  return out
}
