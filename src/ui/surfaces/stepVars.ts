// The tenant's values for a content step's variables (prompt 51 §8.9). Each
// content step's `example` block names exactly the variables that step renders;
// this produces those same keys from the tenant instead of the sample, so the
// content renderer fills content.json prose with real values. A key this cannot
// derive (a signal the read-only scan does not collect) is left undefined, and
// the renderer's fill/gating drops the line through content's own none-branch —
// never a fabricated value.
//
// Pure: no DOM, no network. The heavy per-scenario lists come from the roadmap
// Step the engine already computed (population, names, dates, naming); the
// content variables are a view over that, not a re-derivation.
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import { absoluteDate, longDate } from '../../copy/dates.ts'
import { list } from '../../copy/statements.ts'
import { countryName } from '../../mapping/countries.ts'
import { hoursAsDuration, needsPasskey, sessionWantedForGoal, sessionWantedLongForGoal, strengthForGoal, strengthNameOf, promptsPersonForGoal, pairBaselineNames } from './stepPortal.ts'
import { hoursInWords } from '../../coverage/verdict.ts'
import { analysisUnknown, effectsOf, promptsPeople } from '../../roadmap/strand.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { contentLists } from '../../derive/contentLists.ts'
import { stepPopulation } from '../../derive/population.ts'
import { pickerVars } from './pickerRows.ts'
import { DECISION_STEPS } from '../../roadmap/decisions.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { NamingConvention } from '../../coverage/naming.ts'
import { initialDomain } from '../../validation/rules.ts'
import { observationDaysFor } from '../../roadmap/schedule.ts'
import { readyWhen } from '../../derive/readyWhen.ts'
import { engine, shared } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { QUESTION_STEP, answerOf, devicePlanOf } from '../../roadmap/answers.ts'
import { nobodyAffected } from '../../roadmap/timing.ts'
import { SERVICE_ACCOUNTS_TRUSTED_GOAL } from '../../roadmap/generate.ts'
import { planProposedNames, proposedNamesFor } from './proposedNames.ts'
import { policyPairNames } from '../../coverage/naming.ts'
import type { ProposedObjectNames } from './proposedNames.ts'

export type StepVarContext = {
  snapshot: TenantSnapshot
  mapping: MappingState
  nameOf: (id: string) => string
  /** The technician's sign-off name, from Plan settings (default "IT"). */
  signature: string
  /** The operator's own account id, when in scope, for the operator-evidence line. */
  operatorId: string | null
  /** As-of time for the campaign buckets (usually snapshot.asOf). */
  now: string
  /** The plan's first enforcement date (ISO): the campaign's enrol-by. */
  firstEnforce?: string | null
  /** The day Require MFA for Everyone enforces (ISO): the campaign's and the device plan's date (E7). */
  mfaEnforce?: string | null
  /** The campaign's window in days, from the plan's start to its enrol-by (E7): the email's "over the next {enrolWindowDays} days". */
  enrolWindowDays?: number | null
  /** True when the plan carries the unmanaged-browser step, so personal devices keep the browser with limits (E7); otherwise they are blocked. */
  unmanagedBrowserOnPlan?: boolean
  /** True when Require MFA for Everyone is already in place: the campaign's email is the passkey version. */
  mfaInPlace?: boolean
  /** The first policy still to enforce that needs a passkey (its content title), and when (ISO): the passkey email names it. */
  passkeyPolicy?: string | null
  passkeyEnforce?: string | null
  /** This step's report-only creation date (ISO), for a policy step's dates line. */
  reportOnlyAt?: string | null
  /** The one active-people count (Today's denominator), so every step's summary line agrees (walk-51 item 8). */
  /** The groups the plan loaded, for the exclusions-group picker's rows. */
  groups?: GroupMembers
  /** The tenant's naming convention (coverage.organisation.naming): the portal lines name the objects the plan proposes before they exist. */
  naming?: NamingConvention
  /** The names the plan proposes for the objects the tenant lacks, from its prerequisite steps (planDates): the one source the prerequisite step and every portal line name. */
  proposed?: ProposedObjectNames
  /** The plan's policies that prompt a person (content titles, planDates): the shared-device accounts are excluded from each. */
  peoplePolicies?: string[]
}

