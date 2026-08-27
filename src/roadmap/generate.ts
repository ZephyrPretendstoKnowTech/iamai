// Step generation (roadmap.md §1–§6; 2026-08-27 redesign: collapsed phase 0,
// per-tenant impact, safe-today lane, handle-with-care gating, comms drafts,
// operator self-safety, Learn links, auto-scheduling). Pure.
import { docFor } from '../baseline/index.ts'
import type { BaselinePackage } from '../baseline/types.ts'
import { matchesSignature } from '../coverage/classify.ts'
import { policyFacts } from '../coverage/facts.ts'
import type { StrengthLookup } from '../coverage/strength.ts'
import type { CoverageReport, GoalResult } from '../coverage/types.ts'
import { resolvePopulation } from '../coverage/population.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingQuestion, MappingState } from '../mapping/types.ts'
import { WIZARD_QUESTIONS } from '../mapping/wizard.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import type { NameDirectory } from '../names.ts'
import {
  BREAK_GLASS_DRILL_DAYS,
  READINESS_THRESHOLD_ADMINS_PERCENT,
  READINESS_THRESHOLD_DEVICES_PERCENT,
  READINESS_THRESHOLD_MFA_PERCENT,
  SEVERITY_BLOCK,
  SEVERITY_DEFAULT,
  SEVERITY_STRENGTH_OR_DEVICE,
} from './constants.ts'
import { evidenceFor } from './evidence.ts'
import { goalFamily, readinessFor } from './readiness.ts'
import { buildSchedule, nextMonday } from './schedule.ts'
import type { Schedule } from './schedule.ts'
import type { Action, Step, StepPopulation, StepStatus } from './types.ts'

export type RoadmapInput = {
  planId: string
  coverage: CoverageReport
  snapshot: TenantSnapshot
  baseline: BaselinePackage
  baselineAuthor: { author: string; url: string } | null
  mapping: MappingState
  questions: MappingQuestion[]
  viability: MfaViability[]
  strengths: StrengthLookup
  startDate?: string
  operatorUserId?: string | null
  names?: NameDirectory
}

export type RoadmapResult = { steps: Step[]; schedule: Schedule }

const PREREQ_HOWTO: Record<string, string[]> = {
  breakGlass: [
    'Create two cloud-only accounts (no on-premises sync) with long random passwords stored offline.',
    'Assign Global Administrator as a permanent active assignment (not PIM-eligible).',
    'Register a FIDO2 security key on each; never SMS-only.',
    'Add them to the exclusions group, then answer the Setup question so I can validate them.',
  ],
  globalExclusion: [
    'Entra admin center → Groups → New group → Security, assigned membership (never dynamic).',
    'Name it clearly, e.g. "CA - Policy Exclusions".',
    'Add only the break-glass accounts.',
    'Then answer the Setup question so I bind every policy to it.',
  ],
  trustedLocations: [
    'Entra admin center → Protection → Conditional Access → Named locations → + IP ranges location.',
    'Add your egress ranges (never 0.0.0.0/0, nothing wider than /16) and mark as trusted.',
    'Then answer the Setup question.',
  ],
}

const EXTRAS: Pick<
  Step,
  'impact' | 'safeToday' | 'highCare' | 'comms' | 'learn' | 'includesOperator' | 'operatorSafe'
> = {
  impact: '',
  safeToday: false,
  highCare: { userIds: [], ready: true, notes: [] },
  comms: null,
  learn: null,
  includesOperator: false,
  operatorSafe: null,
}

function idFor(prefix: string, key: string): string {
  return `s-${prefix}-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`
}

function population(ids: string[], snapshot: TenantSnapshot, viability: MfaViability[]): StepPopulation {
  const set = new Set(ids)
  const active = viability.filter((v) => set.has(v.userId) && v.activity === 'active').length
  const admins = ids.filter((id) => (snapshot.roles.active[id] ?? []).length > 0).length
  const guests = snapshot.users.filter((u) => set.has(u.id) && u.userType === 'guest').length
  return { total: ids.length, active, admins, guests, ids }
}

