// Bridges to the user's own AI (comms-and-bridges.md §2): IAMAI runs no
// models and sends nothing. Everything here is text for the clipboard or a
// file the user downloads: a prompt with the facts embedded and a plain
// "do not invent facts" instruction, the prompt pack, and the grounding
// bundle, redacted by default. Pure.
import { GROUNDING, PROMPTS } from '../copy/comms.ts'
import { absoluteDate } from '../copy/dates.ts'
import { forecastEnforcement, statedEnforcement } from './forecast.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { CoverageReport } from '../coverage/types.ts'
import { cleanupArtifactLines, stepArtifactLines } from './artifactLines.ts'
import type { CleanupExport, Step, StepView } from './types.ts'
import { redactDeep as redactDeepShared, tenantVocabulary } from '../redactSnapshot.ts'
import type { Schedule } from './schedule.ts'
import { content } from '../content/content.ts'
import { fillText } from '../content/render.ts'

/** The shared lines this module states a date with; the words live in content.json. */
const SHARED = content.shared as unknown as { commsForecastNote: string }

/** What a prompt in the pack is about, in the page's own words (pages.app.export). */
const EXPORT = (content.pages.app as unknown as { export: { promptScope: string; promptWholePlan: string } }).export

export type PromptKind = 'announcement' | 'reminder' | 'helpDesk' | 'manager' | 'changeRecord' | 'executive' | 'wholePlan'

const instruction: Record<PromptKind, (tenant: string) => string> = {
  announcement: PROMPTS.rewrite,
  reminder: PROMPTS.reminder,
  helpDesk: PROMPTS.helpDesk,
  manager: PROMPTS.manager,
  changeRecord: PROMPTS.changeRecord,
  executive: PROMPTS.executive,
  wholePlan: PROMPTS.wholePlan,
}

/**
 * The longest run of backticks in the body, plus one — so content that already
 * contains a fence cannot close ours and continue outside it (audit prompt-04).
 */
function fenceFor(body: string): string {
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((m) => m.length))
  return '`'.repeat(Math.max(3, longest + 1))
}

/** Cap on any single untrusted block, with the truncation stated in the text. */
export const PROMPT_BLOCK_MAX = 4000

/**
 * One block of untrusted text, fenced and labelled as data.
 *
 * Everything IAMAI puts in a prompt below the instruction line came from a
 * tenant scan or a third-party baseline. Concatenating it into the instruction
 * block, which is what this used to do, meant a policy named "ignore previous
 * instructions and…" read to a model exactly like IAMAI's own words.
 */
export function dataBlock(label: string, body: string): string {
  const clipped = body.length > PROMPT_BLOCK_MAX ? body.slice(0, PROMPT_BLOCK_MAX).trimEnd() + PROMPTS.truncated : body
  const fence = fenceFor(clipped)
  return `${label} ${PROMPTS.dataNote}\n${fence}\n${clipped}\n${fence}`
}

/**
 * A prompt with the facts embedded (§2.1).
 *
 * Order is the fix, not decoration: the instruction comes first, the untrusted
 * blocks are fenced in the middle, and PROMPTS.noInvent is restated *after*
 * them. It used to sit at position two of four — ahead of everything an
 * attacker controls, which is the weakest place to put the one guardrail.
 */
export function promptFor(kind: PromptKind, tenant: string, context: string, draft: string): string {
  return [
    instruction[kind](tenant),
    dataBlock(PROMPTS.context, context),
    dataBlock(PROMPTS.draft, draft),
    PROMPTS.noInvent,
  ].join('\n\n')
}

/**
 * The step block a prompt is grounded in: the execution context another tool or
 * person needs to carry out the action the Plan is showing *today*, and nothing
 * that is not that.
 *
 * It is the export view, labelled (roadmap/artifactLines.ts) — the same run of
 * lines the calendar entry carries — so the prompt and the screen cannot answer
 * a question two ways. This used to compose its own: it read `statedEnforcement`
 * a second time to write a "Takes effect:" clause the Dates line already states,
 * printed "not yet dated" where the view had a whole sentence about what the
 * step is waiting for, and filled an empty completion with "the next scan
 * confirms it" — a finish no authority had stated, on exactly the steps whose
 * policy the plan will not write. The step's prerequisites, its condition and
 * its reach were in none of it.
 */
export function stepContext(step: Step, view: StepView): string {
  const v = view(step)
  return [`${v.title}.`, ...stepArtifactLines(v)].join('\n')
}

/** A blank line between paragraphs, the way every announcement is composed. */
const PARA = '\n\n'

/**
 * The draft announcement the prompt pack hands to a model, on the terms the
 * date it names is worth.
 *
 * The generator writes this draft before Foundation B's lifecycle is settled —
 * tracking advances it afterwards — so the draft leaves the generator dated and
 * unclassified, and the classification happens here, on the finished plan. While
 * the step's enforcement is the roadmap's projection the draft says so in its
 * own paragraph, under the one that names the day and above the sign-off, in the
 * same words the screen's Tell your people box carries
 * (stepExport.ts `commsFor`). A step with no announcement to make ("nobody is
 * affected") names no day and gains no paragraph.
 */