/** The long form, in the display time zone, only when the instant is real. */
function long(iso: string | null | undefined): string | undefined {
  return iso ? longDate(iso) : undefined
}
/** The short form, one format everywhere (walk-51 item 5). */
function short(iso: string | null | undefined): string | undefined {
  return iso ? absoluteDate(iso) : undefined
}

function orgName(snapshot: TenantSnapshot): string {
  const org = snapshot.config.organization?.rows?.[0] as { displayName?: string } | undefined
  return org?.displayName ?? ''
}

/**
 * The values for a content step's variables. Only the keys the step uses are
 * produced (the renderer reads the content step's own example keys); a missing
 * key gates its line off. Lists come as name arrays already resolved.
 */
export function stepVars(step: Step, ctx: StepVarContext): Record<string, unknown> {
  // The one population per step (derive/population.ts): the row's who-line, the
  // lead's counts and the names all read it. For an open policy it is the people
  // that policy names — its own scope — and null where that scope could not be
  // settled, which leaves every count and name key unset so the lines that name
  // them render nothing rather than the goal's people (Foundation A).
  const view = stepPopulation(step)
  const ev = step.events
  const enforce = ev?.enforce
  const announce = ev?.announce
  const v: Record<string, unknown> = {
    tenant: orgName(ctx.snapshot),
    tenantName: orgName(ctx.snapshot),
    active: view?.active,
    admins: view?.admins,
    guests: view?.guests,
    total: view?.enabledCovered,
    inScope: view?.enabledCovered,
    adminCount: view?.admins,
    memberCount: view?.enabledCovered,
    signature: ctx.signature,
    // Dates: one short format everywhere (absoluteDate), the long form only for
    // emails (longDate), both from the same instant in the display time zone.
    enforce: short(enforce?.at),
    enforceLong: long(enforce?.at),
    announce: short(announce?.at),
    // The day Require MFA for Everyone enforces, for the campaign and the device
    // plan (E7); the campaign's window; and what a personal device can still do
    // once devices are required (shared.engine.personalDevices).
    mfaEnforce: short(ctx.mfaEnforce ?? ctx.firstEnforce),
    mfaEnforceLong: long(ctx.mfaEnforce ?? ctx.firstEnforce),
    enrolWindowDays: ctx.enrolWindowDays ?? undefined,
    personalDevicesClause: ctx.unmanagedBrowserOnPlan === undefined ? undefined : ctx.unmanagedBrowserOnPlan ? engine.personalDevices.browserLimited : engine.personalDevices.blocked,
    // Require MFA for Everyone already in place: the campaign email is the passkey
    // version, naming the first policy still to enforce that needs a passkey.
    mfaInPlace: ctx.mfaInPlace ? true : undefined,
    passkeyPolicy: ctx.passkeyPolicy ?? undefined,
    passkeyEnforceLong: long(ctx.passkeyEnforce),
    // A policy already in report-only has its date from the scan (tracking), not
    // from the schedule, which only dates the policies the plan creates.
    reportOnly: short(step.tracking?.reportOnlyAt ?? ctx.reportOnlyAt),
    // The proposed policy name, in the tenant's convention.
    policyName: step.naming?.proposed,
    proposedName: step.naming?.proposed,
    existingName: step.naming?.fromBaseline ?? undefined,
    // The operator's own sign-in count, when the operator is in the step's population (the "Your account is in scope" line);
    // in scope with no records of their own (signed in for this scan, outside the window), the no-records line names them instead.
    // Whether the signed-in account is in scope is the policy's own answer,
    // decided where the scan is and carried on the step (generate.ts
    // includesOperator). The step's list of people stands in only for a step
    // with no policy of its own.
    operatorSignIns: ctx.operatorId && operatorInScope(step, ctx.operatorId) ? operatorSignIns(ctx.snapshot, ctx.operatorId) : undefined,
    operatorNoRecords: ctx.operatorId && operatorInScope(step, ctx.operatorId) && operatorSignIns(ctx.snapshot, ctx.operatorId) === undefined ? ctx.nameOf(ctx.operatorId) : undefined,
    people: view?.active,
    // The step's people: the active ones it touches, or, for a check step, the
    // accounts it checks (the dormant accounts are by definition not active).
    n: view?.active,
    // The step's readiness, as the percentage the content line names.
    readiness: step.readiness?.percent != null ? `${step.readiness.percent}%` : undefined,
    // The report-only observation window a policy done-when line names: this
    // step's own (three days where the evidence shows nobody affected).
    reportOnlyDays: observationDaysFor(step),
    // The start of the sign-in window the scan read ("since {from}"): the
    // evidence window's start, on every step that names it.
    from: short(ctx.snapshot.sources.signInEvidence?.coveredWindow?.from),
    // The allowed countries, by name, for the countries policy's why and its lines.
    countries: ctx.mapping.allowedCountries.length > 0 ? list(ctx.mapping.allowedCountries.map(countryName)) : undefined,
    // Service-provider (GDAP) sign-ins and the partner tenants they came from,
    // for the partner question on the guests policy: absent while there are
    // none, so the question is not asked of a tenant with no partner.
    spSignIns: (ctx.snapshot.scenarioEvidence?.serviceProviderSignIns.count ?? 0) > 0 ? ctx.snapshot.scenarioEvidence?.serviceProviderSignIns.count : undefined,
    partners: (ctx.snapshot.scenarioEvidence?.serviceProviderSignIns.count ?? 0) > 0 ? ctx.snapshot.scenarioEvidence?.serviceProviderSignIns.homeTenants : undefined,
  }

  // A policy already in report-only: the two gates with today's numbers, for
  // the tracked done-when lines (shared.policyDoneWhenTracked). The row's date
  // column reads the same readyWhen, so the two can never disagree.
  const ready = readyWhen(step)
  if (ready) {
    const TRACK = engine.tracking
    v.readyOn = absoluteDate(ready.date)
    v.timeGate = fillText(ready.kind === 'on' ? TRACK.readyOn : TRACK.readySince, { date: absoluteDate(ready.date) })
    // "3 of 30 active people seen" is a count over the deployed policy's own
    // scope. Where that scope could not be settled there is no count to show, so
    // the key is left unset and the line it sits in renders nothing rather than a
    // number nobody established (tracking.ts trackedScope).
    v.evidenceGate =
      ready.kind === 'now'
        ? fillText(TRACK.readyNow, { n: ready.days })
        : ready.seen === null || ready.people === null
          ? undefined
          : fillText(TRACK.evidenceToday, { failures: ready.failures, seen: ready.seen, people: ready.people, n: ready.days })
  }

  // A campaign has no enforcement date of its own; its enrol-by is the plan's
  // first enforcement date (walk-51 item 2, target-state §9).
  if (!enforce && ctx.firstEnforce) v.enrollBy = absoluteDate(ctx.firstEnforce)

  // The two-policy (merged) goals carry A/B names: the proposal with its letter,
  // in the tenant's separator (coverage/naming.ts policyPairNames), for the
  // step's lines and the portal's two blocks alike; never one name on both.
  const pairNames = pairBaselineNames(step.goalId)
  if (pairNames.length >= 2 && step.naming?.proposed) {
    const pair = policyPairNames(step.naming.proposed, pairNames[1], ctx.naming ?? null)
    v.policyNameA = pair.a
    v.policyNameB = pair.b
  }

  // The strength and the session length these lines name are the ones the step's
  // own policies will require. For an open policy the operation answers, and
  // where its own analysis cannot settle what it does the line renders nothing
  // rather than the author's version of a policy the tenant is not getting. The
  // baseline speaks only for a step with no policy of its own — one already in
  // place, the enforce step (roadmap/strand.ts effectsOf, analysisUnknown).
  const own = effectsOf(step)
  const held = analysisUnknown(step)
  const strength = own === null ? strengthForGoal(step.goalId) : held ? null : ((): string | null => {
    const id = own.flatMap((e) => (e.strength ? [e.strength.id] : []))[0]
    return id === undefined ? null : strengthNameOf(id, ctx)
  })()
  if (strength) v.strengthName = strength
  // The session frequency, for the lines that name {wanted}, and as a duration
  // for the email that says "expire after {wantedLong}".
  const hours = own === null ? null : held ? null : own.map((e) => e.sessionControls?.signInFrequencyHours ?? null).find((h) => h !== null) ?? null
  const wanted = own === null ? sessionWantedForGoal(step.goalId) : hours === null ? null : hoursInWords(hours)
  if (wanted) v.wanted = wanted
  const wantedLong = own === null ? sessionWantedLongForGoal(step.goalId) : hours === null ? null : hoursAsDuration(hours)
  if (wantedLong) v.wantedLong = wantedLong

  // Nobody affected (timing.ts, the one definition): the records show nobody
  // using what this step blocks, so the manager's "nobody here used it" clause
  // applies (E9); and the service-accounts group the service-accounts block names.
  if (nobodyAffected(step)) v.nobodyAffected = true
  if (step.goalId === SERVICE_ACCOUNTS_TRUSTED_GOAL) v.serviceAccountsGroup = ctx.mapping.serviceAccountsGroupId ? ctx.nameOf(ctx.mapping.serviceAccountsGroupId) : proposedNamesFor(ctx).serviceAccountsGroup
  // The trusted network by name (the team's own locations, else the plan's proposal: the portal's rule, stepPortal tokenNames), and the policies that prompt a person, for the shared-devices step's own instructions.
  const trustedIds = ctx.mapping.trustedLocationIds ?? []
  v.trustedLocation = trustedIds.length > 0 ? trustedIds.map(ctx.nameOf).join(', ') : proposedNamesFor(ctx).trustedLocation
  if (ctx.peoplePolicies && ctx.peoplePolicies.length > 0) v.peoplePolicies = ctx.peoplePolicies

  // Existing coverage: whether a policy already delivers the goal (drives the
  // {existingCoverage} line's presence). A done step's policies are what makes
  // it In place, not coverage this step's version supersedes; the line names
  // what the consolidation row retires (generate.ts supersededPolicies).
  v.existingPolicies = step.status !== 'done' && step.deliveredBy.length > 0 ? step.deliveredBy : []
  // In place: the step asks nobody to do anything, so its email does not render (stepExport.ts commsFor).
  if (step.status === 'done') v.stepDone = true

  // The list variables, derived from what the scan collected (never gated when
  // the data exists): the campaign buckets, the lockout-scenario people, and the
  // emergency/service/admin id sets. A step reads only the keys it uses.
  // With Require MFA for Everyone in place nobody is "registered but never seen to complete MFA" (population.ts campaignBucket).
  Object.assign(v, contentLists({ snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, now: ctx.now, mfaInPlace: ctx.mfaInPlace === true }))
  // The stored answers in words (E1), for the steps an answer adds; and the
  // device decision's lines (E2): who signs in from a phone or an unjoined
  // computer, one device line per person for the campaign, and the one
  // sentence its email adds.
  Object.assign(v, answerVars(ctx, v))

  // The step's own picker rows (prune B): the emergency, exclusions-group,
  // countries, trusted-network, service-accounts and shared-devices pickers,
  // from the detections the plan runs, in the content file's row shape.
  const pickerRow = (contentStepFor(step) as { decision?: { pickerRow?: string } } | undefined)?.decision?.pickerRow
  if (typeof pickerRow === 'string') Object.assign(v, pickerVars(step.id, pickerRow, { snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, groups: ctx.groups }) ?? {})

  // The emergency-access and exclusions-group steps (walk-51 item 14): the
  // failing checks routed through the content checkFixes, the counts for the
  // "{failing} of {total}" line, the operator's own account and the tenant id
  // from the session, and the values the create instructions name.
  // The exclusions group: the recognised group's own line (name, members, how
  // many policies exclude it) and its members; the create instructions show
  // while no group is recognised (its checks need a group to check).
  if (DECISION_STEPS.exclusions.has(step.id)) {
    const record = ctx.mapping.records['__globalExclusion'] ?? null
    const id = record?.resolvedId ?? null
    v.needsCreate = id === null
    // No group: no checks ran, so no count (the population's 0 would read "All 0 checks pass").
    if (id === null) delete v.total
    if (id !== null) {
      const g = ctx.groups?.get(id) ?? [...(ctx.groups ?? [])].find(([k]) => k.toLowerCase() === id.toLowerCase())?.[1] ?? null
      const policies = ctx.snapshot.config.caPolicies?.rows ?? []
      const excludes = (p: unknown): boolean => ((p as { conditions?: { users?: { excludeGroups?: string[] } } }).conditions?.users?.excludeGroups ?? []).some((x) => x.toLowerCase() === id.toLowerCase())
      v.exclusionsGroup = g?.displayName ?? record?.resolvedName ?? ctx.nameOf(id)
      v.memberCount = g?.memberCount ?? 0
      v.excludedFrom = policies.filter(excludes).length
      v.policyCount = policies.length
      v.members = (g?.memberIds ?? []).map(ctx.nameOf)
    }
  }
  // A check step with nothing checked (no target the scan could read) shows no count.
  if (step.checks && step.checks.total > 0) {
    v.failing = step.checks.failing
    v.total = step.checks.total
    v.failingChecks = step.checks.items.map((it) => {
      const vals: Record<string, unknown> = { ...it.values }
      if (it.subject === 'breakGlass' && it.target && vals.name === undefined) vals.name = ctx.nameOf(it.target)
      return [it.fix, vals]
    })
    // Fewer than two accounts pass the count check: the create instructions show.
    v.needsCreate = step.checks.items.some((it) => it.fix === 'second-account')
    // The policies that do not yet exclude the exclusions group (who line), from
    // the excluded-everywhere checks' own values.
    const notExcluding = [...new Set(step.checks.items.filter((it) => it.fix === 'excluded-everywhere').flatMap((it) => (Array.isArray(it.values.policies) ? (it.values.policies as string[]) : [])))]
    if (notExcluding.length > 0) v.policiesNotExcluding = notExcluding
    v.operator = ctx.operatorId ? ctx.nameOf(ctx.operatorId) : undefined
    v.tenantId = ctx.snapshot.tenantId
    v.onmicrosoftDomain = initialDomain(ctx.snapshot) ?? undefined
    // A suggested name for a new emergency account (display-name and create).
    v.exampleName = 'Emergency Access'
  }

  return v
}

