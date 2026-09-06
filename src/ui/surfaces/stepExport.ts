// The content-driven view of a step for the exports (prompt 53 queue item 7):
// what the calendar entry, the prompt pack, the grounding bundle and the plan
// file say about a step is what the step says on screen — the content file's
// title, why and done-when lines filled with the tenant's values, and the
// portal-line translator's What to do — never the v2 engine's own prose
// (what-changes, exit criteria, rings, failure modes), whose vocabulary the
// contract forbids. A step the content file has no entry for (a free-tier
// ladder rung) keeps its own title and its engine lines, as the screen does.
//
// Pure: no DOM, no network. Runs in Node tests and in the browser.
import type { ExportStep, Step } from '../../roadmap/types.ts'
import { content } from '../../content/content.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { doneWhenTemplates } from './doneWhen.ts'
import { fillText, listCountVars, whole } from '../../content/render.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepPortalLines, portalNamesFor } from './stepPortal.ts'
import { instructionsHeld } from './stepInstructions.ts'
import { stepContract } from './stepContract.ts'
import { createsNewPolicy, heldByTitle, implementationOffered, missingObjects } from './stepJson.ts'
import { awaitingDeployment, enforcementUnearned, forecastEnforcement } from '../../roadmap/forecast.ts'
import { isPreserved, unavailableReason } from '../../roadmap/operations.ts'
import { list } from '../../copy/statements.ts'
import { answerOf, effectLine } from '../../roadmap/answers.ts'

export type { ExportStep }

/** The shared lines this module fills; the words live in content.json, as every other line's do. */
const SHARED = content.shared as unknown as { commsForecastNote: string }

/**
 * The step's Dates line: a change to an existing policy announces and changes
 * (shared.datesChange); a new policy is deployed in report-only first and
 * enforced after (shared.datesNew).
 *
 * The operation decides (stepJson.ts createsNewPolicy), and it decides first: a
 * step whose content was written for the change case is still a create in a
 * tenant that has no such policy, and a create's dates are the report-only
 * deployment and the enforcement it earns, never "Announce · Change" with the
 * report-only stage missing from between them.
 *
 * Foundation B decides before either of them (roadmap/forecast.ts
 * `awaitingDeployment`, `enforcementUnearned`). While the policy is not deployed
 * there is nothing in the tenant to enforce and nothing has been watched, so the
 * plan states the report-only deployment it can keep and dates no enforcement
 * (shared.datesDeploy). The enforcement date the schedule holds is the roadmap's
 * forecast for a window that has not opened; printing it beside a policy that
 * does not exist announces a change on a day nothing can have earned.
 *
 * The window opening does not date the enforcement either. A policy two days
 * into report-only with nothing left to submit but the enforcement read
 * "Announce Sep 6 · Change Sep 7", while the row beside it read "ready Aug 29"
 * and its Done-when lines named nine people the records had not seen — the same
 * step answering "when" three ways, one of them a change dated on a day nothing
 * had earned. So the line states the two days Foundation B does hold: the day
 * the policy entered report-only, and the review milestone its own gates derive
 * (shared.datesObserve). The enforcement date returns, as a date rather than a
 * forecast, once the evidence makes it `ready-to-enforce`. A report-only policy
 * with a real correction still to make keeps its change dates: that patch leaves
 * it in report-only, it is work for today, and it is not this case.
 */
export function datesLineFor(step: Step, cs: Record<string, unknown>): string | null {
  if (awaitingDeployment(step)) return '{datesDeploy}'
  if (enforcementUnearned(step)) return '{datesObserve}'
  if (createsNewPolicy(step)) return '{datesNew}'
  if (step.kind === 'adjust') return '{datesChange}'
  return typeof cs.dates === 'string' ? cs.dates : null
}

/**
 * The step's If-it-goes-wrong line, by the same rule and for the same reason:
 * putting a created policy back means setting it to report-only or deleting it
 * (shared.policyIfWrong), because there were no settings to restore. The change
 * line is kept for a step that changes a policy the tenant already had —
 * "delete it" would delete the tenant's own policy.
 */
