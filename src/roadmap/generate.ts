// Step generation (roadmap.md §1–§6). Pure.
import { docFor } from '../baseline/index.ts'
import type { BaselinePackage } from '../baseline/types.ts'
import { matchesSignature } from '../coverage/classify.ts'
import { policyFacts } from '../coverage/facts.ts'
import type { StrengthLookup } from '../coverage/strength.ts'
import type { CoverageReport, GoalResult } from '../coverage/types.ts'
import { resolvePopulation } from '../coverage/population.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingQuestion, MappingState } from '../mapping/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
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
}

const GROUP_KIND_LABEL: Record<string, string> = {
  breakGlass: 'break-glass account',
  globalExclusion: 'global exclusion group',
  exclusionGroups: 'exclusion group',
  personaGroups: 'persona group',
  namedLocations: 'named location',
  customStrengths: 'authentication strength',
  servicePrincipals: 'service principal',
  placeholders: 'referenced object',
}

const PREREQ_HOWTO: Record<string, string[]> = {
  breakGlass: [
    'Create a cloud-only account (no on-premises sync) with a long random password stored offline.',
    'Assign Global Administrator as a permanent active assignment (not PIM-eligible).',
    'Register a FIDO2 security key; never SMS-only.',
    'Exclude it from every Conditional Access policy, then re-run Mapping validation.',
  ],
  globalExclusion: [
    'Create an assigned (not dynamic) security group, e.g. "CA - Global Exclusions".',
    'Add only the break-glass accounts.',
    'Use it as the exclusion in every policy this plan creates.',
  ],
  namedLocations: [
    'Entra admin center → Protection → Conditional Access → Named locations → + IP ranges location.',
    'Add your egress ranges (never 0.0.0.0/0, nothing wider than /16) and mark as trusted.',
  ],
  customStrengths: [
    'Entra admin center → Protection → Authentication methods → Authentication strengths → + New.',
    'Allow only the combinations the baseline expects; the Mapping card lists them.',
  ],
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
    if (r.resolvedId !== null) resolved.set(r.placeholder, r.resolvedId)
  }
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (typeof v === 'string') return resolved.get(v) ?? v
    if (v !== null && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as RawPolicy).map(([k, val]) => [k, walk(val)]))
    }
    return v
  }
  return walk(structuredClone(policy)) as RawPolicy
}

function unmappedKeysUsedBy(policy: RawPolicy, questions: MappingQuestion[], mapping: MappingState): string[] {
  const text = JSON.stringify(policy)
  return questions
    .filter((q) => {
      const r = mapping.records[q.key]
      const answered = r !== undefined && r.provenance !== 'auto' && (r.resolvedId !== null || r.doesNotExist)
      return !answered && text.includes(q.key)
    })
    .map((q) => q.key)
}

function doesNotExistKeysUsedBy(policy: RawPolicy, mapping: MappingState): string[] {
  const text = JSON.stringify(policy)
  return Object.values(mapping.records)
    .filter((r) => r.doesNotExist && text.includes(r.placeholder))
    .map((r) => r.placeholder)
}

