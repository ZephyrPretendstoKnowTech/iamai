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
import { stepPortalLines, stepPortalLinesFromBody, portalNamesFor } from './stepPortal.ts'

export type { ExportStep }

/** The step's Dates line: a change to an existing policy announces and changes (shared.datesChange); a new policy has its own line. */
export function datesLineFor(step: Step, cs: Record<string, unknown>): string | null {
  if (step.kind === 'adjust') return '{datesChange}'
  return typeof cs.dates === 'string' ? cs.dates : null
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
  const portal = cs.kind === 'policy' ? (stepPortalLines(step.goalId, names) ?? (step.floor && step.action.json ? stepPortalLinesFromBody(step.action.json, names) : null)) : null
  const w = (cs.whatToDo ?? {}) as Record<string, unknown>
  const lines: string[] = []
  if (typeof w.lead === 'string' && whole(w.lead, ex)) lines.push(fillText(w.lead, ex))
  // The content's leading "before" lines stay above the portal lines, as on screen.
  if (Array.isArray(w.before)) for (const l of w.before) if (whole(l, ex)) lines.push(fillText(l, ex))
  if (portal && portal.length > 0) lines.push(...portal)
  else if (Array.isArray(w.steps)) for (const l of w.steps) if (whole(l, ex)) lines.push(fillText(l, ex))
  const doneWhen = doneWhenTemplates(step, (cs.doneWhen ?? []) as unknown[])
    .filter((x) => whole(x, ex))
    .map((x) => fillText(x, ex))
  return {
    title: String(cs.title),
    why: fillText(cs.why, ex),
    whatToDo: lines,
    doneWhen,
    ifWrong: cs.ifWrong && whole(cs.ifWrong, ex) ? fillText(cs.ifWrong, ex) : null,
    dates: whole(datesLineFor(step, cs), ex) && datesLineFor(step, cs) ? fillText(datesLineFor(step, cs), ex) : null,
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
 */
export function commsFor(cs: Record<string, unknown>, ex: Record<string, unknown>): CommsView | null {
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
  const extra = (Array.isArray(extraRaw) ? extraRaw : extraRaw === undefined || extraRaw === null ? [] : [extraRaw]).filter((l): l is string => typeof l === 'string' && whole(l, ex)).map((l) => fillText(l, ex))
  return { salutation: fillText(comms.salutation, ex), body: fillText(body, ex), extra, signature: fillText(comms.signature, ex) }
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
  const d = (cs.decision ?? {}) as Record<string, unknown>
  add(d.label)
  add(d.help)
  for (const o of Array.isArray(d.options) ? d.options : []) add(o)
  const w = (cs.whatToDo ?? {}) as Record<string, unknown>
  if (ex.needsCreate && Array.isArray(w.create)) for (const l of w.create) add(l)
  const fixes = (w.checkFixes ?? {}) as Record<string, string>
  for (const [key, vals] of (Array.isArray(ex.failingChecks) ? ex.failingChecks : []) as [string, Record<string, unknown>][]) add(fixes[key], { ...ex, ...vals })
  const more = (cs.more ?? {}) as Record<string, unknown>
  for (const r of Array.isArray(more.risks) ? (more.risks as { text?: string }[]) : []) add(r.text)
  for (const l of Array.isArray(more.helpDesk) ? more.helpDesk : []) add(l)
  const manager = managerText(cs, ex)
  if (manager) out.push(manager)
  const comms = commsFor(cs, ex)
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
  const comms = commsFor(cs, ex)
  if (comms) out.push({ kind: 'comms', text: [comms.salutation, comms.body, ...comms.extra, comms.signature].join('\n\n'), after })
  const more = (cs.more ?? {}) as Record<string, unknown>
  const helpDesk = (Array.isArray(more.helpDesk) ? more.helpDesk : []).filter((x) => whole(x, ex))
  if (helpDesk.length > 0) out.push({ kind: 'helpDesk', text: helpDesk.map((x) => fillText(x, ex)).join('\n'), after })
  const manager = managerText(cs, ex)
  if (manager) out.push({ kind: 'manager', text: manager, after })
  return out
}