export function ifWrongLineFor(step: Step, cs: Record<string, unknown>): string | null {
  const line = typeof cs.ifWrong === 'string' ? cs.ifWrong : null
  return line === '{changeIfWrong}' && createsNewPolicy(step) ? '{policyIfWrong}' : line
}

/** The step as the screen says it, for an export. */
export function stepExportView(step: Step, ctx: StepVarContext): ExportStep {
  const cs = contentStepFor(step) as Record<string, any> | undefined
  if (!cs) {
    // No content entry (the free-tier ladder): the screen renders no body for
    // it, so the export carries its title and nothing of the engine's prose.
    return { title: step.plainTitle || step.title, why: '', whatToDo: [], doneWhen: [], ifWrong: null, dates: null }
  }
  const ex = stepVars(step, ctx)
  const names = portalNamesFor(ctx, ex, String(cs.title))
  const portal = cs.kind === 'policy' ? stepPortalLines(step, names) : null
  // The screen's rule, in the export: where no implementation is offered the
  // export carries the explanation, never the instructions
  // (roadmap/operations.ts). The reasons a policy cannot be implemented — an
  // object it names is missing, a pair the plan cannot match, a baseline that
  // contradicts itself, a final scope that reaches the emergency accounts or
  // cannot be shown not to — each carry their own next action and none of them
  // carries a rollout.
  const reason = cs.kind === 'policy' ? unavailableReason(step) : null
  // The step has an implementation and today is not the day to run it: its
  // policy is in report-only and the only thing left to submit is the
  // enforcement the window has not earned (roadmap/forecast.ts). The artifacts
  // carry what the screen carries — the next action, which is to keep watching —
  // and none of the instructions for making the change.
  const unearned = cs.kind === 'policy' && enforcementUnearned(step)
  // The one reading the screen makes too (stepInstructions.ts): while an
  // authority holds the change, the lead and the "before" lines say nothing on
  // either surface.
  const held = instructionsHeld(step, cs)
  const suppressed = cs.kind === 'policy' && !implementationOffered(step)
  const waiting = reason === 'missing-object'
  const unmatched = reason === 'unmatched-pair'
  const conflicted = reason === 'baseline-conflict'
  const noOperation = reason === 'no-operation'
  const emergencyUnsafe = reason === 'unsafe-emergency-access'
  const emergencyUnproven = reason === 'unverified-emergency-exclusion'
  const escapeHatch = reason === 'escape-hatch-unverified'
  const readinessHeld = reason === 'readiness-unmet'
  const inPlace = suppressed && reason === null && isPreserved(step)
  const w = (cs.whatToDo ?? {}) as Record<string, unknown>
  const lines: string[] = []
  // The lead and the "before" lines are part of implementing the policy — a
  // setting to change before it is created. While it cannot be written they say
  // nothing here either, on any surface that reads this view (the exports, the
  // print, the prompts, the grounding bundle): the next action stands alone.
  if (!held && typeof w.lead === 'string' && whole(w.lead, ex)) lines.push(fillText(w.lead, ex))
  if (!held && Array.isArray(w.before)) for (const l of w.before) if (whole(l, ex)) lines.push(fillText(l, ex))
  if (portal && portal.length > 0) lines.push(...portal)
  else if (waiting) lines.push(fillText(String((content.pages.app as Record<string, Record<string, string>>).plan.jsonWaits), { steps: list([...new Set(missingObjects(step).map((m) => m.title))]), tenant: String(ex.tenant ?? '') }))
  else if (unmatched) lines.push(fillText(String((content.pages.app as Record<string, Record<string, string>>).plan.pairUnmatched), { tenant: String(ex.tenant ?? '') }))
  else if (conflicted && typeof cs.baselineConflict === 'string') lines.push(fillText(cs.baselineConflict, ex))
  else if (noOperation) lines.push(fillText(String((content.pages.app as Record<string, Record<string, string>>).plan.noOperation), { tenant: String(ex.tenant ?? '') }))
  else if (emergencyUnsafe) lines.push(fillText(String((content.pages.app as Record<string, Record<string, string>>).plan.emergencyUnsafe), { tenant: String(ex.tenant ?? '') }))
  else if (emergencyUnproven) lines.push(fillText(String((content.pages.app as Record<string, Record<string, string>>).plan.emergencyUnproven), { tenant: String(ex.tenant ?? '') }))
  else if (escapeHatch) lines.push(fillText(String((content.pages.app as Record<string, Record<string, string>>).plan.escapeHatchHeld), { tenant: String(ex.tenant ?? ''), steps: heldByTitle(step) }))
  else if (readinessHeld) lines.push(fillText(String((content.pages.app as Record<string, Record<string, string>>).plan.readinessHeld), { tenant: String(ex.tenant ?? ''), ...(step.action.readinessGate ?? {}) }))
  else if (inPlace) lines.push(String((content.pages.app as Record<string, Record<string, string>>).plan.inPlaceKeep))
  else if (!unearned && Array.isArray(w.steps)) for (const l of w.steps) if (whole(l, ex)) lines.push(fillText(l, ex))
  // The next action the screen states, in the artifact. Where the step's content
  // carries a lead it is already the first line above and the contract's action
  // is that same sentence; where it carries none the contract falls back to
  // Foundation B's milestone ("Create the policy in report-only."), and without
  // this the calendar entry, the prompt pack and the bundle began at the portal
  // path with the operation itself never said. Read from the frozen Step
  // Contract, not decided again here.
  if (reason === null) {
    const action = stepContract(step, ctx).whatToDo.text
    if (action.trim().length > 0 && !lines.includes(action)) lines.unshift(action)
  }
  // Nothing that implies the policy can be rolled out while it cannot be written:
  // no completion criteria, no rollback, no dates.
  const doneWhen = reason !== null
    ? []
    : doneWhenTemplates(step, (cs.doneWhen ?? []) as unknown[])
        .filter((x) => whole(x, ex))
        .map((x) => fillText(x, ex))
  return {
    title: String(cs.title),
    why: fillText(cs.why, ex),
    whatToDo: lines,
    doneWhen,
    ifWrong: reason === null && ifWrongLineFor(step, cs) && whole(ifWrongLineFor(step, cs), ex) ? fillText(ifWrongLineFor(step, cs), ex) : null,
    dates: reason === null && whole(datesLineFor(step, cs), ex) && datesLineFor(step, cs) ? fillText(datesLineFor(step, cs), ex) : null,
  }
}

