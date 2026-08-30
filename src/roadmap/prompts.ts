// Bridges to the user's own AI (comms-and-bridges.md §2): IAMAI runs no
// models and sends nothing. Everything here is text for the clipboard or a
// file the user downloads: a prompt with the facts embedded and a plain
// "do not invent facts" instruction, the prompt pack, and the grounding
// bundle, redacted by default. Pure.
import { GROUNDING, PROMPTS } from '../copy/comms.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { CoverageReport } from '../coverage/types.ts'
import type { Step } from './types.ts'
import { redactDeep as redactDeepShared, redactText as redactTextShared, tenantVocabulary } from '../redactSnapshot.ts'
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

/** A prompt with the facts embedded (§2.1). */
export function promptFor(kind: PromptKind, tenant: string, context: string, draft: string): string {
  return [instruction[kind](tenant), PROMPTS.noInvent, `${PROMPTS.context}: ${context}`, `${PROMPTS.draft}:\n${draft}`].join('\n\n')
}

export function stepContext(step: Step): string {
  const when = step.events?.enforce ? `${step.events.enforce.day} ${step.events.enforce.date}, ${step.events.enforce.time}` : 'not yet dated'
  return `${step.whatChanges} Affects: ${step.populationBasis || 'nobody'}. Takes effect: ${when}. What people must do: ${step.helpDesk?.whatToSay[0] ?? 'nothing'}.`
}

export type PackItem = { title: string; prompt: string }

/** The prompt pack (§2.2), pre-filled from the current plan. */
export function promptPack(args: { tenant: string; steps: Step[]; schedule: Schedule; changeRecord: string; planSummary: string; announcement: string | null; language?: string }): PackItem[] {
  const { tenant } = args
  const firstStep = args.steps.find((s) => (s.kind === 'create' || s.kind === 'adjust') && s.status !== 'done') ?? args.steps[0]
  const stepText = firstStep ? `${firstStep.plainTitle} (${firstStep.title}). ${firstStep.whatChanges} ${firstStep.why} How to verify: ${firstStep.verify?.where.join(' ') ?? ''} Rollback: ${firstStep.rollback}` : ''
  const withFacts = (head: string, label: string, body: string) => [head, PROMPTS.noInvent, `${label}:\n${body}`].join('\n\n')
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

export function groundingBundle(args: { tenant: string; snapshot: TenantSnapshot; coverage: CoverageReport; steps: Step[]; schedule: Schedule; redacted: boolean; generated: string }): Record<string, unknown> {
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
  const findings = args.coverage.results.map((r) => ({ goal: r.goal.id, name: r.goal.name, status: r.status, statement: r.statement }))
  const steps = args.steps.map((s) => ({
    id: s.id,
    title: s.title,
    plainTitle: s.plainTitle,
    kind: s.kind,
    status: s.status,
    whatChanges: s.whatChanges,
    why: s.why,
    population: s.populationBasis,
    impact: s.impact,
    safeToday: s.safeToday,
    verdict: s.safeVerdict.sentence,
    events: s.events,
    rings: s.rings.map((r) => ({ name: r.name, plannedStart: r.plannedStart, plannedEnd: r.plannedEnd, members: r.targeting.memberCount })),
    failureModes: s.failureModes,
    verify: s.verify,
    exitCriteria: s.exitCriteria,
    rollback: s.rollback,
    forManager: s.forManager,
    tracking: s.tracking ? { state: s.tracking.state, enforcedAt: s.tracking.enforcedAt, evidenceQuality: s.tracking.evidenceQuality } : null,
  }))
  const bundle = {
    _readme: GROUNDING.header(args.redacted ? '[the tenant]' : args.tenant, args.redacted, args.generated),
    tenant: args.redacted ? { name: '[the tenant]' } : { name: args.tenant, id: snapshot.tenantId },
    profile,
    plan: { start: args.schedule.start, targetEnd: args.schedule.targetEnd, weeks: args.schedule.weeks, criticalPath: args.schedule.derivation.criticalPath, steps },
    findings,
  }
  return args.redacted ? redactDeepShared(bundle, vocabulary) : bundle
}
