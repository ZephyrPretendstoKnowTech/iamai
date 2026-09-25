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
import { operationsOf } from '../../roadmap/operations.ts'
import { estimatedDay, shownDay } from '../../roadmap/stepSchedule.ts'
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import { absoluteDate, longDate } from '../../copy/dates.ts'
import { count, list } from '../../copy/statements.ts'
import { personLabels } from '../../names.ts'
import { NAMES_INLINE } from './whoBlocks.ts'
import { countryName } from '../../mapping/countries.ts'
import { hoursAsDuration, needsPasskey, sessionWantedForGoal, sessionWantedLongForGoal, strengthForGoal, strengthNameOf, pairBaselineNames } from './stepPortal.ts'
import { hoursInWords } from '../../coverage/verdict.ts'
import { analysisUnknown, effectsOf } from '../../roadmap/strand.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { contentLists, NAMES_UP_TO } from '../../derive/contentLists.ts'
import { watchedArrive } from '../../roadmap/observation.ts'
import { reached, stepPopulation } from '../../derive/population.ts'
import { disabledInactiveUsers, notPeopleIds, phoneSignInIds, serviceAccountIdsOf } from '../../derive/sets.ts'
import { securityDefaultsState } from '../../derive/readinessContext.ts'
import { cohortWords, guestsAmong } from '../../derive/whoLine.ts'
import { pickerVars } from './pickerRows.ts'
import { DECISION_STEPS, decisionKeyOf } from '../../roadmap/decisions.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { NamingConvention } from '../../coverage/naming.ts'
import { usable as usableConvention } from '../../roadmap/convention.ts'
import { initialDomain } from '../../validation/rules.ts'
import { exclusionsGroupPolicies, exclusionsReach, groupLookup } from '../../validation/exclusionsGroupPolicies.ts'
import { observationDaysFor } from '../../roadmap/schedule.ts'
import { readyBasis, readyWhen } from '../../derive/readyWhen.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { engine, shared, stepById } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { QUESTION_STEP, answerOf, devicePlanOf } from '../../roadmap/answers.ts'
import { nobodyAffected } from '../../roadmap/timing.ts'
import { SERVICE_ACCOUNTS_TRUSTED_GOAL } from '../../roadmap/generate.ts'
import { PER_USER_MFA_STEP_ID, PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { planProposedNames, proposedNamesFor } from './proposedNames.ts'
import { policyPairNames } from '../../coverage/naming.ts'
import type { ProposedObjectNames } from './proposedNames.ts'
import { exclusionsGroupChoice, groupEvidence } from '../../mapping/safetyChoice.ts'
import { prepareVarsOf } from './prepareSteps.ts'
import { networkDraftOf } from '../../mapping/networkDraft.ts'
import type { DirectoryEvidence } from '../../mapping/safetyChoice.ts'
import { trustedIpLocations } from '../../roadmap/directionAnswers.ts'

export type StepVarContext = {
  snapshot: TenantSnapshot
  mapping: MappingState
  nameOf: (id: string) => string
  /** What this scan's directory reads established about the plan's groups (Foundation C). */
  directory?: DirectoryEvidence
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
  /** The first day of the phase the Plan schedules this step in (ISO), where it has no dated milestone of its own: the day its row's When reads. */
  scheduledOn?: string | null
  /** The one active-people count (Today's denominator), so every step's summary line agrees (walk-51 item 8). */
  /** The groups the plan loaded, for the exclusions-group picker's rows. */
  groups?: GroupMembers
  /** The tenant's naming convention (coverage.organisation.naming): the portal lines name the objects the plan proposes before they exist. */
  naming?: NamingConvention
  /** The names the plan proposes for the objects the tenant lacks, from its prerequisite steps (planDates): the one source the prerequisite step and every portal line name. */
  proposed?: ProposedObjectNames
  /** The plan's steps (planDates): Create the Policies in Report-only reads its policies' own create procedures from them. */
  planSteps?: readonly Step[]
}

/** The long form, in the display time zone, only when the instant is real. */
function long(iso: string | null | undefined): string | undefined {
  return iso ? longDate(iso) : undefined
}
/** The short form, one format everywhere (walk-51 item 5). */
function short(iso: string | null | undefined): string | undefined {
  return iso ? absoluteDate(iso) : undefined
}

/** The Entra portal's name for each method an authentication strength allows. */
const STRENGTH_METHOD_NAMES: Readonly<Record<string, string>> = { windowsHelloForBusiness: 'Windows Hello for Business', fido2: 'Passkeys (FIDO2)', x509CertificateMultiFactor: 'Certificate-based authentication (multifactor)', temporaryAccessPassOneTime: 'Temporary Access Pass (one-time use)', temporaryAccessPassMultiUse: 'Temporary Access Pass (multi-use)' }

/** The methods a strength's allowed combinations select, as the portal names them: the one list the strength step's task, completion and package read. */
export function strengthMethodNames(combinations: readonly string[]): string[] {
  return combinations.map((value) => STRENGTH_METHOD_NAMES[value] ?? value)
}

/**
 * The ranges Define the Trusted Network's task adds: the public ranges saved for
 * the office where there are any, otherwise the content's words for the
 * office's own public ranges (walk list 65).
 */
export function officeRangesOf(step: Pick<Step, 'id' | 'goalId' | 'guidance'>, mapping: MappingState): string | undefined {
  const draft = networkDraftOf(mapping)
  if (draft) return list(draft.ranges)
  const unsaved = (contentStepFor(step) as { rangesUnsaved?: unknown } | undefined)?.rangesUnsaved
  return typeof unsaved === 'string' ? unsaved : undefined
}

/** The tenant's own name, from the one place a snapshot carries it: every surface that names the tenant reads this. */
export function tenantNameOf(snapshot: TenantSnapshot): string {
  const org = snapshot.config.organization?.rows?.[0] as { displayName?: string } | undefined
  return org?.displayName ?? ''
}

/**
 * A step's variables without the days the plan scheduled for it — its announce
 * day, its change or enforcement day, and the report-only day it had been placed
 * on where the scan has not seen it in report-only — for a step the board holds
 * (planBoard.ts boardHolds; owner decision 2, 2026-09-22: a held step carries no
 * date anywhere). A line that names one of those days is not drawn, as it is not
 * drawn on a step the roadmap holds, which carries no events at all
 * (roadmap/holds.ts): otherwise the email under a held step promises the people
 * it reaches a day while the row above it reads "After prerequisites". What the
 * scan read stays — the day the policy went into report-only, the day its
 * window closes.
 *
 * The plan-wide days go too: the day Require MFA for Everyone enforces, the
 * campaign's enrol-by and window, and the passkey email's day. A held campaign
 * kept them, and its email told everyone the day sign-in would change under a
 * row reading "After prerequisites". The device lines were filled from the MFA
 * day inside stepVars, so they are filled again here from the undated values.
 */
export function withoutScheduleDates(v: Record<string, unknown>, step: Step, ctx: StepVarContext): Record<string, unknown> {
  const out: Record<string, unknown> = { ...v, enforce: undefined, enforceLong: undefined, announce: undefined, mfaEnforce: undefined, mfaEnforceLong: undefined, enrollBy: undefined, enrolWindowDays: undefined, passkeyEnforce: undefined, passkeyEnforceLong: undefined }
  if (!step.tracking?.reportOnlyAt) out.reportOnly = undefined
  return Object.assign(out, deviceWords(ctx, out))
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
  const estimate = estimatedDay(step)
  const planned = (iso: string | null | undefined): string | undefined => (iso ? shownDay(iso, estimate, 'sentence') : undefined)
  const ev = step.events
  const enforce = ev?.enforce
  const announce = ev?.announce
  const v: Record<string, unknown> = {
    tenant: tenantNameOf(ctx.snapshot),
    tenantName: tenantNameOf(ctx.snapshot),
    // Which state the scan read security defaults in, as two facts rather than
    // one flag: on, off, or neither where the section was not read. The
    // security-defaults step has a lead per state (content who.leadWhen) and no
    // lead for a state nobody confirmed — it used to describe the protections as
    // present tense on a tenant that had already turned them off (R4).
    securityDefaultsOn: securityDefaultsState(ctx.snapshot) === true || undefined,
    securityDefaultsOff: securityDefaultsState(ctx.snapshot) === false || undefined,
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
    // A day the plan gives a step that is an estimate says so, as the board's
    // row does (roadmap/stepSchedule.ts shownDay): the Dates line read
    // "Report-only from Aug 31, 2026" under a row reading "Est. Aug 31, 2026"
    // (R4-34). These days sit inside sentences, so they take the sentence form,
    // "Aug 31, 2026 (estimated)". The long form is an email's, which already qualifies a day the
    // plan projects (stepExport.ts commsFor), and a day the scan read is no estimate.
    enforce: planned(enforce?.at),
    enforceLong: long(enforce?.at),
    announce: planned(announce?.at),
    // The day Require MFA for Everyone enforces, for the campaign and the device
    // plan (E7); the campaign's window; and what a personal device can still do
    // once devices are required (shared.engine.personalDevices).
    // planDates gives null where Require MFA for Everyone is held: there is no
    // day on which anyone will be asked for MFA, and another policy's turn-on is
    // not one. Only a context with no plan-wide dates at all reads the first enforcement.
    mfaEnforce: short(ctx.mfaEnforce === undefined ? ctx.firstEnforce : ctx.mfaEnforce),
    mfaEnforceLong: long(ctx.mfaEnforce === undefined ? ctx.firstEnforce : ctx.mfaEnforce),
    enrolWindowDays: ctx.enrolWindowDays ?? undefined,
    personalDevicesClause: ctx.unmanagedBrowserOnPlan === undefined ? undefined : ctx.unmanagedBrowserOnPlan ? engine.personalDevices.browserLimited : engine.personalDevices.blocked,
    // Require MFA for Everyone already in place: the campaign email is the passkey
    // version, naming the first policy still to enforce that needs a passkey.
    mfaInPlace: ctx.mfaInPlace ? true : undefined,
    passkeyPolicy: ctx.passkeyPolicy ?? undefined,
    passkeyEnforceLong: long(ctx.passkeyEnforce),
    // A policy already in report-only has its date from the scan (tracking), not
    // from the schedule, which only dates the policies the plan creates.
    reportOnly: step.tracking?.reportOnlyAt ? short(step.tracking.reportOnlyAt) : planned(ctx.reportOnlyAt),
    // The proposed policy name, in the tenant's convention.
    policyName: step.naming?.proposed,
    proposedName: step.naming?.proposed,
    // Why that name (coverage/naming.ts proposeName `matchesTenant`). The line
    // claimed the tenant's own convention whatever the reading was, so a tenant
    // whose names agree on nothing was told sixteen times that a documented
    // pattern was its own.
    // Three cases, not two. The fallback said names "do not agree on one shape"
    // for every tenant without a usable convention - including one with NO
    // Conditional Access policies at all, where nothing exists to agree or
    // disagree. Two readers checked, found zero policies, and stopped believing
    // the line. `Convention.sampled` is how many names were read.
    proposedNameNote: fillText(
      usableConvention(ctx.naming?.convention ?? null)
        ? shared.proposedNameFollowsConvention as string
        : (ctx.naming?.convention?.sampled ?? 0) === 0
          ? shared.proposedNameNoPolicies as string
          : shared.proposedNameDocumented as string,
      { tenant: tenantNameOf(ctx.snapshot) },
    ),
    existingName: step.naming?.fromBaseline ?? undefined,
    // The operator's own sign-in count, when the step reaches the operator (the "Your account is in scope" line);
    // in scope with no records of their own (signed in for this scan, outside the window), the no-records line names them instead.
    // Whether the signed-in account is in scope is the policy's own answer,
    // decided where the scan is and carried on the step (generate.ts
    // includesOperator). A step with no policy of its own reads its reach
    // (derive/population.ts reached), the one its cards read: a delivered step's
    // is the tenant policies' own scope, never the goal's people (operatorInScope).
    operatorSignIns: ctx.operatorId && operatorInScope(step, ctx.operatorId) ? operatorSignIns(ctx.snapshot, ctx.operatorId) : undefined,
    operatorNoRecords: ctx.operatorId && operatorInScope(step, ctx.operatorId) && operatorSignIns(ctx.snapshot, ctx.operatorId) === undefined ? ctx.nameOf(ctx.operatorId) : undefined,
    people: view?.active,
    // The step's people: the active ones it touches, or, for a check step, the
    // accounts it checks (the dormant accounts are by definition not active).
    n: step.preparation ? step.preparation.ids.length : step.kind === 'check' ? step.population.total : view?.active,
    // A preparation cohort in the row's own words: "30 people and 1 guest" (derive/whoLine.ts cohortWords).
    cohort: step.preparation ? cohortWords(step.preparation.ids.length, guestsAmong(step.preparation.ids, step.preparation.guestIds)) : undefined,
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
    // The time gate says one thing about time and nothing about readiness: a
    // closed window is half of what a policy needs, and the Evidence line beside
    // it is the other half (shared.policyDoneWhenTracked).
    v.timeGate = fillText(ready.kind === 'on' ? TRACK.windowCloses : TRACK.windowClosed, { date: absoluteDate(ready.date) })
    // "3 of 30 active people seen" is a count over the deployed policy's own
    // scope. Where that scope could not be settled there is no count to show, so
    // the key is left unset and the line it sits in renders nothing rather than a
    // number nobody established (tracking.ts trackedScope).
    //
    // "0 failing or interrupted" is a count of records, so it needs records: with
    // none read for this policy the failure count is unknown, and the line says
    // that instead of printing the zero an empty set adds up to
    // (roadmap/tracking.ts). The people-seen half is a true count either way —
    // nobody was seen — and stays.
    v.evidenceGate = readyBasis(ready) ?? undefined
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

  // The step that makes the baseline's own authentication strength: it names the
  // strength by the author's name for it (the step carries it, generate.ts) and
  // lists what this tenant has of its own to compare against. Built-ins are not
  // in that list — every tenant has those, and the question the step asks is
  // which *custom* strength, if any, already is the baseline's.
  if (step.id === PREREQ_STEP_ID.authStrength) {
    if (step.naming?.proposed) v.strengthName = step.naming.proposed
    const customs = ((ctx.snapshot.config.authStrengths?.rows ?? []) as Record<string, unknown>[])
      .filter((r) => String(r.policyType ?? 'custom') !== 'builtIn')
      .map((r) => (typeof r.displayName === 'string' ? r.displayName : typeof r.id === 'string' ? r.id : ''))
      .filter((n) => n.length > 0)
    if (customs.length > 0) v.strengths = customs
    // "None matches the baseline's ..." is a claim about the authentication
    // strengths this tenant holds. Where that section did not read, IAMAI has
    // not looked, and the negation would be the R4 fault: a confident no in
    // place of an unfinished reading. The who-line mechanism draws the
    // unresolved sentence in that slot instead (stepExport.ts whoEvidenceLines).
    if (ctx.snapshot.config.authStrengths?.status !== 'ok') v.evidenceNotRead = true
    // The methods the baseline's strength allows, in the portal's own names:
    // the task selects them and the completion names them, from one list.
    const methods = strengthMethodNames(step.authenticationStrengthTarget?.allowedCombinations ?? [])
    if (methods.length > 0) v.strengthMethods = list(methods)
    // A strength of the baseline's name that allows other methods: the step
    // corrects it (whatToDoWhen.strengthToCorrect; walk list 55).
    if (step.strengthToCorrect && !step.state.satisfied) v.strengthToCorrect = step.strengthToCorrect.name
  }

  // Turn Off Security Defaults: the policies it turns on in the same change, in
  // the Plan's order, one task line each (roadmap/enforceWaits.ts noteTurnOns;
  // walk list 4.x item 8). A policy not on the plan leaves its line undrawn.
  for (const [i, t] of (step.turnsOn ?? []).entries()) v[`turnOn${i + 1}`] = t.policy

  // Finish Moving Off Per-User MFA: the accounts the scan reads on (its
  // population, roadmap/manualWork.ts), counted on its card and, twenty or fewer,
  // named with their sign-in addresses on the card and in its task (walk list
  // 4.x items 55 and 57).
  const PER_USER_NAMED = 20
  if (step.id === PER_USER_MFA_STEP_ID && step.population.ids.length > 0) {
    const ids = step.population.ids
    v.perUserOn = count(ids.length, 'account')
    // Every one of them up to twenty (walk list 4.x item 55, the checkers' reading):
    // a Business Premium tenant's list is short, and "7 accounts" named nobody.
    if (ids.length <= PER_USER_NAMED) {
      const labels = personLabels(ctx.snapshot.users, { address: true })
      const names = ids.map((id) => labels.get(id) ?? ctx.nameOf(id))
      v.perUserNames = names.join(', ')
      v.perUserNamed = list(names)
    }
  }

  // Define the Trusted Network: the office ranges its task adds (the ranges
  // saved for the office where there are any, walk list 65), and the picked
  // location it marks trusted instead of making one (walk list 61).
  if (step.id === PREREQ_STEP_ID.trustedLocation) {
    v.officeRanges = officeRangesOf(step, ctx.mapping)
    if (step.officeToTrust?.length) v.officeToTrust = list(step.officeToTrust.map((l) => l.name))
    // Held on the office answer in Decide How and Where People Sign In (walk
    // list 60): what the step makes, if anything, follows that answer, so it
    // draws no card of its own and its action is the answer
    // (whatToDoWhen.officeUnanswered).
    if (step.blockers.some((b) => b.kind === 'decision' && b.label.startsWith('direction:'))) {
      v.officeUnanswered = true
      // Entra already trusts a location: the step says so and sends the person
      // to the one answer that uses it, with no create beside it (net-new 20,
      // owner 2026-09-24; whatToDoWhen.officeUnansweredInEntra).
      const trusted = trustedIpLocations(ctx.snapshot) ?? []
      if (!step.state.satisfied && trusted.length > 0) v.officeUnansweredInEntra = list(trusted.map((l) => l.name))
    }
    // Entra already trusts a location and none is saved as the office: the step
    // asks for the pick on its rail before any create (whatToDoWhen.officeInEntra).
    else if (!step.state.satisfied && !step.officeToTrust?.length && ctx.mapping.trustedLocationIds.length === 0 && (trustedIpLocations(ctx.snapshot) ?? []).length > 0) v.officeInEntra = true
  }

  // Nobody affected (timing.ts, the one definition): the records show nobody
  // using what this step blocks, so the manager's "nobody here used it" clause
  // applies (E9); and the service-accounts group the service-accounts block names.
  if (nobodyAffected(step)) v.nobodyAffected = true
  if (step.goalId === SERVICE_ACCOUNTS_TRUSTED_GOAL) v.serviceAccountsGroup = ctx.mapping.serviceAccountsGroupId ? ctx.nameOf(ctx.mapping.serviceAccountsGroupId) : proposedNamesFor(ctx).serviceAccountsGroup
  // The trusted network by name (the team's own locations, else the plan's proposal: the portal's rule, stepPortal tokenNames), and the policies that prompt a person, for the shared-devices step's own instructions.
  const trustedIds = ctx.mapping.trustedLocationIds ?? []
  v.trustedLocation = trustedIds.length > 0 ? trustedIds.map(ctx.nameOf).join(', ') : proposedNamesFor(ctx).trustedLocation

  // Existing coverage: whether a policy already delivers the goal (drives the
  // {existingCoverage} line's presence). A done step's policies are what makes
  // it In place, not coverage this step's version supersedes; the line names
  // what the consolidation row retires (generate.ts supersededPolicies).
  // Nor where IAMAI watched the policy arrive (roadmap/observation.ts
  // watchedArrive): "{tenant} already covers this with X" is a report about
  // coverage that predates the plan, and What IAMAI found says of the same
  // policy, on the same step, that IAMAI watched it get there. One of the two is
  // always wrong; this is the one that is.
  v.existingPolicies = step.status !== 'done' && step.deliveredBy.length > 0 && !watchedArrive(step) ? step.deliveredBy : []
  // In place: the step asks nobody to do anything, so its email does not render (stepExport.ts commsFor).
  if (step.status === 'done') v.stepDone = true

  // The list variables, derived from what the scan collected (never gated when
  // the data exists): the campaign buckets, the lockout-scenario people, and the
  // emergency/service/admin id sets. A step reads only the keys it uses.
  // With Require MFA for Everyone in place nobody is "registered but never seen to complete MFA" (population.ts campaignBucket).
  Object.assign(v, contentLists({ snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, now: ctx.now, mfaInPlace: ctx.mfaInPlace === true }))
  // The admins the admin policy's own gate counts short (walk list 4.x item 46):
  // "1 admin is not yet Ready for phishing-resistant MFA" read MFA Readiness's
  // state beside a gate at 100%. The admins judged without a method the policy
  // accepts (roadmap/methodReadiness.ts), by name when three or fewer.
  if (step.goalId === 'admins-phishing-resistant' && step.methodPreparation) {
    const p = step.methodPreparation
    const judged = new Set([...p.readyIds, ...p.unknownIds])
    const short = p.ids.filter((id) => !judged.has(id))
    v.adminsWithout = short.length <= NAMES_UP_TO ? short.map(ctx.nameOf) : []
    if (short.length > NAMES_UP_TO) v.adminsWithoutCount = short.length
    else delete v.adminsWithoutCount
  }
  // Disable or Confirm Dormant Accounts' card (walk list items 14, 26): the
  // accounts still to disable or keep, and once none are, how many the person
  // keeps and how many accounts with no sign-in in the last 90 days are
  // disabled in the directory.
  if (step.dormantChoices) {
    v.openAccounts = count(step.dormantChoices.filter((row) => !row.kept).length, 'account')
    v.kept = step.dormantChoices.filter((row) => row.kept).length
    v.disabled = disabledInactiveUsers(ctx.snapshot, ctx.snapshot.asOf, notPeopleIds(ctx.mapping)).length
    // The Satisfied card states what the step guarantees, apart from the accounts kept on purpose.
    const K = (stepById['s-check-dormant-accounts'] as unknown as { card: { allActive: string; allActiveKept: string } }).card
    const kept = v.kept as number
    v.dormantDone = kept > 0 ? fillText(K.allActiveKept, { n: kept }) : K.allActive
  }
  // Register Your Own Passkey's and Prepare Your Team for MFA's own values: the
  // operator's account and devices, the campaign's people by what each needs,
  // and the registration campaign as the scan read it (prepareSteps.ts).
  Object.assign(v, prepareVarsOf(step, ctx))
  // The stored answers in words (E1), for the steps an answer adds; and the
  // device decision's lines (E2): who signs in from a phone or an unjoined
  // computer, one device line per person for the campaign, and the one
  // sentence its email adds.
  Object.assign(v, answerVars(ctx, v))

  // The step's own picker rows (prune B): the emergency, exclusions-group,
  // countries, trusted-network, service-accounts and shared-devices pickers,
  // from the detections the plan runs, in the content file's row shape.
  const decision = (contentStepFor(step) as { decision?: { pickerRow?: string; accountRow?: string } } | undefined)?.decision
  const pickerCtx = { snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, groups: ctx.groups, directory: ctx.directory }
  // Create or Correct Service Accounts Group picks a group (decisions.ts
  // decisionKeyOf); the accounts it holds keep their rows with the signals
  // that nominated them, which the step's evidence lines name.
  if (typeof decision?.accountRow === 'string') Object.assign(v, pickerVars(step.id, decision.accountRow, pickerCtx) ?? {})
  if (typeof decision?.pickerRow === 'string') Object.assign(v, pickerVars(decisionKeyOf(step.id), decision.pickerRow, pickerCtx) ?? {})

  // The service accounts group: the one the picker saved (else the name the
  // plan proposes), how many it holds once it holds exactly the picked
  // accounts, and the picked accounts by name. `serviceGroupFound` names the
  // scanned group the picker pre-fills while nothing is saved.
  if (step.id === PREREQ_STEP_ID.serviceAccountsGroup) {
    const groupId = ctx.mapping.serviceAccountsGroupId
    const group = groupId ? ctx.groups?.get(groupId) : undefined
    const name = groupId ? (group?.displayName ?? ctx.nameOf(groupId)) : step.naming?.proposed
    if (name) v.serviceAccountsGroupName = name
    if (group && step.state.satisfied) v.serviceAccountsGroupMembers = group.memberCount
    v.serviceAccountNames = list(serviceAccountIdsOf(ctx.mapping).map(ctx.nameOf))
    // The group the scan found holding exactly them, nobody has saved it yet;
    // or the saved group whose members differ (roadmap/generate.ts serviceGroup).
    if (step.serviceGroup?.kind === 'found') v.serviceGroupFound = step.serviceGroup.name
    if (step.serviceGroup?.kind === 'correct' && !step.state.satisfied) v.serviceGroupCorrect = step.serviceGroup.name
  }

  // The emergency-access and exclusions-group steps (walk-51 item 14): the
  // failing checks routed through the content checkFixes, the counts for the
  // "{failing} of {total}" line, the operator's own account and the tenant id
  // from the session, and the values the create instructions name.
  // The exclusions group: the recognised group's own line (name, members, how
  // many policies exclude it) and its members; the create instructions show
  // while no group is recognised (its checks need a group to check).
  // The exclusions group's four facts kept apart (Foundation C,
  // mapping/safetyChoice.ts): the group in use is the one the operator
  // confirmed *and* this scan read, so only that state fills {exclusionsGroup}
  // and its counts. A choice this scan did not read keeps the operator's answer
  // and has no line (owner, 2026-09-23); one Graph proved gone says so; a candidate is
  // named as a suggestion and nothing more; and the create instructions show
  // only where the detection was complete enough to say nothing qualifies.
  if (DECISION_STEPS.exclusions.has(step.id)) {
    const choice = exclusionsGroupChoice({ snapshot: ctx.snapshot, mapping: ctx.mapping, groups: ctx.groups, directory: ctx.directory })
    const policies = ctx.snapshot.config.caPolicies?.rows ?? []
    // "Excluded from N of M policies" by the picker's rule, which Impact counts
    // too (validation/exclusionsGroupPolicies.ts exclusionsReach).
    const excludedFrom = (id: string): number => exclusionsReach(policies, id).excludedFrom
    const id = choice.actionableId
    // Two different sentences again. `needsCreate` is a proof: a reading that
    // covered the tenant and found nothing that qualifies. `createIfNeeded` is
    // an offer: nobody has chosen, and IAMAI cannot say whether a group already
    // does this — so the instructions are there for an operator who knows they
    // need one, and the words say which of the two this is
    // (mapping/safetyChoice.ts: the app's group reading is partial).
    v.needsCreate = choice.status === 'none-found'
    // And only where nothing plausible is in view: beside a group IAMAI found,
    // "create one if you do not already have one" asks for a second.
    v.createIfNeeded = choice.status === 'undetermined' && choice.suggested === null
    v.policyCount = exclusionsReach(policies, '').policyCount
    // No group in use: no checks ran, so no count (the population's 0 would read "All 0 checks pass").
    if (id === null) delete v.total
    if (id !== null) {
      const g = ctx.groups?.get(id) ?? [...(ctx.groups ?? [])].find(([k]) => k.toLowerCase() === id.toLowerCase())?.[1] ?? null
      const read = groupEvidence({ snapshot: ctx.snapshot, mapping: ctx.mapping, groups: ctx.groups, directory: ctx.directory }, id)
      const name = g?.displayName ?? read?.displayName ?? choice.actionableName ?? ctx.nameOf(id)
      const memberCount = g?.memberCount ?? read?.memberCount ?? null
      v.excludedFrom = excludedFrom(id)
      // The group's own line carries a member count, so it renders where a scan
      // read the members. Where the object was read and the membership was not,
      // the count is not zero and is not the emergency accounts: the group is
      // named with what is known about it and nothing more.
      if (memberCount === null) {
        // The step's own base value for {memberCount} is the population's, which
        // is zero on a prerequisite: nothing here may read as the group's size.
        delete v.memberCount
        v.exclusionsGroupNoMembers = [name]
      }
      else {
        v.exclusionsGroup = name
        v.memberCount = memberCount
        v.members = (g?.memberIds ?? []).map(ctx.nameOf)
      }
    }
    // The operator's own answer, named back to them where Graph proved it gone.
    // A choice this scan did not read has no line (owner, 2026-09-23).
    const chosen = choice.storedId === null ? null : (choice.storedName ?? ctx.nameOf(choice.storedId))
    if (choice.status === 'invalidated' && chosen) v.missingGroup = [chosen]
    // The group IAMAI found, named and not chosen (safetyChoice.ts `suggested`):
    // the recommendation, or the one verified candidate a partial reading found.
    if (choice.suggested) {
      v.suggestedGroup = [choice.suggested.name]
      if (choice.suggested.memberCount !== null) v.suggestedMemberCount = choice.suggested.memberCount
      v.suggestedExcludedFrom = excludedFrom(choice.suggested.id)
    }
    if (choice.status === 'ambiguous') v.candidateGroups = choice.candidates.map((c) => c.name)
    // Which read came up short, in the engine's own words, and only where one
    // did. Every read succeeding over a reading that is only ever partial is not
    // a group that would not open; the create offer says what that reading is.
    if (choice.status === 'undetermined' && (choice.gap === 'policies' || choice.gap === 'groups')) {
      v.detectionGap = [engine.detectionGap[choice.gap]]
    }
  }
  // A check step with nothing checked (no target the scan could read) shows no count.
  if (step.checks && step.checks.total > 0) {
    v.failing = step.checks.failing
    v.total = step.checks.total
    const toVals = (it: (typeof step.checks.items)[number]): [string, Record<string, unknown>] => {
      const vals: Record<string, unknown> = { ...it.values }
      if (it.subject === 'breakGlass' && it.target && vals.name === undefined) vals.name = ctx.nameOf(it.target)
      return [it.fix, vals]
    }
    // What holds the rollout goes under Fix before continuing; emergency-access
    // hardening is its own section, which the operator may defer (validation/emergencyTiers.ts).
    v.failingChecks = step.checks.items.filter((it) => it.tier !== 'hardening').map(toVals)
    v.hardeningChecks = step.checks.items.filter((it) => it.tier === 'hardening').map(toVals)
    // Fewer than two accounts pass the count check: the create instructions show.
    v.needsCreate = step.checks.items.some((it) => it.fix === 'second-account')
    // The policies that do not yet exclude the exclusions group (the emergency
    // step's who line): the group the operator chose and this scan read, and the
    // list that group's own check names (validation/rules.ts
    // exclusionsGroupPolicies, the one rule). It was read from the accounts' checks, which
    // count an account excluded through any group at all, so the emergency step
    // named one policy for "the exclusions group" while the exclusions step named
    // five. With no group in use there is no such group to name policies for.
    if (DECISION_STEPS.emergency.has(step.id)) {
      const groupId = exclusionsGroupChoice({ snapshot: ctx.snapshot, mapping: ctx.mapping, groups: ctx.groups, directory: ctx.directory }).actionableId
      const notExcluding = groupId === null ? [] : exclusionsGroupPolicies({ policies: ctx.snapshot.config.caPolicies?.rows ?? [], groupId, accountIds: ctx.mapping.breakGlassUserIds, activeRoles: ctx.snapshot.roles.active, membersOf: groupLookup(ctx.groups) }).filter(p => p.outcome !== 'pass').map(p => p.name)
      if (notExcluding.length > 0) v.policiesNotExcluding = notExcluding
    }
    v.tenantId = ctx.snapshot.tenantId
    v.onmicrosoftDomain = initialDomain(ctx.snapshot) ?? undefined
    // A suggested name for a new emergency account (display-name and create).
    v.exampleName = 'Emergency Access'
  }

  // The signed-in person's own name. It depends on nothing but the context, so
  // it is resolved for every step, not only for steps that carry checks: inside
  // that block, Register Your Own Passkey — which has no checks and is the one
  // step whose Who line and Completion Criteria are both about the operator —
  // never got it, and both lines were dropped for a hole on every plan
  // (docs/plans/protect-admins-spec.md section 2).
  v.operator = ctx.operatorId ? ctx.nameOf(ctx.operatorId) : undefined

  if (step.goalId === 'register-info-protected') {
    const ops = operationsOf(step).length ? operationsOf(step) : step.action.resolution?.policies ?? []
    const scopes = ops.map(op => ((op.target ?? op.body) as { conditions?: { users?: { excludeUsers?: string[]; includeUsers?: string[]; includeGuestsOrExternalUsers?: unknown; excludeGuestsOrExternalUsers?: unknown } } }).conditions?.users)
    const W = shared.registrationScope as Record<string, string>
    v.registrationGuestScope = scopes.length === 0 || scopes.some(s => !s) ? W.unknown : scopes.every(s => s?.excludeUsers?.includes('GuestsOrExternalUsers')) ? W.excluded : scopes.some(s => s?.excludeGuestsOrExternalUsers) ? W.partial : scopes.some(s => s?.includeUsers?.includes('All') || s?.includeUsers?.includes('GuestsOrExternalUsers') || s?.includeGuestsOrExternalUsers) ? W.included : W.targeted
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
  const phones = phoneSignInIds(ctx.snapshot) ?? []
  const unjoined = ev?.unjoinedComputers?.people ?? []
  out.phoneUsers = phones.map(ctx.nameOf)
  out.unjoinedUsers = unjoined.map(ctx.nameOf)
  return Object.assign(out, deviceWords(ctx, v))
}

/**
 * The device decision's words, once it is made: one device line per person, the
 * list's lead and the campaign email's sentence (shared.devicePlan), filled from
 * `v`. Enrolled phones are told to enrol before the day Require MFA for Everyone
 * enforces; where there is no such day - that policy held, or the step held
 * (withoutScheduleDates) - they read the same instruction without it
 * (shared.devicePlan.phone.enrolUndated), never "…app before.".
 */
function deviceWords(ctx: StepVarContext, v: Record<string, unknown>): Record<string, unknown> {
  const plan = devicePlanOf(ctx.mapping)
  if (!plan) return {}
  const W = shared.devicePlan as DevicePlanWords
  const phones = phoneSignInIds(ctx.snapshot) ?? []
  const unjoined = ctx.snapshot.scenarioEvidence?.unjoinedComputers?.people ?? []
  const phoneWords = fillText(plan.phones === 'enrol' && v.mfaEnforce === undefined ? W.phone.enrolUndated : W.phone[plan.phones], v)
  const computerWords = plan.computers ? fillText(W.computer[plan.computers], v) : null
  // One line per person (the name and the device); the instruction once, in the list's lead.
  const lines: string[] = phones.map((id) => fillText(W.personLine, { name: ctx.nameOf(id), device: W.phoneWord }))
  if (computerWords) for (const id of unjoined) lines.push(fillText(W.personLine, { name: ctx.nameOf(id), device: W.computerWord }))
  return {
    deviceLines: lines,
    deviceIntro: computerWords ? fillText(W.intro, { phones: phoneWords, computers: computerWords }) : fillText(W.introPhones, { phones: phoneWords }),
    deviceSentence: computerWords ? fillText(W.sentence, { phones: phoneWords, computers: computerWords }) : fillText(W.sentencePhones, { phones: phoneWords }),
  }
}

/**
 * Whether this step reaches the signed-in account. An open policy answers for
 * itself (generate.ts includesOperator). A step with no policy of its own
 * answers from its reach (derive/population.ts reached), the one its cards
 * read: the people it lists, or, while the tenant's policies deliver it, their
 * own scope. Where that delivered reach is not established, the delivering
 * policies were asked about this one account (generate.ts
 * deliveredReachesOperator), and an answer they could not give counts as
 * reaching it. A delivered step decided this from the goal's people, a list
 * nothing measured for the policies that deliver it. Where their reach is not
 * established the line still shows unless something the scan read in full
 * excludes the account: unknown is not safe.
 */
function operatorInScope(step: Step, operatorId: string): boolean {
  if (effectsOf(step) !== null) return step.includesOperator === true
  const reach = reached(step)
  if (reach === null) return step.deliveredReachesOperator === true
  return (reach?.ids ?? []).includes(operatorId)
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
export function planDates(steps: readonly Step[], scheduleStart: string, naming?: NamingConvention, snapshot?: TenantSnapshot, held: (s: Step) => boolean = () => false): Pick<StepVarContext, 'firstEnforce' | 'mfaEnforce' | 'enrolWindowDays' | 'unmanagedBrowserOnPlan' | 'mfaInPlace' | 'passkeyPolicy' | 'passkeyEnforce' | 'proposed' | 'planSteps'> {
  // `held`: the board's hold (planBoard.ts boardHolds, read by the caller that
  // holds the board). A step the board holds carries no date anywhere (owner
  // decision 2, 2026-09-22), so its turn-on is no other step's date either: not
  // the campaign's enrol-by, not the day Prepare Your Team says Require MFA for
  // Everyone is planned for, not the passkey email's day. These days were read
  // off every step's events and asked only the roadmap's hold.
  const dated = steps.filter((s) => !held(s))
  const firstEnforce = dated.map((s) => s.events?.enforce?.at).filter((x): x is string => typeof x === 'string').sort()[0] ?? null
  const mfa = steps.find((s) => s.goalId === 'mfa-all-users' && s.kind !== 'verify')
  // The MFA policy's own day, and only its own: while something holds it there is
  // no day on which people will be asked for MFA, and another policy's is not one
  // (roadmap/holds.ts; the board's hold as much as the roadmap's). The first
  // enforcement stands in only where there is no MFA step to have a day.
  const mfaEnforce = mfa && (isHeld(mfa) || held(mfa)) ? null : (mfa?.events?.enforce?.at ?? firstEnforce)
  const enrolWindowDays = firstEnforce ? Math.max(1, Math.ceil((Date.parse(firstEnforce) - Date.parse(scheduleStart)) / 86_400_000)) : null
  const unmanagedBrowserOnPlan = steps.some((s) => (s.goalId === 'block-downloads-unmanaged' || s.goalId === 'byod-session-controls') && s.status !== 'skipped')
  // Require MFA for Everyone in place: the campaign's email is the passkey version,
  // and names the first policy still to enforce that needs a passkey, by its date.
  const mfaInPlace = mfa?.status === 'done'
  const passkey = dated
    // Whether a policy needs a passkey is the policy's own answer, measured
    // against what this tenant says the strength allows. Without the scan only
    // Microsoft's own strengths can be read, and a tenant strength nobody can
    // describe claims nothing (stepPortal.ts needsPasskey).
    .filter((s) => s.status !== 'done' && s.status !== 'skipped' && typeof s.events?.enforce?.at === 'string' && needsPasskey(s, { snapshot: snapshot ?? EMPTY_SCAN }))
    .sort((a, b) => a.events!.enforce.at.localeCompare(b.events!.enforce.at))[0]
  // The proposed names, from the plan's prerequisite steps: the prerequisite step and every portal line name the same group and location.
  return { firstEnforce, mfaEnforce, enrolWindowDays, unmanagedBrowserOnPlan, mfaInPlace, passkeyPolicy: passkey ? contentTitle(passkey) : null, passkeyEnforce: passkey?.events?.enforce.at ?? null, proposed: planProposedNames(steps, naming), planSteps: steps }
}