const truthy = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.length > 0 : typeof v === 'number' ? v !== 0 : Boolean(v))
const listKeys = (line: string): string[] => [...line.matchAll(/\{list:([^}]+)\}/g)].map((m) => m[1])

/**
 * The who-line evidence lines that apply to this tenant, as the step renders
 * them (the one gate for the screen and the exports): the existing-coverage
 * line only when a policy delivers the goal; a line with a list only when the
 * list has people; a line with {n} and no list not at zero; the none branch
 * only when no usage line renders (the existing-coverage line does not count).
 */
export function whoEvidenceLines(who: Record<string, unknown>, ex: Record<string, unknown>): string[] {
  const out: string[] = []
  let none: string | null = null
  const coverage = String((content.shared as Record<string, unknown>).existingCoverage)
  for (const [k, v] of Object.entries(who)) {
    if (['lead', 'groups', 'adminsNote', 'timeline', 'overlap'].includes(k)) continue
    if (k === 'none') {
      none = typeof v === 'string' ? v : null
      continue
    }
    const arr = Array.isArray(v) ? (v as string[]) : typeof v === 'string' ? [v] : []
    for (let line of arr) {
      if (line === '{existingCoverage}') {
        if (!truthy(ex.existingPolicies)) continue
        line = coverage
      }
      const lk = listKeys(line)
      if (lk.length > 0 && lk.every((k2) => !truthy(ex[k2]))) continue
      if (lk.length === 0 && line.includes('{n}') && (ex.n ?? 1) === 0) continue
      out.push(line)
    }
  }
  if (none !== null && !out.some((line) => line !== coverage && whole(line, ex))) out.push(none)
  return out
}

/** What a step's Tell your people box says, with the tenant's values. */
export type CommsView = { salutation: string; body: string; extra: string[]; signature: string }