export function announcementDraft(steps: readonly Step[]): string | null {
  const step = steps.find((s) => s.comms)
  const draft = step?.comms ?? null
  if (step === undefined || draft === null) return null
  const parts = draft.split(PARA)
  // Salutation, body, sign-off: fewer paragraphs than that is not a dated
  // announcement, so there is no day to qualify.
  if (parts.length < 3 || !forecastEnforcement(step)) return draft
  return [...parts.slice(0, 2), SHARED.commsForecastNote, ...parts.slice(2)].join(PARA)
}

/**
 * One prompt in the pack.
 *
 * `scope` is the step it is grounded in, where it is grounded in one. Three of
 * these prompts are built from a single step and five from the whole plan, and
 * nothing said so: a person copying "Explain this to a non-technical manager"
 * had no way to know which of thirty steps they were explaining. Null means the
 * prompt is about the plan.
 */
export type PackItem = { title: string; prompt: string; scope: string | null }

/**
 * The Cleanup rows as one block of facts (E4): each row's title, its day, and
 * what the row says, in the same labelled run the calendar entry carries
 * (roadmap/artifactLines.ts).
 *
 * It used to compose its own, with two invented fallbacks: a row with nothing
 * to do said "nothing", and a row with no completion said "the next scan
 * confirms it" — a finish no authority had stated. A section the row has
 * nothing for is absent now, the way the screen leaves it out.
 */
export function cleanupText(cleanup: CleanupExport[]): string {
  return cleanup.map((c) => [`${c.title} (${c.done ? `done ${absoluteDate(c.done)}` : absoluteDate(c.day)}).`, ...cleanupArtifactLines(c)].join('\n')).join('\n\n')
}

/**
 * The prompt pack (§2.2), pre-filled from the current plan; the Cleanup rows
 * travel under their own label.
 *
 * `view` is required. It used to be optional, and without it the pack fell back
 * to the v2 engine's own `plainTitle`/`why` — a second description of a step,
 * written before Foundation B settled its lifecycle, with no stage, no
 * condition, no prerequisites and no statement of whether the work can be done
 * at all. There is one reading of a step for an artifact and this is it.
 */
export function promptPack(args: { view: StepView; tenant: string; steps: Step[]; schedule: Schedule; changeRecord: string; planSummary: string; announcement: string | null; language?: string; cleanup?: CleanupExport[] }): PackItem[] {
  const { tenant } = args
  const firstStep = args.steps.find((s) => (s.kind === 'create' || s.kind === 'adjust') && s.status !== 'done') ?? args.steps[0]
  // The one step the step-grounded prompts speak for, and its title, so the pack
  // and the page can say which step that is.
  const stepText = firstStep ? stepContext(firstStep, args.view) : ''
  const stepTitle = firstStep ? args.view(firstStep).title : null
  const cleanup = args.cleanup ?? []
  const withFacts = (head: string, label: string, body: string, extra: [string, string][] = []) => [head, dataBlock(label, body), ...extra.map(([l, b]) => dataBlock(l, b)), PROMPTS.noInvent].join('\n\n')
  const planBlocks: [string, string][] = cleanup.length > 0 ? [[PROMPTS.cleanup, cleanupText(cleanup)]] : []
  return [
    { title: PROMPTS.pack.rewrite, prompt: withFacts(PROMPTS.rewrite(tenant), PROMPTS.draft, args.announcement ?? ''), scope: null },
    { title: PROMPTS.pack.mfaGuide(tenant).split(',')[0], prompt: [PROMPTS.pack.mfaGuide(tenant), PROMPTS.noInvent].join('\n\n'), scope: null },
    { title: PROMPTS.pack.kb(tenant).split(' for ')[0], prompt: withFacts(PROMPTS.pack.kb(tenant), PROMPTS.step, stepText), scope: stepTitle },
    { title: PROMPTS.pack.changeRequest(tenant).split(',')[0], prompt: withFacts(PROMPTS.pack.changeRequest(tenant), PROMPTS.record, args.changeRecord), scope: null },
    { title: PROMPTS.pack.explain, prompt: withFacts(PROMPTS.pack.explain, PROMPTS.step, stepText), scope: stepTitle },
    { title: PROMPTS.pack.pushback(tenant).split('.')[0], prompt: withFacts(PROMPTS.pack.pushback(tenant), PROMPTS.step, stepText), scope: stepTitle },
    { title: PROMPTS.pack.translate(args.language ?? PROMPTS.language).split(',')[0], prompt: withFacts(PROMPTS.pack.translate(args.language ?? PROMPTS.language), PROMPTS.draft, args.announcement ?? ''), scope: null },
    { title: PROMPTS.pack.summarise(tenant).split(' for ')[0], prompt: withFacts(PROMPTS.pack.summarise(tenant), PROMPTS.plan, args.planSummary, planBlocks), scope: null },
  ]
}