type DevicePlanWords = { phone: Record<string, string>; computer: Record<string, string>; personLine: string; phoneWord: string; computerWord: string; intro: string; introPhones: string; sentence: string; sentencePhones: string }

/**
 * The answers as words (answers.ts): the person's own answer with ids resolved
 * to names, for the steps an answer adds; who signs in from a phone or an
 * unjoined computer; and, once the device decision is made, one device line per
 * person and the campaign email's sentence (shared.devicePlan).
 */
function answerVars(ctx: StepVarContext, v: Record<string, unknown>): Record<string, unknown> {
  const m = ctx.mapping
  const out: Record<string, unknown> = {}
  const travel = answerOf(m, QUESTION_STEP.travel, 'question')
  if (travel) out.travelAnswer = travel.picked.reduce((t, c) => t.replace(c, countryName(c)), travel.text)
  const partner = answerOf(m, QUESTION_STEP.partner, 'question')
  if (partner) out.partnerAnswer = partner.text
  const mail = answerOf(m, QUESTION_STEP.mailDevices, 'decision')
  if (mail) {
    out.mailDevicesAnswer = mail.picked.reduce((t, id) => t.replace(id, ctx.nameOf(id)), mail.text)
    out.mailDevices = mail.picked.map(ctx.nameOf)
  }
  const ev = ctx.snapshot.scenarioEvidence
  const phones = ev?.phoneSignIns?.people ?? []
  const unjoined = ev?.unjoinedComputers?.people ?? []
  out.phoneUsers = phones.map(ctx.nameOf)
  out.unjoinedUsers = unjoined.map(ctx.nameOf)
  const plan = devicePlanOf(m)
  if (plan) {
    const W = shared.devicePlan as DevicePlanWords
    const phoneWords = fillText(W.phone[plan.phones], v)
    const computerWords = plan.computers ? fillText(W.computer[plan.computers], v) : null
    // One line per person (the name and the device); the instruction once, in the list's lead.
    const lines: string[] = phones.map((id) => fillText(W.personLine, { name: ctx.nameOf(id), device: W.phoneWord }))
    if (computerWords) for (const id of unjoined) lines.push(fillText(W.personLine, { name: ctx.nameOf(id), device: W.computerWord }))
    out.deviceLines = lines
    out.deviceIntro = computerWords ? fillText(W.intro, { phones: phoneWords, computers: computerWords }) : fillText(W.introPhones, { phones: phoneWords })
    out.deviceSentence = computerWords ? fillText(W.sentence, { phones: phoneWords, computers: computerWords }) : fillText(W.sentencePhones, { phones: phoneWords })
  }
  return out
}