// ---- action building (roadmap.md §3) ----

type RawPolicy = Record<string, unknown>

function replaceReferences(policy: RawPolicy, mapping: MappingState): RawPolicy {
  const resolved = new Map<string, string>()
  for (const r of Object.values(mapping.records)) {
    if (r.resolvedId !== null && !r.placeholder.startsWith('__')) resolved.set(r.placeholder, r.resolvedId)
  }
  const g = mapping.records['__globalExclusion']
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (typeof v === 'string') return resolved.get(v) ?? v
    if (v !== null && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as RawPolicy).map(([k, val]) => [k, walk(val)]))
    }
    return v
  }
  const body = walk(structuredClone(policy)) as RawPolicy
  // Ensure the global exclusion group is excluded on every generated policy.
  if (g?.resolvedId) {
    const conditions = (body.conditions ?? {}) as RawPolicy
    const users = (conditions.users ?? {}) as RawPolicy
    const ex = new Set(Array.isArray(users.excludeGroups) ? (users.excludeGroups as string[]) : [])
    ex.add(g.resolvedId)
    users.excludeGroups = [...ex]
    conditions.users = users
    body.conditions = conditions
  }
  return body
}

function unmappedKeysUsedBy(policy: RawPolicy, questions: MappingQuestion[], mapping: MappingState): string[] {
  const text = JSON.stringify(policy)
  return questions
    .filter((q) => {
      const r = mapping.records[q.key]
      const answered = r !== undefined && (r.resolvedId !== null || r.doesNotExist)
      return !answered && text.includes(q.key)
    })
    .map((q) => q.key)
}

function createdWithinStepKeys(policy: RawPolicy, mapping: MappingState): { key: string; group: string }[] {
  const text = JSON.stringify(policy)
  return Object.values(mapping.records)
    .filter((r) => r.doesNotExist && !r.placeholder.startsWith('__') && text.includes(r.placeholder))
    .map((r) => ({ key: r.placeholder, group: r.group }))
}