export function promptPackMarkdown(items: PackItem[], tenant: string): string {
  const lines = [`# ${PROMPTS.title}: ${tenant}`, '', PROMPTS.intro, '']
  // What each prompt is about, above the prompt: three of them are grounded in
  // one step and the file used to read as though all eight were about the plan.
  for (const it of items) lines.push(`## ${it.title}`, '', it.scope === null ? EXPORT.promptWholePlan : fillText(EXPORT.promptScope, { step: it.scope }), '', '```', it.prompt, '```', '')
  return lines.join('\n')
}

// ---- Grounding bundle (§2.3) ----

// Redaction lives in src/redactSnapshot.ts. This file used to carry its own
// pair of regexes and a substitution list built only from `snapshot.users`,
// which is why the "redacted" bundle still carried policy names, group names,
// departments and named-location CIDRs (audit redact-02, redact-03, redact-07).

export function groundingBundle(args: { view: StepView; tenant: string; snapshot: TenantSnapshot; coverage: CoverageReport; steps: Step[]; schedule: Schedule; redacted: boolean; generated: string; cleanup?: CleanupExport[] }): Record<string, unknown> {
  const { snapshot } = args
  // Every name the tenant contains, not just its users.
  const vocabulary = args.redacted ? tenantVocabulary(snapshot) : new Map<string, string>()
  const profile = {
    users: snapshot.users.length,
    enabled: snapshot.users.filter((u) => u.accountEnabled !== false).length,
    guests: snapshot.users.filter((u) => u.userType === 'guest').length,
    admins: Object.keys(snapshot.roles.active).length,
    policies: (snapshot.config.caPolicies?.rows ?? []).length,
    capabilities: Object.fromEntries(Object.entries(snapshot.capabilities).map(([k, v]) => [k, v.enabled])),
    signInEvidence: snapshot.sources.signInEvidence?.status ?? 'unknown',
    registrationMfaCapable: snapshot.registrationDetails.filter((r) => r.isMfaCapable).length,
  }
  // The findings are data (goal, status). The engine's statement prose stays out
  // of a content-era bundle (prompt 53 queue item 7).
  const findings = args.coverage.results.map((r) => ({ goal: r.goal.id, name: r.goal.name, status: r.status }))
  // Each step is what the screen says, and only that. The export view is the
  // frozen Step Contract's own answers (ui/surfaces/stepExport.ts), so where the
  // Plan is showing a policy nobody can write, a decision waiting on a person or
  // a change held for review, the bundle says so in the same words — and where
  // the Plan withholds an implementation, `implementation: false` travels with
  // the step rather than a reader having to infer it from an absent body.
  //
  // The engine's own field names (rings, events, plainTitle, forManager) are in
  // none of it. They used to be the fallback for a bundle built without a view:
  // a second description of every step, written before Foundation B settled the
  // lifecycle, which is exactly the disagreement this file cannot afford. There
  // is one reading now and it is the screen's.
  const steps = args.steps.map((s) => {
    const v = args.view(s)
    return {
      id: s.id,
      kind: s.kind,
      status: s.status,
      tracking: s.tracking ? { state: s.tracking.state, enforcedAt: s.tracking.enforcedAt, evidenceQuality: s.tracking.evidenceQuality } : null,
      // What the step's enforcement instant is worth (roadmap/forecast.ts). The
      // bundle is read by another tool, and a bare instant is indistinguishable
      // from one a policy has earned, so the basis travels with the date:
      // `forecast` is the roadmap's projected path and authorises nothing;
      // `committed` is a milestone Foundation B's evidence supports; `unearned`
      // is a policy in report-only that has no enforcement instant to give.
      enforcement: statedEnforcement(s),
      title: v.title,
      why: v.why,
      stage: v.stage,
      condition: v.condition,
      statusWord: v.status,
      next: v.next,
      who: v.who,
      // The one denominator the screen states, read from the one population
      // authority; null where Foundation A could not settle the scope, which is
      // the same silence `who` keeps. It used to be `reached(s).active`, a stored
      // number beside the count every surface actually shows.
      population: v.population,
      whatToDo: v.whatToDo,
      fix: v.fix,
      doneWhen: v.doneWhen,
      dates: v.dates,
      ifWrong: v.ifWrong,
      implementation: v.implementation,
    }
  })
  const bundle = {
    _readme: GROUNDING.header(args.redacted ? '[the tenant]' : args.tenant, args.redacted, args.generated),
    tenant: args.redacted ? { name: '[the tenant]' } : { name: args.tenant, id: snapshot.tenantId },
    profile,
    // The Cleanup rows under their own key (E4), as the screen says them.
    plan: { start: args.schedule.start, targetEnd: args.schedule.targetEnd, weeks: args.schedule.weeks, criticalPath: args.schedule.derivation.criticalPath, steps, cleanup: args.cleanup ?? [] },
    findings,
  }
  return args.redacted ? redactDeepShared(bundle, vocabulary) : bundle
}