/**
 * The step's email, as the screen shows it (one rule for the screen, the copy
 * button and the exports): the body keyed on the tenant's state, the extra
 * lines an answer or the state adds (each only when whole), the salutation
 * and the signature. The campaign carries a second body for a tenant where
 * Require MFA for Everyone is already in place (comms.bodyMfaInPlace, with
 * comms.extraMfaInPlace), the passkey version; otherwise comms.body.
 *
 * The step's own enforcement day reaches the email through `{enforceLong}`, and
 * what that day is worth is not the email's decision (roadmap/forecast.ts
 * `forecastEnforcement`). While it is the roadmap's projection the message says
 * so, in its own paragraph under the one that states the day, so the email and
 * the Dates line above it answer "when" the same way instead of the line
 * withholding an enforcement date the email underneath commits to. Once
 * Foundation B's evidence has earned the date the email states it plainly, with
 * nothing added — the same words the prompt pack's draft carries
 * (roadmap/prompts.ts `announcementDraft`).
 */
export function commsFor(cs: Record<string, unknown>, ex: Record<string, unknown>, step: Step): CommsView | null {
  const comms = (cs.comms ?? null) as Record<string, unknown> | null
  if (!comms) return null
  // A step already in place asks nobody to do anything: no email (stepVars stepDone).
  if (ex.stepDone) return null
  const inPlace = Boolean(ex.mfaInPlace) && typeof comms.bodyMfaInPlace === 'string'
  const body = inPlace ? comms.bodyMfaInPlace : comms.body
  // The hole rule, once, for the screen, the copy box, the exports and the
  // tests' lines: the email renders whole or not at all, like any other line.
  if (![comms.salutation, body, comms.signature].every((part) => typeof part === 'string' && whole(part, ex))) return null
  const extraRaw = inPlace && comms.extraMfaInPlace !== undefined ? comms.extraMfaInPlace : comms.extra
  const extraTemplates = (Array.isArray(extraRaw) ? extraRaw : extraRaw === undefined || extraRaw === null ? [] : [extraRaw]).filter((l): l is string => typeof l === 'string' && whole(l, ex))
  // Only a message that actually states this step's enforcement day is
  // qualified: a template that names no date has nothing to qualify, and a
  // committed date needs no qualifying.
  const forecast = forecastEnforcement(step) && [body as string, ...extraTemplates].some((t) => t.includes('{enforceLong}'))
  const extra = extraTemplates.map((l) => fillText(l, ex))
  if (forecast) extra.push(SHARED.commsForecastNote)
  return { salutation: fillText(comms.salutation, ex), body: fillText(body, ex), extra, signature: fillText(comms.signature, ex) }
}

/**
 * A decision block's one line under its label: the help while the decision is
 * open ("Until you decide, …"), or the effect of the answer once it is made
 * (answers.ts effectLine) — never both (the device decision showed its open
 * line under its answer). One rule for the screen and the rendered lines.
 */
export function decisionLine(d: Record<string, unknown>, answer: { index: number } | null): unknown {
  return answer ? effectLine(d.effect, answer) : d.help
}

/**
 * The manager's three sentences, with the clause a step adds when the records
 * show nobody using what it blocks (more.managerNone, under its `applies`, E9);
 * null when the manager line is not whole.
 */
export function managerText(cs: Record<string, unknown>, ex: Record<string, unknown>): string | null {
  const more = (cs.more ?? {}) as Record<string, unknown>
  if (typeof more.manager !== 'string' || !whole(more.manager, ex)) return null
  const none = more.managerNone as { text?: unknown; applies?: unknown } | undefined
  const applies = none && typeof none.text === 'string' && (typeof none.applies !== 'string' || Boolean(ex[none.applies])) && whole(none.text, ex)
  return applies ? `${fillText(more.manager, ex)} ${fillText(none!.text, ex)}` : fillText(more.manager, ex)
}

/**
 * Every line the step body renders on screen, filled, for the tests that read
 * rendered text without a DOM: the why, the who lines, the decision's words,
 * What to do, Done when, If wrong, the dates, More and the Tell your people box.
 * The gate is the screen's: a line renders only when it is whole.
 */