/** Whether this step reaches the signed-in account: the policy's answer, or the step's list where it has no policy. */
function operatorInScope(step: Step, operatorId: string): boolean {
  return effectsOf(step) === null ? (step.population?.ids ?? []).includes(operatorId) : step.includesOperator === true
}

function operatorSignIns(snapshot: TenantSnapshot, operatorId: string): number | undefined {
  const ev = (snapshot as { signInEvidence?: Record<string, { signInCount?: number }> }).signInEvidence
  return ev?.[operatorId]?.signInCount
}

export { absoluteDate }

/** No scan: only Microsoft's own strengths can be described (operations.ts strengthLookupOf). */
const EMPTY_SCAN = { config: {} } as unknown as TenantSnapshot

/**
 * The plan-wide dates a step's variables read (E7), from the plan's steps and
 * schedule: the first enforcement (the campaign's enrol-by), the day Require
 * MFA for Everyone enforces, the campaign's window from the plan's start to
 * that enrol-by, and whether the unmanaged-browser step is on the plan.
 */
export function planDates(steps: readonly Step[], scheduleStart: string, naming?: NamingConvention, snapshot?: TenantSnapshot): Pick<StepVarContext, 'firstEnforce' | 'mfaEnforce' | 'enrolWindowDays' | 'unmanagedBrowserOnPlan' | 'mfaInPlace' | 'passkeyPolicy' | 'passkeyEnforce' | 'proposed' | 'peoplePolicies'> {
  const firstEnforce = steps.map((s) => s.events?.enforce?.at).filter((x): x is string => typeof x === 'string').sort()[0] ?? null
  const mfa = steps.find((s) => s.goalId === 'mfa-all-users' && s.kind !== 'verify')
  const mfaEnforce = mfa?.events?.enforce?.at ?? firstEnforce
  const enrolWindowDays = firstEnforce ? Math.max(1, Math.ceil((Date.parse(firstEnforce) - Date.parse(scheduleStart)) / 86_400_000)) : null
  const unmanagedBrowserOnPlan = steps.some((s) => (s.goalId === 'block-downloads-unmanaged' || s.goalId === 'byod-session-controls') && s.status !== 'skipped')
  // Require MFA for Everyone in place: the campaign's email is the passkey version,
  // and names the first policy still to enforce that needs a passkey, by its date.
  const mfaInPlace = mfa?.status === 'done'
  const passkey = steps
    // Whether a policy needs a passkey is the policy's own answer, measured
    // against what this tenant says the strength allows. Without the scan only
    // Microsoft's own strengths can be read, and a tenant strength nobody can
    // describe claims nothing (stepPortal.ts needsPasskey).
    .filter((s) => s.status !== 'done' && s.status !== 'skipped' && typeof s.events?.enforce?.at === 'string' && needsPasskey(s, { snapshot: snapshot ?? EMPTY_SCAN }))
    .sort((a, b) => a.events!.enforce.at.localeCompare(b.events!.enforce.at))[0]
  // The plan's policies that prompt a person (the shared-devices step excludes its accounts from each), by content title, in plan order.
  // Which policies prompt a person is the policies' own answer
  // (roadmap/strand.ts promptsPeople); the baseline speaks only for a step with
  // no policy of its own.
  const peoplePolicies = [
    ...new Set(
      steps
        .filter((s) => s.status !== 'skipped' && s.id !== 's-shared-devices' && (contentStepFor(s) as { kind?: string } | undefined)?.kind === 'policy')
        .filter((s) => (effectsOf(s) === null ? promptsPersonForGoal(s.goalId) : promptsPeople(s)))
        .map((s) => contentTitle(s)),
    ),
  ]
  // The proposed names, from the plan's prerequisite steps: the prerequisite step and every portal line name the same group and location.
  return { firstEnforce, mfaEnforce, enrolWindowDays, unmanagedBrowserOnPlan, mfaInPlace, passkeyPolicy: passkey ? contentTitle(passkey) : null, passkeyEnforce: passkey?.events?.enforce.at ?? null, proposed: planProposedNames(steps, naming), peoplePolicies }
}