export function portalSteps(policy: RawPolicy, names?: NameDirectory): string[] {
  const label = (v: unknown): string => {
    if (!Array.isArray(v) || v.length === 0) return ''
    return v.map((x) => (typeof x === 'string' && names ? names.label(x) : String(x))).join(', ')
  }
  const c = (policy.conditions ?? {}) as RawPolicy
  const users = (c.users ?? {}) as RawPolicy
  const apps = (c.applications ?? {}) as RawPolicy
  const g = (policy.grantControls ?? null) as RawPolicy | null
  const s = (policy.sessionControls ?? null) as RawPolicy | null

  const lines = [
    'Entra admin center → Protection → Conditional Access → Policies → New policy',
    `Name: ${String(policy.displayName ?? '')}`,
  ]
  const inc =
    label(users.includeUsers) ||
    (label(users.includeRoles) && `Directory roles: ${label(users.includeRoles)}`) ||
    (label(users.includeGroups) && `Groups: ${label(users.includeGroups)}`)
  lines.push(
    `Users → Include: ${inc || 'as exported'}${label(users.excludeGroups) ? `; Exclude groups: ${label(users.excludeGroups)}` : ''}${label(users.excludeUsers) ? `; Exclude users: ${label(users.excludeUsers)}` : ''}`,
  )
  const appInc = label(apps.includeApplications)
  const actions = label(apps.includeUserActions)
  lines.push(
    actions
      ? `Target resources → User actions: ${actions}`
      : `Target resources → Cloud apps → Include: ${appInc === 'All users' || appInc === 'All' ? 'All resources' : appInc || 'as exported'}`,
  )
  if (label(c.clientAppTypes) && label(c.clientAppTypes) !== 'all') {
    lines.push(`Conditions → Client apps: ${label(c.clientAppTypes)}`)
  }
  const platforms = (c.platforms ?? null) as RawPolicy | null
  if (platforms)
    lines.push(
      `Conditions → Device platforms → Include: ${label(platforms.includePlatforms)}${label(platforms.excludePlatforms) ? `; Exclude: ${label(platforms.excludePlatforms)}` : ''}`,
    )
  const locations = (c.locations ?? null) as RawPolicy | null
  if (locations)
    lines.push(
      `Conditions → Locations → Include: ${label(locations.includeLocations)}${label(locations.excludeLocations) ? `; Exclude: ${label(locations.excludeLocations)}` : ''}`,
    )
  if (label(c.signInRiskLevels)) lines.push(`Conditions → Sign-in risk: ${label(c.signInRiskLevels)}`)
  if (label(c.userRiskLevels)) lines.push(`Conditions → User risk: ${label(c.userRiskLevels)}`)
  const flows = (c.authenticationFlows ?? null) as RawPolicy | null
  if (flows?.transferMethods) lines.push(`Conditions → Authentication flows: ${String(flows.transferMethods)}`)
  if (g) {
    const controls = label(g.builtInControls)
    const strength = (g.authenticationStrength ?? null) as RawPolicy | null
    const grantBits = [
      controls.toLowerCase().includes('block') ? 'Block access' : null,
      controls && !controls.toLowerCase().includes('block') ? `Require: ${controls}` : null,
      strength ? `Require authentication strength: ${names?.label(String(strength.id ?? '')) ?? String(strength.displayName ?? strength.id ?? '')}` : null,
    ].filter(Boolean)
    lines.push(`Grant → ${grantBits.join('; ')}${g.operator === 'AND' ? ' (Require all)' : ''}`)
  }
  if (s) {
    const sif = (s.signInFrequency ?? null) as RawPolicy | null
    const pb = (s.persistentBrowser ?? null) as RawPolicy | null
    const bits = [
      sif?.isEnabled === true ? `Sign-in frequency: ${String(sif.value)} ${String(sif.type)}` : null,
      pb?.isEnabled === true ? `Persistent browser session: ${String(pb.mode)}` : null,
    ].filter(Boolean)
    if (bits.length > 0) lines.push(`Session → ${bits.join('; ')}`)
  }
  lines.push('Enable policy: Report-only → Create')
  return lines
}

export function buildCreateAction(
  baselinePolicy: RawPolicy,
  mapping: MappingState,
  planId: string,
  stepId: string,
  names?: NameDirectory,
): Action {
  const body = replaceReferences(baselinePolicy, mapping)
  delete body.id
  delete body.createdDateTime
  delete body.modifiedDateTime
  body.state = 'enabledForReportingButNotEnforced'
  const tag = `[IAMAI:${planId}:${stepId}]`
  body.description = `${tag}${typeof baselinePolicy.description === 'string' && baselinePolicy.description ? ' ' + baselinePolicy.description : ''}`
  const json = JSON.stringify(body, null, 2)
  const fileName = `${stepId}.json`
  return {
    kind: 'create',
    summary: ['Create this policy in report-only mode; the description tag lets re-scans track it.'],
    json,
    portalSteps: portalSteps(body, names),
    powershell: `Invoke-MgGraphRequest -Method POST -Uri 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies' -ContentType 'application/json' -Body (Get-Content .\\${fileName} -Raw)`,
  }
}