export function portalSteps(policy: RawPolicy): string[] {
  const c = (policy.conditions ?? {}) as RawPolicy
  const users = (c.users ?? {}) as RawPolicy
  const apps = (c.applications ?? {}) as RawPolicy
  const g = (policy.grantControls ?? null) as RawPolicy | null
  const s = (policy.sessionControls ?? null) as RawPolicy | null
  const list = (v: unknown): string => (Array.isArray(v) && v.length > 0 ? v.join(', ') : '')

  const lines = [
    'Entra admin center → Protection → Conditional Access → Policies → New policy',
    `Name: ${String(policy.displayName ?? '')}`,
  ]
  const inc = list(users.includeUsers) || (list(users.includeRoles) && `Directory roles: ${list(users.includeRoles)}`) || (list(users.includeGroups) && `Groups: ${list(users.includeGroups)}`)
  lines.push(`Users → Include: ${inc || 'as exported'}${list(users.excludeGroups) ? `; Exclude groups: ${list(users.excludeGroups)}` : ''}${list(users.excludeUsers) ? `; Exclude users: ${list(users.excludeUsers)}` : ''}`)
  const appInc = list(apps.includeApplications)
  const actions = list(apps.includeUserActions)
  lines.push(
    actions
      ? `Target resources → User actions: ${actions}`
      : `Target resources → Cloud apps → Include: ${appInc === 'All' ? 'All resources' : appInc || 'as exported'}`,
  )
  if (list(c.clientAppTypes as unknown) && list(c.clientAppTypes as unknown) !== 'all') {
    lines.push(`Conditions → Client apps: ${list(c.clientAppTypes as unknown)}`)
  }
  const platforms = (c.platforms ?? null) as RawPolicy | null
  if (platforms) lines.push(`Conditions → Device platforms → Include: ${list(platforms.includePlatforms)}${list(platforms.excludePlatforms) ? `; Exclude: ${list(platforms.excludePlatforms)}` : ''}`)
  const locations = (c.locations ?? null) as RawPolicy | null
  if (locations) lines.push(`Conditions → Locations → Include: ${list(locations.includeLocations)}${list(locations.excludeLocations) ? `; Exclude: ${list(locations.excludeLocations)}` : ''}`)
  if (list(c.signInRiskLevels)) lines.push(`Conditions → Sign-in risk: ${list(c.signInRiskLevels)}`)
  if (list(c.userRiskLevels)) lines.push(`Conditions → User risk: ${list(c.userRiskLevels)}`)
  const flows = (c.authenticationFlows ?? null) as RawPolicy | null
  if (flows?.transferMethods) lines.push(`Conditions → Authentication flows: ${String(flows.transferMethods)}`)
  if (g) {
    const controls = list(g.builtInControls)
    const strength = (g.authenticationStrength ?? null) as RawPolicy | null
    const grantBits = [
      controls.toLowerCase().includes('block') ? 'Block access' : null,
      controls && !controls.toLowerCase().includes('block') ? `Require: ${controls}` : null,
      strength ? `Require authentication strength: ${String(strength.displayName ?? strength.id ?? '')}` : null,
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
    portalSteps: portalSteps(body),
    powershell: `Invoke-MgGraphRequest -Method POST -Uri 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies' -ContentType 'application/json' -Body (Get-Content .\\${fileName} -Raw)`,
  }
}

function adjustSummary(result: GoalResult): string[] {
  const out: string[] = []
  for (const r of result.reasons) {
    if (r.kind === 'weaker-control') out.push(`Raise the grant control: ${r.detail}.`)
    if (r.kind === 'session-weaker') out.push(`Tighten the session controls: ${r.detail}.`)
    if (r.kind === 'excluded' && !r.expected) out.push(`Review the exclusion (${r.detail}) — remove it or confirm it in Mapping.`)
    if (r.kind === 'not-targeted') out.push(`Extend the include scope: ${r.userIds.length} expected user(s) are never targeted.`)
    if (r.kind === 'apps-narrower') out.push('Broaden the target resources to all apps (currently narrower than the goal).')
    if (r.kind === 'report-only') out.push('The covering policy is report-only — move it to enforced once evidence is clean.')
  }
  if (result.floorRaised) out.push(`The baseline raises the bar to ${result.floorRaised.to} (via ${result.floorRaised.by}).`)
  if (out.length === 0) out.push('Bring the covering policies up to the goal floor.')
  return out
}

// ---- generation ----

export function generateRoadmap(input: RoadmapInput): Step[] {
  const { snapshot, mapping, questions, viability, planId } = input
  const steps: Step[] = []
  const prereqIdByKey = new Map<string, string>()

  // Phase 0: mapping outcomes that don't exist yet, and unanswered references.
  for (const q of questions) {
    const r = mapping.records[q.key]
    const answered = r !== undefined && r.provenance !== 'auto' && (r.resolvedId !== null || r.doesNotExist)
    const label = GROUP_KIND_LABEL[q.group] ?? 'referenced object'
    if (r?.doesNotExist) {
      const id = idFor('prereq', q.key)
      prereqIdByKey.set(q.key, id)
      steps.push({
        id,
        goalId: `prereq:${q.key}`,
        phase: 0,
        kind: 'prerequisite',
        title: `Create the ${label} the baseline expects (${q.key})`,
        why: `The baseline references a ${label} that does not exist in this tenant yet. Later steps depend on it.`,
        whyAttribution: null,
        status: 'ready',
        blockedBy: [],
        unblockNotes: [],
        population: { total: 0, active: 0, admins: 0, guests: 0, ids: [] },
        readiness: { family: 'other', percent: null, lines: [] },
        evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
        action: {
          kind: 'prerequisite',
          summary: PREREQ_HOWTO[q.group] ?? [`Create the ${label}, then map it in Mapping — validation runs automatically.`],
          json: null,
          portalSteps: [],
          powershell: null,
        },
        exitCriteria: ['The object exists and its Mapping validation passes.'],
        rollback: 'Delete the created object; nothing else references it until later steps run.',
        history: [],
        skipReason: null,
      })
    } else if (!answered) {
      const id = idFor('map', q.key)
      prereqIdByKey.set(q.key, id)
      steps.push({
        id,
        goalId: `map:${q.key}`,
        phase: 0,
        kind: 'prerequisite',
        title: `Map the ${label} "${q.key}" to your tenant`,
        why: 'Steps that generate policy JSON need every referenced object resolved to a real tenant object.',
        whyAttribution: null,
        status: 'ready',
        blockedBy: [],
        unblockNotes: [],
        population: { total: 0, active: 0, admins: 0, guests: 0, ids: [] },
        readiness: { family: 'other', percent: null, lines: [] },
        evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
        action: {
          kind: 'prerequisite',
          summary: ['Open the Mapping step and answer this reference (or mark it "doesn\'t exist yet").'],
          json: null,
          portalSteps: [],
          powershell: null,
        },
        exitCriteria: ['The reference is confirmed in Mapping.'],
        rollback: 'Nothing to roll back.',
        history: [],
        skipReason: null,
      })
    }
  }

  // Phase 0: security defaults must be off before CA policies can exist.
  const secDefaults = (snapshot.config.securityDefaults?.rows?.[0] ?? null) as { isEnabled?: boolean } | null
  if (secDefaults?.isEnabled === true) {
    steps.push({
      id: 's-prereq-security-defaults',
      goalId: 'prereq:security-defaults',
      phase: 0,
      kind: 'prerequisite',
      title: 'Turn off security defaults',
      why: 'Security defaults and Conditional Access are mutually exclusive; the first CA policy cannot be created while they are on.',
      whyAttribution: null,
      status: 'ready',
      blockedBy: [],
      unblockNotes: [],
      population: { total: 0, active: 0, admins: 0, guests: 0, ids: [] },
      readiness: { family: 'other', percent: null, lines: [] },
      evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
      action: {
        kind: 'prerequisite',
        summary: ['Entra admin center → Identity → Overview → Properties → Manage security defaults → Disabled.', 'Do this only when the phase-1/2 policies are ready to take over.'],
        json: null,
        portalSteps: [],
        powershell: null,
      },
      exitCriteria: ['Security defaults report as disabled on the next scan.'],
      rollback: 'Re-enable security defaults from the same page.',
      history: [],
      skipReason: null,
    })
  }

  // Goal steps.
  const baselineFactsList = input.baseline.policies.map((p) => ({
    policy: p as unknown as RawPolicy,
    facts: policyFacts(p, input.strengths),
  }))

  for (const result of input.coverage.results) {
    if (result.status === 'not-applicable' || result.status === 'licence-limited' || result.status === 'unknown') continue
    const goal = result.goal
    const impl = goal.implementations[0]
    const stepId = idFor('goal', goal.id)

    // The baseline policy backing this goal (variant choice wins).
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
    const why = doc?.intent ?? goal.description
    const whyAttribution = doc?.intent && input.baselineAuthor ? input.baselineAuthor : null

    const floorGrant = impl.floor.grant
    const severity =
      floorGrant === 'block'
        ? SEVERITY_BLOCK
        : floorGrant === 'phishingResistant' || floorGrant === 'compliantDevice' || floorGrant === 'approvedApplication'
          ? SEVERITY_STRENGTH_OR_DEVICE
          : SEVERITY_DEFAULT

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
        summary: ['Already delivered by the tenant\'s existing policies — nothing to do.'],
        json: null,
        portalSteps: [],
        powershell: null,
      }
    } else if (result.status === 'absent') {
      kind = 'create'
      if (source) {
        for (const key of unmappedKeysUsedBy(source.policy, questions, mapping)) {
          const pid = prereqIdByKey.get(key)
          if (pid) {
            blockedBy.push(pid)
            unblockNotes.push(`map "${key}" in Mapping`)
          }
        }
        for (const key of doesNotExistKeysUsedBy(source.policy, mapping)) {
          const pid = prereqIdByKey.get(key)
          if (pid) {
            blockedBy.push(pid)
            unblockNotes.push(`create the missing object "${key}" (phase 0)`)
          }
        }
        action = buildCreateAction(source.policy, mapping, planId, stepId)
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
        ? { ...buildCreateAction(source.policy, mapping, planId, stepId), kind: 'adjust', summary: adjustSummary(result) }
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

    steps.push({
      id: stepId,
      goalId: goal.id,
      phase: goal.phase,
      kind,
      title:
        kind === 'adjust'
          ? `Adjust: ${goal.name}`
          : status === 'done'
            ? goal.name
            : `${floorGrant === 'block' ? 'Block' : 'Create'}: ${goal.name}`,
      why,
      whyAttribution,
      status,
      blockedBy,
      unblockNotes,
      population: pop,
      readiness,
      evidence,
      action,
      exitCriteria:
        status === 'done'
          ? ['Stays enforced on every re-scan.']
          : [
              'Policy live in report-only for at least 7 days.',
              'At least 1 sign-in per active user in the population (or 500 total).',
              'Zero report-only failures or interruptions.',
              'Then enable the policy (Enforce).',
            ],
      rollback:
        kind === 'adjust'
          ? 'Revert the changed fields to their previous values; the previous body is in the policy history.'
          : 'Switch the policy back to report-only (or delete it); nothing else changes.',
      history: [],
      skipReason: null,
    })
  }

  // Phase 2 verification campaign.
  const mfaGoal = input.coverage.results.find((r) => r.goal.id === 'mfa-all-users')
  if (mfaGoal) {
    const counts = new Map<string, number>()
    for (const v of viability) counts.set(v.mfa, (counts.get(v.mfa) ?? 0) + 1)
    const departments = new Set(snapshot.users.map((u) => u.department).filter(Boolean))
    steps.push({
      id: 's-verify-mfa',
      goalId: 'mfa-all-users',
      phase: 2,
      kind: 'verify',
      title: 'Run the MFA verification campaign',
      why: 'Before MFA is enforced, every active user should have a working, verified method — enforcement should be a non-event.',
      whyAttribution: null,
      status: 'ready',
      blockedBy: [],
      unblockNotes: [],
      population: population(viability.map((v) => v.userId), snapshot, viability),
      readiness: readinessFor('mfa-all-users', viability.map((v) => v.userId), viability, snapshot),
      evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
      action: {
        kind: 'verify',
        summary: [
          `Work the Readiness table top-down: ${counts.get('none') ?? 0} without a method (issue Temporary Access Passes), ${counts.get('unverified') ?? 0} unverified, ${counts.get('notChallenged') ?? 0} never challenged.`,
          'Comms template: [placeholder — announce the change, the date, and the help path].',
          departments.size > 1
            ? `Pilot suggestion: pick Verified/Likely-viable users across the ${departments.size} departments, one admin, never break-glass.`
            : 'Pilot suggestion: pick a handful of Verified users plus one admin; never break-glass.',
        ],
        json: null,
        portalSteps: [],
        powershell: null,
      },
      exitCriteria: [`Readiness reaches ${READINESS_THRESHOLD_MFA_PERCENT}% of active users.`],
      rollback: 'Nothing to roll back — this step only verifies people.',
      history: [],
      skipReason: null,
    })
  }

  // Recurring: break-glass drill.
  const bgIds = Object.values(mapping.records)
    .filter((r) => r.group === 'breakGlass' && r.resolvedId !== null)
    .map((r) => r.resolvedId as string)
  if (bgIds.length > 0) {
    const stale = bgIds.filter((id) => {
      const u = snapshot.users.find((x) => x.id === id)
      return (
        !u?.lastSuccessfulSignIn ||
        Date.parse(snapshot.asOf) - Date.parse(u.lastSuccessfulSignIn) > BREAK_GLASS_DRILL_DAYS * 86_400_000
      )
    })
    steps.push({
      id: 's-recurring-break-glass-drill',
      goalId: 'recurring:break-glass',
      phase: 0,
      kind: 'recurring',
      title: 'Break-glass sign-in drill',
      why: `A break-glass account that has not signed in for ${BREAK_GLASS_DRILL_DAYS} days is unproven exactly when it matters.`,
      whyAttribution: null,
      status: stale.length > 0 ? 'ready' : 'done',
      blockedBy: [],
      unblockNotes: [],
      population: population(bgIds, snapshot, viability),
      readiness: { family: 'other', percent: null, lines: stale.length > 0 ? [`${stale.length} account(s) overdue`] : ['all accounts recently drilled'] },
      evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
      action: {
        kind: 'recurring',
        summary: ['Sign in with each break-glass account, complete its strong method, and record the drill.'],
        json: null,
        portalSteps: [],
        powershell: null,
      },
      exitCriteria: [`Every break-glass account has a successful sign-in within ${BREAK_GLASS_DRILL_DAYS} days.`],
      rollback: 'Nothing to roll back.',
      history: [],
      skipReason: null,
    })
  }

  // Ordering (roadmap.md §2): phase, then risk score ascending.
  const score = (s: Step): number => {
    const sev = s.kind === 'prerequisite' || s.kind === 'recurring' ? 0 : stepSeverity(s)
    return s.population.active * sev - (s.readiness.percent ?? 0)
  }
  return steps.sort((a, b) => a.phase - b.phase || score(a) - score(b) || a.id.localeCompare(b.id))
}

function stepSeverity(s: Step): number {
  if (s.title.startsWith('Block')) return SEVERITY_BLOCK
  if (/phishing|device|protection/i.test(s.title)) return SEVERITY_STRENGTH_OR_DEVICE
  return SEVERITY_DEFAULT
}

export function findTaggedPolicy(snapshot: TenantSnapshot, planId: string, stepId: string): string | null {
  const tag = `[IAMAI:${planId}:${stepId}]`
  for (const raw of snapshot.config.caPolicies?.rows ?? []) {
    const p = raw as { id?: string; description?: string }
    if (typeof p.description === 'string' && p.description.includes(tag)) return p.id ?? null
  }
  return null
}
