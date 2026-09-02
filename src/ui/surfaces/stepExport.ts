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
import { fillText, missingVars } from '../../content/render.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepPortalLines, stepPortalLinesFromBody, portalNamesFor } from './stepPortal.ts'

export type { ExportStep }

const whole = (s: unknown, ex: Record<string, unknown>): boolean => typeof s !== 'string' || missingVars(s, ex).length === 0

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
