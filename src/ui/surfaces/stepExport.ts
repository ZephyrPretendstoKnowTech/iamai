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
import { fillText, whole } from '../../content/render.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepPortalLines, stepPortalLinesFromBody, portalNamesFor } from './stepPortal.ts'

export type { ExportStep }

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
  if (portal && portal.length > 0) lines.push(...portal)
  else if (Array.isArray(w.steps)) for (const l of w.steps) if (whole(l, ex)) lines.push(fillText(l, ex))
  const shared = content.shared as Record<string, string[]>
  const doneWhen = ((cs.doneWhen ?? []) as unknown[])
    .flatMap((x) => (x === '{policyDoneWhen}' ? shared.policyDoneWhen : x === '{changeDoneWhen}' ? shared.changeDoneWhen : [x]))
    .filter((x) => whole(x, ex))
    .map((x) => fillText(x, ex))
  return {
    title: String(cs.title),
    why: fillText(cs.why, ex),
    whatToDo: lines,
    doneWhen,
    ifWrong: cs.ifWrong && whole(cs.ifWrong, ex) ? fillText(cs.ifWrong, ex) : null,
    dates: cs.dates && whole(cs.dates, ex) ? fillText(cs.dates, ex) : null,
  }
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
  for (const [k, v] of Object.entries(who)) {
    if (k === 'groups' || k === 'timeline' || k === 'overlap') continue
    for (const line of Array.isArray(v) ? v : [v]) add(line)
  }
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
  add(more.manager)
  const comms = (cs.comms ?? null) as Record<string, unknown> | null
  if (comms) for (const k of ['salutation', 'body', 'signature']) add(comms[k])
  return out
}