function adjustSummary(result: GoalResult): string[] {
  const out: string[] = []
  for (const r of result.reasons) {
    if (r.kind === 'weaker-control') out.push(`Raise the grant control: ${r.detail}.`)
    if (r.kind === 'session-weaker') out.push(`Tighten the session controls: ${r.detail}.`)
    if (r.kind === 'excluded' && !r.expected) out.push(`Review the exclusion (${r.detail}) — remove it or confirm it in Setup.`)
    if (r.kind === 'not-targeted') out.push(`Extend the include scope: ${r.userIds.length} expected user(s) are never targeted.`)
    if (r.kind === 'apps-narrower') out.push('Broaden the target resources to all apps (currently narrower than the goal).')
    if (r.kind === 'report-only') out.push('The covering policy is report-only — move it to enforced once evidence is clean.')
  }
  if (result.floorRaised) out.push(`The baseline raises the bar to ${result.floorRaised.to} (via ${result.floorRaised.by}).`)
  if (out.length === 0) out.push('Bring the covering policies up to the goal floor.')
  return out
}

// ---- generation ----

export function generateRoadmap(input: RoadmapInput): RoadmapResult {
  const { snapshot, mapping, questions, viability, planId } = input
  const highCareIds = new Set(mapping.highCareUserIds)
  const operatorId = input.operatorUserId ?? null
  const viabilityById = new Map(viability.map((v) => [v.userId, v]))
  const nameOf = (id: string): string => {
    const u = snapshot.users.find((x) => x.id === id)
    return u?.displayName ?? u?.userPrincipalName ?? id
  }
  const tenantName =
    ((snapshot.config.organization?.rows?.[0] ?? {}) as { displayName?: string }).displayName ?? 'your organisation'
  const steps: Step[] = []

  const prereq = (id: string, title: string, why: string, summary: string[], exit: string[]): Step => ({
    id,
    goalId: id.replace(/^s-/, ''),
    phase: 0,
    kind: 'prerequisite',
    title,
    why,
    whyAttribution: null,
    status: 'ready',
    blockedBy: [],
    unblockNotes: [],
    population: { total: 0, active: 0, admins: 0, guests: 0, ids: [] },
    readiness: { family: 'other', percent: null, lines: [] },
    evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
    action: { kind: 'prerequisite', summary, json: null, portalSteps: [], powershell: null },
    exitCriteria: exit,
    rollback: 'Nothing destructive here — objects created can simply be deleted.',
    history: [],
    skipReason: null,
    ...EXTRAS,
  })

  // ---- Phase 0, collapsed: only what genuinely needs a human ----
  const missingSetup = WIZARD_QUESTIONS.filter((q) => q.required && mapping.wizardAnswered[q.id] !== true)
  const setupStepId = 's-setup-questions'
  if (missingSetup.length > 0) {
    steps.push(
      prereq(
        setupStepId,
        `Answer ${missingSetup.length} setup question${missingSetup.length === 1 ? '' : 's'}`,
        'A few answers about your tenant let me generate exact, safe policy changes instead of templates.',
        [
          `Open the Setup step and answer: ${missingSetup.map((q) => q.title).join(', ')}.`,
          'Each takes under a minute; I validate every pick.',
        ],
        ['Every required Setup question answered.'],
      ),
    )
  }

  const bgMissing = mapping.records['__breakGlassMissing']?.doesNotExist === true
  const bgStepId = 's-prereq-break-glass'
  if (bgMissing) {
    steps.push(
      prereq(
        bgStepId,
        'Create two break-glass accounts',
        'Emergency access that works when everything else fails — the non-negotiable first move of any lockout-proof rollout.',
        PREREQ_HOWTO.breakGlass,
        ['Two accounts exist, validated by the Setup question.'],
      ),
    )
  }
  const geMissing = mapping.records['__globalExclusion']?.doesNotExist === true
  const geStepId = 's-prereq-exclusion-group'
  if (geMissing) {
    steps.push(
      prereq(
        geStepId,
        'Create the policy exclusions group',
        'One assigned group, containing only break-glass, excluded from every policy I create — a single, auditable escape hatch.',
        PREREQ_HOWTO.globalExclusion,
        ['The group exists and is picked in Setup.'],
      ),
    )
  }
  const locMissing =
    mapping.wizardAnswered.trustedLocations === true &&
    mapping.trustedLocationIds.length === 0 &&
    questions.some((q) => q.group === 'namedLocations')
  const locStepId = 's-prereq-trusted-location'
  if (locMissing) {
    steps.push(
      prereq(
        locStepId,
        'Create a trusted named location',
        'Some baseline policies treat your office network as a safe context; that needs a named location.',
        PREREQ_HOWTO.trustedLocations,
        ['A trusted location exists and is picked in Setup.'],
      ),
    )
  }

  const secDefaults = (snapshot.config.securityDefaults?.rows?.[0] ?? null) as { isEnabled?: boolean } | null
  if (secDefaults?.isEnabled === true) {
    steps.push(
      prereq(
        's-prereq-security-defaults',
        'Turn off security defaults',
        'Security defaults and Conditional Access are mutually exclusive; the first policy cannot exist while they are on.',
        [
          'Entra admin center → Identity → Overview → Properties → Manage security defaults → Disabled.',
          'Do this only when the phase 1–2 policies are ready to take over.',
        ],
        ['Security defaults report disabled on the next scan.'],
      ),
    )
  }

  // ---- Goal steps ----
  const baselineFactsList = input.baseline.policies.map((p) => ({
    policy: p as unknown as RawPolicy,
    facts: policyFacts(p, input.strengths),
  }))

  for (const result of input.coverage.results) {
    if (result.status === 'not-applicable' || result.status === 'licence-limited' || result.status === 'unknown') continue
    const goal = result.goal
    const impl = goal.implementations[0]
    const stepId = idFor('goal', goal.id)

    const matches = baselineFactsList.filter((b) => matchesSignature(b.facts, impl.signature))
    let source = matches[0] ?? null
    for (const [, chosen] of Object.entries(mapping.variantChoices)) {
      const hit = matches.find((m) => m.facts.name === chosen)
      if (hit) source = hit
    }

    const popIds = impl.expectedWho.kind === 'workload' ? [] : [...resolvePopulation(impl.expectedWho, snapshot).ids]
    const pop = population(popIds, snapshot, viability)
    const readiness = readinessFor(goal.id, popIds, viability, snapshot)
    const matchedPolicyId = findTaggedPolicy(snapshot, planId, stepId)
    const evidence = evidenceFor(goal.id, snapshot, pop.active, matchedPolicyId)

    const doc = source ? docFor(input.baseline.docs, source.facts.name) : undefined
    const why = doc?.intent ?? goal.tldr ?? goal.description
    const whyAttribution = doc?.intent && input.baselineAuthor ? input.baselineAuthor : null

    const floorGrant = impl.floor.grant
    const blockedBy: string[] = []
    const unblockNotes: string[] = []
    let action: Action
    let kind: Step['kind']
    let status: StepStatus = 'ready'

    if (result.status === 'enforced') {
      kind = 'create'
      status = 'done'
      action = {
        kind: 'create',
        summary: ["Already delivered by the tenant's existing policies — nothing to do."],
        json: null,
        portalSteps: [],
        powershell: null,
      }
    } else if (result.status === 'absent') {
      kind = 'create'
      if (source) {
        for (const key of unmappedKeysUsedBy(source.policy, questions, mapping)) {
          void key
          if (missingSetup.length > 0 && !blockedBy.includes(setupStepId)) {
            blockedBy.push(setupStepId)
            unblockNotes.push('finish the Setup questions first')
          }
        }
        for (const created of createdWithinStepKeys(source.policy, mapping)) {
          if (created.group === 'personaGroups') {
            // Created as part of this step — no separate phase-0 noise.
            continue
          }
          const pid =
            created.group === 'breakGlass' ? bgStepId : created.group === 'namedLocations' ? locStepId : geStepId
          if (steps.some((s) => s.id === pid) && !blockedBy.includes(pid)) {
            blockedBy.push(pid)
            unblockNotes.push(`create the missing object first (phase 0)`)
          }
        }
        action = buildCreateAction(source.policy, mapping, planId, stepId, input.names)
        const personas = createdWithinStepKeys(source.policy, mapping).filter((c) => c.group === 'personaGroups')
        for (const p of personas) {
          action.summary.push(
            `This step also creates the assigned group "${p.key}" it targets — create it empty first, pilot users go in later.`,
          )
        }
      } else {
        action = {
          kind: 'create',
          summary: ['No baseline policy matches this goal directly — create a policy meeting the goal floor.'],
          json: null,
          portalSteps: [],
          powershell: null,
        }
      }
    } else {
      kind = 'adjust'
      action = source
        ? { ...buildCreateAction(source.policy, mapping, planId, stepId, input.names), kind: 'adjust', summary: adjustSummary(result) }
        : { kind: 'adjust', summary: adjustSummary(result), json: null, portalSteps: [], powershell: null }
    }

    // Gating (roadmap.md §6).
    if (status !== 'done') {
      const threshold =
        readiness.family === 'mfa' || readiness.family === 'guest'
          ? READINESS_THRESHOLD_MFA_PERCENT
          : readiness.family === 'admin'
            ? READINESS_THRESHOLD_ADMINS_PERCENT
            : readiness.family === 'device'
              ? READINESS_THRESHOLD_DEVICES_PERCENT
              : null
      if (threshold !== null && readiness.percent !== null && readiness.percent < threshold) {
        status = 'blocked'
        unblockNotes.push(
          `readiness is ${readiness.percent}% — the ${readiness.family} threshold is ${threshold}%; verify users first (phase 2)`,
        )
      }
      if (blockedBy.length > 0) status = 'blocked'
    }

    // ---- Redesign extras ----
    const care = popIds.filter((id) => highCareIds.has(id))
    const careNotes: string[] = []
    let careReady = true
    for (const id of care) {
      const v = viabilityById.get(id)
      const ok = v !== undefined && (v.mfa === 'verified' || v.mfa === 'likelyViable')
      if (!ok) {
        careReady = false
        careNotes.push(
          `${nameOf(id)} — ${v?.mfa === 'none' ? 'no MFA method yet: issue a Temporary Access Pass and set up Authenticator together' : 'not verified yet: have them complete one MFA sign-in before this is enforced'}`,
        )
      }
    }
    if (care.length > 0) {
      careNotes.unshift(
        `Rollout order for this step: pilot → everyone else → these ${care.length} user(s) last, after the approach is proven.`,
      )
    }

    const includesOperator = operatorId !== null && popIds.includes(operatorId)
    const opV = operatorId !== null ? viabilityById.get(operatorId) : undefined
    const operatorSafe = includesOperator
      ? (opV !== undefined && (opV.mfa === 'verified' || opV.methodTiers.includes('phishingResistant'))) || false
      : null

    const zeroUsage =
      readiness.family === 'block' &&
      (evidence.status === 'ok' || evidence.status === 'partial') &&
      evidence.affectedUserIds.length === 0
    const notReadyActive =
      pop.active -
      popIds.filter((id) => {
        const v = viabilityById.get(id)
        return v !== undefined && v.activity === 'active' && (v.mfa === 'verified' || v.mfa === 'likelyViable')
      }).length

    let impact: string
    if (status === 'done') impact = 'Already in force — no change for anyone.'
    else if (readiness.family === 'block')
      impact = zeroUsage
        ? 'Zero sign-ins would have been affected in the last 30 days — free security.'
        : `${evidence.affectedUserIds.length} user(s) used this in the last 30 days and would be affected — contact them first.`
    else if (kind === 'adjust') {
      const affected = new Set(result.reasons.flatMap((r) => r.userIds)).size
      impact = `${affected} user(s) see a change; nobody new is targeted.`
    } else if (readiness.family === 'mfa' || readiness.family === 'guest' || readiness.family === 'admin')
      impact =
        notReadyActive > 0
          ? `${notReadyActive} of ${pop.active} active user(s) aren't verified yet — they'd be interrupted at their next sign-in.`
          : `All ${pop.active} active user(s) are ready — enforcement should be a non-event.`
    else impact = `${pop.active} active user(s) in scope.`

    const userFacing =
      status !== 'done' && (readiness.family === 'mfa' || readiness.family === 'guest' || readiness.family === 'device')
    const comms = userFacing
      ? `Hi everyone — from {DATE}, ${tenantName} is stepping up sign-in security. ${
          readiness.family === 'device'
            ? 'Access to company data will require a company-managed device.'
            : 'You may be asked to confirm sign-ins with Microsoft Authenticator.'
        } It takes about two minutes to get ready: go to https://aka.ms/mfasetup and add ${
          readiness.family === 'device' ? 'your work account' : 'Microsoft Authenticator'
        }. Questions or trouble? Reply here and we'll help before the change lands. — IT`
      : null

    const exitCriteria =
      status === 'done'
        ? ['Stays enforced on every re-scan.']
        : [
            'Policy live in report-only for at least 7 days.',
            'At least 1 sign-in per active user in the population (or 500 total).',
            'Zero report-only failures or interruptions.',
            ...(care.length > 0 ? [`Every handle-with-care user in scope is verified (${care.length} to check).`] : []),
            ...(includesOperator ? ['Your own account has a strong method registered — I check this.'] : []),
            'Then enable the policy (Enforce).',
          ]

    steps.push({
      id: stepId,
      goalId: goal.id,
      phase: goal.phase,
      kind,
      title:
        kind === 'adjust' ? `Adjust: ${goal.name}` : status === 'done' ? goal.name : `${floorGrant === 'block' ? 'Block' : 'Create'}: ${goal.name}`,
      why,
      whyAttribution,
      status,
      blockedBy,
      unblockNotes,
      population: pop,
      readiness,
      evidence,
      action,
      exitCriteria,
      rollback:
        kind === 'adjust'
          ? 'Revert the changed fields to their previous values; the previous body is in the policy history.'
          : 'Switch the policy back to report-only (or delete it); nothing else changes.',
      history: [],
      skipReason: null,
      ...EXTRAS,
      impact,
      safeToday: zeroUsage && status === 'ready',
      highCare: { userIds: care, ready: careReady, notes: careNotes },
      comms,
      learn: goal.learnUrl ? { url: goal.learnUrl, tldr: goal.tldr ?? '', cis: goal.cis ?? [] } : null,
      includesOperator,
      operatorSafe,
    })
  }

  // ---- Phase 2 verification campaign ----
  const mfaGoal = input.coverage.results.find((r) => r.goal.id === 'mfa-all-users')
  if (mfaGoal) {
    const counts = new Map<string, number>()
    for (const v of viability) counts.set(v.mfa, (counts.get(v.mfa) ?? 0) + 1)
    const departments = new Set(snapshot.users.map((u) => u.department).filter(Boolean))
    const careList = [...highCareIds].map(nameOf)
    steps.push({
      ...prereq(
        's-verify-mfa',
        'Run the MFA verification campaign',
        'Before MFA is enforced, every active user should have a working, verified method — enforcement should be a non-event.',
        [
          `Work the Readiness table top-down: ${counts.get('none') ?? 0} without a method (issue Temporary Access Passes), ${counts.get('unverified') ?? 0} unverified, ${counts.get('notChallenged') ?? 0} never challenged.`,
          ...(careList.length > 0 ? [`Personally walk through setup with: ${careList.join(', ')} — never an email blast for them.`] : []),
          departments.size > 1
            ? `Pilot suggestion: Verified/Likely-viable users across the ${departments.size} departments, one admin, never break-glass or handle-with-care.`
            : 'Pilot suggestion: a handful of Verified users plus one admin; never break-glass or handle-with-care.',
        ],
        [`Readiness reaches ${READINESS_THRESHOLD_MFA_PERCENT}% of active users.`],
      ),
      phase: 2,
      kind: 'verify',
      goalId: 'mfa-all-users',
      population: population(viability.map((v) => v.userId), snapshot, viability),
      readiness: readinessFor('mfa-all-users', viability.map((v) => v.userId), viability, snapshot),
      comms: `Hi everyone — over the next two weeks ${tenantName} is checking that everyone can use Microsoft Authenticator. Two minutes now saves a lockout later: go to https://aka.ms/mfasetup and add Microsoft Authenticator. We'll follow up personally with anyone who gets stuck. — IT`,
      impact: `${viability.filter((v) => v.activity === 'active' && v.mfa !== 'verified' && v.mfa !== 'likelyViable').length} active user(s) need attention before MFA can be enforced safely.`,
    })
  }

  // ---- Recurring: break-glass drill ----
  const bgIds = mapping.breakGlassUserIds
  if (bgIds.length > 0) {
    const stale = bgIds.filter((id) => {
      const u = snapshot.users.find((x) => x.id === id)
      return (
        !u?.lastSuccessfulSignIn ||
        Date.parse(snapshot.asOf) - Date.parse(u.lastSuccessfulSignIn) > BREAK_GLASS_DRILL_DAYS * 86_400_000
      )
    })
    steps.push({
      ...prereq(
        's-recurring-break-glass-drill',
        'Break-glass sign-in drill',
        `An emergency account that has not signed in for ${BREAK_GLASS_DRILL_DAYS} days is unproven exactly when it matters.`,
        ['Sign in with each break-glass account, complete its strong method, and record the drill.'],
        [`Every break-glass account has a successful sign-in within ${BREAK_GLASS_DRILL_DAYS} days.`],
      ),
      kind: 'recurring',
      goalId: 'recurring:break-glass',
      status: stale.length > 0 ? 'ready' : 'done',
      population: population(bgIds, snapshot, viability),
      readiness: {
        family: 'other',
        percent: null,
        lines: stale.length > 0 ? [`${stale.length} account(s) overdue: ${stale.map(nameOf).join(', ')}`] : ['all accounts recently drilled'],
      },
    })
  }

  // ---- Ordering: phase, then safe-today first, then risk score ----
  const stepSeverity = (s: Step): number => {
    if (s.title.startsWith('Block')) return SEVERITY_BLOCK
    if (/phishing|device|protection/i.test(s.title)) return SEVERITY_STRENGTH_OR_DEVICE
    return SEVERITY_DEFAULT
  }
  const score = (s: Step): number => {
    if (s.safeToday) return -1000
    const sev = s.kind === 'prerequisite' || s.kind === 'recurring' ? 0 : stepSeverity(s)
    return s.population.active * sev - (s.readiness.percent ?? 0)
  }
  steps.sort((a, b) => a.phase - b.phase || score(a) - score(b) || a.id.localeCompare(b.id))

  // ---- Schedule + comms dates ----
  const startIso = input.startDate ?? nextMonday(snapshot.asOf)
  const activeTotal = viability.filter((v) => v.activity === 'active').length
  const schedule = buildSchedule(steps, startIso, activeTotal)
  const phaseStart = new Map(schedule.phases.map((p) => [p.phase, p.start]))
  for (const s of steps) {
    if (s.comms?.includes('{DATE}')) {
      const date = phaseStart.get(s.phase) ?? startIso
      s.comms = s.comms.replaceAll('{DATE}', date.slice(0, 10))
    }
  }

  return { steps, schedule }
}

export function findTaggedPolicy(snapshot: TenantSnapshot, planId: string, stepId: string): string | null {
  const tag = `[IAMAI:${planId}:${stepId}]`
  for (const raw of snapshot.config.caPolicies?.rows ?? []) {
    const p = raw as { id?: string; description?: string }
    if (typeof p.description === 'string' && p.description.includes(tag)) return p.id ?? null
  }
  return null
}
