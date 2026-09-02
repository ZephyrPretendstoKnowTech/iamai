// Bridges to the user's own AI (comms-and-bridges.md §2): IAMAI runs no
// models and sends nothing. Everything here is text for the clipboard or a
// file the user downloads: a prompt with the facts embedded and a plain
// "do not invent facts" instruction, the prompt pack, and the grounding
// bundle, redacted by default. Pure.
import { GROUNDING, PROMPTS } from '../copy/comms.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { CoverageReport } from '../coverage/types.ts'
import type { Step, StepView } from './types.ts'
import { redactDeep as redactDeepShared, tenantVocabulary } from '../redactSnapshot.ts'
import type { Schedule } from './schedule.ts'

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
  const when = step.events?.enforce ? `${step.events.enforce.day} ${step.events.enforce.date}, ${step.events.enforce.time}` : 'not yet dated'
  if (view) {
    // What the step says on screen (prompt 53 queue item 7), never the engine's own prose.
    const v = view(step)
    return `${v.title}. ${v.why} Takes effect: ${when}. What to do: ${v.whatToDo.join(' | ') || 'nothing'}. Done when: ${v.doneWhen.join(' | ') || 'the next scan confirms it'}.`
  }
  return `${step.plainTitle || step.title}. ${step.why} Takes effect: ${when}.`
}

export type PackItem = { title: string; prompt: string }

/** The prompt pack (§2.2), pre-filled from the current plan. */
export function promptPack(args: { view?: StepView; tenant: string; steps: Step[]; schedule: Schedule; changeRecord: string; planSummary: string; announcement: string | null; language?: string }): PackItem[] {
  const { tenant } = args
  const firstStep = args.steps.find((s) => (s.kind === 'create' || s.kind === 'adjust') && s.status !== 'done') ?? args.steps[0]
  const stepText = firstStep && args.view ? stepContext(firstStep, args.view) : firstStep ? `${firstStep.plainTitle} (${firstStep.title}). ${firstStep.why} Rollback: ${firstStep.rollback}` : ''
  const withFacts = (head: string, label: string, body: string) => [head, dataBlock(label, body), PROMPTS.noInvent].join('\n\n')
  return [
    { title: PROMPTS.pack.rewrite, prompt: withFacts(PROMPTS.rewrite(tenant), PROMPTS.draft, args.announcement ?? '') },
    { title: PROMPTS.pack.mfaGuide(tenant).split(',')[0], prompt: [PROMPTS.pack.mfaGuide(tenant), PROMPTS.noInvent].join('\n\n') },
    { title: PROMPTS.pack.kb(tenant).split(' for ')[0], prompt: withFacts(PROMPTS.pack.kb(tenant), PROMPTS.step, stepText) },
    { title: PROMPTS.pack.changeRequest(tenant).split(',')[0], prompt: withFacts(PROMPTS.pack.changeRequest(tenant), PROMPTS.record, args.changeRecord) },
    { title: PROMPTS.pack.explain, prompt: withFacts(PROMPTS.pack.explain, PROMPTS.step, stepText) },
    { title: PROMPTS.pack.pushback(tenant).split('.')[0], prompt: withFacts(PROMPTS.pack.pushback(tenant), PROMPTS.step, stepText) },
    { title: PROMPTS.pack.translate(args.language ?? PROMPTS.language).split(',')[0], prompt: withFacts(PROMPTS.pack.translate(args.language ?? PROMPTS.language), PROMPTS.draft, args.announcement ?? '') },
    { title: PROMPTS.pack.summarise(tenant).split(' for ')[0], prompt: withFacts(PROMPTS.pack.summarise(tenant), PROMPTS.plan, args.planSummary) },
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

export function groundingBundle(args: { view?: StepView; tenant: string; snapshot: TenantSnapshot; coverage: CoverageReport; steps: Step[]; schedule: Schedule; redacted: boolean; generated: string }): Record<string, unknown> {
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
  // tool needs (status, dates, tracking); without one, the engine's own fields.
  const steps = args.steps.map((s) => {
    const v = args.view ? args.view(s) : null
    const data = {
      id: s.id,
      kind: s.kind,
      status: s.status,
      events: s.events,
      rings: s.rings.map((r) => ({ plannedStart: r.plannedStart, plannedEnd: r.plannedEnd, members: r.targeting.memberCount })),
      tracking: s.tracking ? { state: s.tracking.state, enforcedAt: s.tracking.enforcedAt, evidenceQuality: s.tracking.evidenceQuality } : null,
    }
    return v
      ? { ...data, title: v.title, why: v.why, whatToDo: v.whatToDo, doneWhen: v.doneWhen, dates: v.dates, ifWrong: v.ifWrong, population: s.population.active }
      : {
          ...data,
          title: s.title,
          plainTitle: s.plainTitle,
          why: s.why,
          population: s.population.active,
          rings: s.rings.map((r) => ({ name: r.name, plannedStart: r.plannedStart, plannedEnd: r.plannedEnd, members: r.targeting.memberCount })),
          rollback: s.rollback,
          forManager: s.forManager,
        }
  })
  const bundle = {
    _readme: GROUNDING.header(args.redacted ? '[the tenant]' : args.tenant, args.redacted, args.generated),
    tenant: args.redacted ? { name: '[the tenant]' } : { name: args.tenant, id: snapshot.tenantId },
    profile,
    plan: { start: args.schedule.start, targetEnd: args.schedule.targetEnd, weeks: args.schedule.weeks, criticalPath: args.schedule.derivation.criticalPath, steps },
    findings,
  }
  return args.redacted ? redactDeepShared(bundle, vocabulary) : bundle
}