export function stepLines(step: Step, ctx: StepVarContext): string[] {
  const cs = contentStepFor(step) as Record<string, any> | undefined
  if (!cs) return [step.plainTitle || step.title]
  const ex = stepVars(step, ctx) as Record<string, unknown>
  const out: string[] = []
  const add = (line: unknown, vals: Record<string, unknown> = ex): void => {
    if (typeof line === 'string' && whole(line, vals)) out.push(fillText(line, vals))
  }
  const view = stepExportView(step, ctx)
  out.push(view.title, view.why, ...view.whatToDo, ...view.doneWhen)
  if (view.ifWrong) out.push(view.ifWrong)
  if (view.dates) out.push(view.dates)
  add(cs.changeLine)
  add(cs.partner)
  const who = (cs.who ?? {}) as Record<string, unknown>
  add(who.lead)
  add(who.adminsNote)
  // The evidence lines as the step gates them; a line that counts and lists counts its own list (render.ts listCountVars).
  for (const line of whoEvidenceLines(who, ex)) add(line, listCountVars(line, ex) as Record<string, unknown>)
  // The campaign's people lists: each bucket's line, only where the bucket has people (as the screen).
  for (const [gk, gl] of Object.entries((who.groups ?? {}) as Record<string, unknown>)) {
    const items = ex[gk]
    if (Array.isArray(items) && items.length > 0) add(gl, { ...ex, n: items.length })
  }
  const d = (cs.decision ?? {}) as Record<string, unknown>
  add(d.label)
  add(decisionLine(d, answerOf(ctx.mapping, step.id, 'decision')))
  for (const o of Array.isArray(d.options) ? d.options : []) add(o)
  const w = (cs.whatToDo ?? {}) as Record<string, unknown>
  if (ex.createIfNeeded && typeof w.createIfNeeded === 'string') add(w.createIfNeeded)
  if ((ex.needsCreate || ex.createIfNeeded) && Array.isArray(w.create)) for (const l of w.create) add(l)
  const fixes = (w.checkFixes ?? {}) as Record<string, string>
  for (const [key, vals] of (Array.isArray(ex.failingChecks) ? ex.failingChecks : []) as [string, Record<string, unknown>][]) add(fixes[key], { ...ex, ...vals })
  const more = (cs.more ?? {}) as Record<string, unknown>
  for (const r of Array.isArray(more.risks) ? (more.risks as { text?: string }[]) : []) add(r.text)
  for (const l of Array.isArray(more.helpDesk) ? more.helpDesk : []) add(l)
  const manager = managerText(cs, ex)
  if (manager) out.push(manager)
  const comms = commsFor(cs, ex, step)
  if (comms) out.push(comms.salutation, comms.body, ...comms.extra, comms.signature)
  return out
}

/** The step's copy boxes as the screen renders them: Tell your people, For the help desk, For your manager, each followed by the adapt line. */
export function copyBoxes(step: Step, ctx: StepVarContext): { kind: 'comms' | 'helpDesk' | 'manager'; text: string; after: string }[] {
  const cs = contentStepFor(step) as Record<string, any> | undefined
  if (!cs) return []
  const ex = stepVars(step, ctx) as Record<string, unknown>
  const after = String((content.shared as Record<string, unknown>).adaptLine)
  const out: { kind: 'comms' | 'helpDesk' | 'manager'; text: string; after: string }[] = []
  const comms = commsFor(cs, ex, step)
  if (comms) out.push({ kind: 'comms', text: [comms.salutation, comms.body, ...comms.extra, comms.signature].join('\n\n'), after })
  const more = (cs.more ?? {}) as Record<string, unknown>
  const helpDesk = (Array.isArray(more.helpDesk) ? more.helpDesk : []).filter((x) => whole(x, ex))
  if (helpDesk.length > 0) out.push({ kind: 'helpDesk', text: helpDesk.map((x) => fillText(x, ex)).join('\n'), after })
  const manager = managerText(cs, ex)
  if (manager) out.push({ kind: 'manager', text: manager, after })
  return out
}
