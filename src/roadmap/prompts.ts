// Bridges to the user's own AI (comms-and-bridges.md §2): IAMAI runs no
// models and sends nothing. Everything here is text for the clipboard or a
// file the user downloads: a prompt with the facts embedded and a plain
// "do not invent facts" instruction, the prompt pack, and the grounding
// bundle, redacted by default. Pure.
import { GROUNDING, PROMPTS } from '../copy/comms.ts'
import { absoluteDate } from '../copy/dates.ts'
import { awaitingDeployment, forecastEnforcement, statedEnforcement } from './forecast.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { CoverageReport } from '../coverage/types.ts'
import type { CleanupExport, Step, StepView } from './types.ts'
import { redactDeep as redactDeepShared, tenantVocabulary } from '../redactSnapshot.ts'
import type { Schedule } from './schedule.ts'
import { reached } from '../derive/population.ts'
import { content } from '../content/content.ts'

/** The shared lines this module states a date with; the words live in content.json. */
const SHARED = content.shared as unknown as { commsForecastDate: string; commsForecastNote: string }

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

export function stepContext(step: Step, view?: StepView): string {
  // A policy that is not in the tenant takes effect on no date: the schedule's
  // enforcement day is the roadmap's forecast for a report-only window that has
  // not opened, and a prompt pack is text a person hands to a model to draft an
  // announcement from, so a projection stated here comes back as a commitment.
  // The one reading, with the Dates line, the row and the calendar entry
  // (roadmap/forecast.ts).
  //
  // A policy that does exist but has not yet earned its enforcement — sitting in
  // report-only with its window still open — is dated by no enforcement either.
  // Its next day is the review its own gates derive, and What to do below names
  // it; the projection the schedule holds is withheld, because a prompt pack is
  // the text a person hands to a model to write an announcement from, and
  // "takes effect Sep 8" is what comes back (roadmap/forecast.ts
  // `statedEnforcement`, which reads the same for the row, the Dates line and
  // the calendar entry).
  const timing = statedEnforcement(step)
  const when =
    timing.at === null || awaitingDeployment(step)
      ? 'not yet dated'
      : timing.basis === 'forecast'
        ? SHARED.commsForecastDate.replace('{date}', absoluteDate(timing.at))
        : absoluteDate(timing.at)
  if (view) {
    // What the step says on screen (prompt 53 queue item 7), never the engine's own prose.
    const v = view(step)
    return `${v.title}. ${v.why} Takes effect: ${when}. What to do: ${v.whatToDo.join(' | ') || 'nothing'}. Done when: ${v.doneWhen.join(' | ') || 'the next scan confirms it'}.`
  }
  return `${step.plainTitle || step.title}. ${step.why} Takes effect: ${when}.`
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

export type PackItem = { title: string; prompt: string }

/** The Cleanup rows as one block of facts (E4): each row's title, its day, and what it says to do. */
export function cleanupText(cleanup: CleanupExport[]): string {
  return cleanup.map((c) => `${c.title} (${c.done ? `done ${absoluteDate(c.done)}` : absoluteDate(c.day)}). ${c.why} What to do: ${c.whatToDo.join(' | ') || 'nothing'}. Done when: ${c.doneWhen.join(' | ') || 'the next scan confirms it'}.`).join('\n')
}

/** The prompt pack (§2.2), pre-filled from the current plan; the Cleanup rows travel under their own label. */
export function promptPack(args: { view?: StepView; tenant: string; steps: Step[]; schedule: Schedule; changeRecord: string; planSummary: string; announcement: string | null; language?: string; cleanup?: CleanupExport[] }): PackItem[] {
  const { tenant } = args
  const firstStep = args.steps.find((s) => (s.kind === 'create' || s.kind === 'adjust') && s.status !== 'done') ?? args.steps[0]
  const stepText = firstStep && args.view ? stepContext(firstStep, args.view) : firstStep ? `${firstStep.plainTitle} (${firstStep.title}). ${firstStep.why}` : ''
  const cleanup = args.cleanup ?? []
  const withFacts = (head: string, label: string, body: string, extra: [string, string][] = []) => [head, dataBlock(label, body), ...extra.map(([l, b]) => dataBlock(l, b)), PROMPTS.noInvent].join('\n\n')
  const planBlocks: [string, string][] = cleanup.length > 0 ? [[PROMPTS.cleanup, cleanupText(cleanup)]] : []
  return [
    { title: PROMPTS.pack.rewrite, prompt: withFacts(PROMPTS.rewrite(tenant), PROMPTS.draft, args.announcement ?? '') },
    { title: PROMPTS.pack.mfaGuide(tenant).split(',')[0], prompt: [PROMPTS.pack.mfaGuide(tenant), PROMPTS.noInvent].join('\n\n') },
    { title: PROMPTS.pack.kb(tenant).split(' for ')[0], prompt: withFacts(PROMPTS.pack.kb(tenant), PROMPTS.step, stepText) },
    { title: PROMPTS.pack.changeRequest(tenant).split(',')[0], prompt: withFacts(PROMPTS.pack.changeRequest(tenant), PROMPTS.record, args.changeRecord) },
    { title: PROMPTS.pack.explain, prompt: withFacts(PROMPTS.pack.explain, PROMPTS.step, stepText) },
    { title: PROMPTS.pack.pushback(tenant).split('.')[0], prompt: withFacts(PROMPTS.pack.pushback(tenant), PROMPTS.step, stepText) },
    { title: PROMPTS.pack.translate(args.language ?? PROMPTS.language).split(',')[0], prompt: withFacts(PROMPTS.pack.translate(args.language ?? PROMPTS.language), PROMPTS.draft, args.announcement ?? '') },
    { title: PROMPTS.pack.summarise(tenant).split(' for ')[0], prompt: withFacts(PROMPTS.pack.summarise(tenant), PROMPTS.plan, args.planSummary, planBlocks) },
  ]
}

export function promptPackMarkdown(items: PackItem[], tenant: string): string {
  const lines = [`# ${PROMPTS.title}: ${tenant}`, '', PROMPTS.intro, '']
  for (const it of items) lines.push(`## ${it.title}`, '', '```', it.prompt, '```', '')
  return lines.join('\n')
}

// ---- Grounding bundle (§2.3) ----

// Redaction lives in src/redactSnapshot.ts. This file used to carry its own
// pair of regexes and a substitution list built only from `snapshot.users`,
// which is why the "redacted" bundle still carried policy names, group names,
// departments and named-location CIDRs (audit redact-02, redact-03, redact-07).

export function groundingBundle(args: { view?: StepView; tenant: string; snapshot: TenantSnapshot; coverage: CoverageReport; steps: Step[]; schedule: Schedule; redacted: boolean; generated: string; cleanup?: CleanupExport[] }): Record<string, unknown> {
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
  // With a view the findings are data (goal, status); the engine's statement
  // prose stays out of a content-era bundle (prompt 53 queue item 7).
  const findings = args.coverage.results.map((r) => (args.view ? { goal: r.goal.id, name: r.goal.name, status: r.status } : { goal: r.goal.id, name: r.goal.name, status: r.status, statement: r.statement.replace(/\*\*/g, '') }))
  // With a view, each step is what the screen says (prompt 53 queue item 7):
  // the content title, why, what to do and done when, beside the data another
  // tool needs (status, the dates line, tracking) and none of the v2 engine's
  // field names (rings, events); without one, the engine's own fields.
  const steps = args.steps.map((s) => {
    const v = args.view ? args.view(s) : null
    const data = {
      id: s.id,
      kind: s.kind,
      status: s.status,
      tracking: s.tracking ? { state: s.tracking.state, enforcedAt: s.tracking.enforcedAt, evidenceQuality: s.tracking.evidenceQuality } : null,
      // What the step's enforcement instant is worth (roadmap/forecast.ts). The
      // bundle is read by another tool, and a bare instant is indistinguishable
      // from one a policy has earned, so the basis travels with the date:
      // `forecast` is the roadmap's projected path and authorises nothing;
      // `committed` is a milestone Foundation B's evidence supports. The
      // fallback below still carries the schedule's own events and rings, and
      // this is what says which of the two they are.
      enforcement: statedEnforcement(s),
    }
    // A policy in report-only whose enforcement Foundation B has not granted has
    // no enforcement instant to give (`unearned`), so the fallback's engine
    // fields do not smuggle the same projection back in under another name: the
    // schedule's events and rings are the instant, and absent is how the bundle
    // says a date is not this step's to state.
    const withheld = data.enforcement.basis === 'unearned'
    return v
      ? { ...data, title: v.title, why: v.why, whatToDo: v.whatToDo, doneWhen: v.doneWhen, dates: v.dates, ifWrong: v.ifWrong, population: reached(s)?.active ?? null }
      : {
          ...data,
          ...(withheld ? {} : { events: s.events, rings: s.rings.map((r) => ({ name: r.name, plannedStart: r.plannedStart, plannedEnd: r.plannedEnd, members: r.targeting.memberCount })) }),
          title: s.title,
          plainTitle: s.plainTitle,
          why: s.why,
          population: reached(s)?.active ?? null,
          forManager: s.forManager,
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
