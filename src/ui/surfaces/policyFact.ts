// What a section 4 policy does, read from the policy itself: "requires MFA for
// All users except Core - Exclusions". One reading, three places (walk list
// 4.x, owner 2026-09-24):
//
// - the Satisfied card states it once the policy is on (item 22): "On ·
//   Requires MFA for All users except Core - Exclusions", in place of "In place ·
//   This is in place already: nothing to create. Keep the policy as it is.";
// - Completion Criteria's first line says it is what IAMAI will see (item 26):
//   "IAMAI sees CA - Require - MFA for all users On, requiring MFA for All users
//   except Core - Exclusions.";
// - AI Info's lead states the action with it (item 31).
//
// The policy is the one IAMAI will read: once the step is done, the tenant
// policy that delivers it; before that, the policy the plan writes (its
// operation's body, or the tracked policy with the patch applied). A shape this
// does not read — a grant control it has no words for, a value not resolved
// yet — says nothing rather than something partly true.
//
// Pure: no DOM, no network.
import type { Step } from '../../roadmap/types.ts'
import { app } from '../../content/content.ts'
import { effectOf, strengthNameIn } from '../../roadmap/operations.ts'
import type { PolicyEffect } from '../../roadmap/operations.ts'
import { isGroupMember } from '../../roadmap/stepGroups.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { count, list } from '../../copy/statements.ts'
import { roleName } from '../../roles.ts'
import { fillText } from '../../content/render.ts'
import type { StepVarContext } from './stepVars.ts'

/** The section whose policy steps read this (roadmap/stepGroups.ts: Turn On MFA for Everyone). */
const SECTION = 'core'
/** The most accounts a fact names before it counts them. */
const NAMED = 3

type FactWords = {
  on: string
  verbs: Record<'blocks' | 'requires', [string, string]>
  legacyClients: string
  exchangeActiveSync: string
  otherClients: string
  deviceCode: string
  authenticationTransfer: string
  signIn: string
  mfa: string
  controls: Record<string, string>
  either: string
  allUsers: string
  guests: string
  fact: string
  except: string
  resources: string
  resourcesExcept: string
}
const W = (): FactWords => (app.plan as unknown as { stepContract: { policyFact: FactWords } }).stepContract.policyFact

/**
 * One policy's fact: its name, what it does in the third person ("requires MFA
 * for All users except Core - Exclusions") and as a participle ("requiring
 * …"), and the resources it reaches ("across All resources except Microsoft
 * Intune Enrollment").
 */
export type PolicyFact = { policy: string; does: string; doing: string; resources: string | null }

type Row = Record<string, unknown>

/** The one policy the step's fact reads, with its name, or null where there is not exactly one. */
function policyOf(step: Step, rows: readonly Row[]): Row | null {
  const byId = (id: string): Row | null => rows.find((r) => String(r.id ?? '').toLowerCase() === id.toLowerCase()) ?? null
  const tracked = (step.tracking?.members ?? []).map((m) => (m.policyId ? byId(m.policyId) : null)).filter((r): r is Row => r !== null)
  if (step.state.satisfied) {
    if (tracked.length === 1) return tracked[0]
    const by = step.satisfiedBy
    const name = by?.sufficient ?? (by?.policies.length === 1 ? by.policies[0] : null)
    return name === null ? null : rows.find((r) => r.displayName === name) ?? null
  }
  const ops = step.action.resolution?.policies ?? []
  if (ops.length === 1) {
    const op = ops[0] as { mode?: string; body?: unknown; target?: unknown; intent?: unknown }
    const body = (op.mode === 'update' ? op.target : op.body) as Row | undefined
    if (!body || typeof body !== 'object') return null
    // What IAMAI will see is the plan's policy (walk list 4.x item 26): a part the
    // correction does not write keeps the tenant's value in the target, so under
    // drift the line read "blocking Other clients", the drifted policy.
    const intent = op.mode === 'update' && op.intent && typeof op.intent === 'object' ? (op.intent as Row) : null
    return intent === null ? body : withIntended(body, intent, step.state.observation?.unwritten ?? [])
  }
  return ops.length === 0 && tracked.length === 1 ? tracked[0] : null
}

/** The policy with the exclusions group excluded, where its users section does not exclude it yet. */
function withGroupExcluded(policy: Row, group: string): Row {
  const conditions = (policy.conditions ?? {}) as Row
  const users = conditions.users as Row | undefined
  if (!users) return policy
  const groups = Array.isArray(users.excludeGroups) ? (users.excludeGroups as string[]) : []
  if (groups.some((g) => g.toLowerCase() === group.toLowerCase())) return policy
  return { ...policy, conditions: { ...conditions, users: { ...users, excludeGroups: [...groups, group] } } }
}

/** The target with each part the plan asks for and the correction does not write taken from the plan's whole policy. */
function withIntended(target: Row, intent: Row, unwritten: readonly string[]): Row {
  if (unwritten.length === 0) return target
  const conditions = { ...((target.conditions ?? {}) as Row) }
  const wanted = (intent.conditions ?? {}) as Row
  const out: Row = { ...target }
  for (const d of unwritten) {
    if (d.startsWith('conditions.')) {
      const key = d.slice('conditions.'.length)
      if (wanted[key] === undefined) delete conditions[key]
      else conditions[key] = wanted[key]
    } else if (d === 'grantControls' || d === 'sessionControls') out[d] = intent[d]
  }
  return { ...out, conditions }
}

/** What the policy stops or asks for, as a verb and its object; null for a grant this does not read. */
function actionOf(e: PolicyEffect, row: Row, strengthName: (id: string) => string | null): { verb: 'blocks' | 'requires'; what: string } | null {
  const w = W()
  if (e.blocks) {
    const flows = e.narrowings.find((n) => n.kind === 'signInFlow') as { methods: string[] } | undefined
    if (flows) {
      const named = flows.methods.map((m) => (/devicecode/i.test(m) ? w.deviceCode : /authenticationtransfer/i.test(m) ? w.authenticationTransfer : null))
      if (named.some((x) => x === null)) return null
      return { verb: 'blocks', what: list(named as string[]) }
    }
    if (e.narrowings.some((n) => n.kind === 'clientAppTypes')) return null
    if (e.narrowings.some((n) => n.kind === 'legacyClients')) {
      // The client app types as the policy lists them; effectOf keeps only that they are all legacy.
      const conditions = (row.conditions ?? {}) as { clientAppTypes?: unknown }
      const types = new Set((Array.isArray(conditions.clientAppTypes) ? conditions.clientAppTypes : []).map((t) => String(t).toLowerCase()))
      return { verb: 'blocks', what: types.has('exchangeactivesync') && types.has('other') ? w.legacyClients : types.has('exchangeactivesync') ? w.exchangeActiveSync : w.otherClients }
    }
    return { verb: 'blocks', what: w.signIn }
  }
  if (e.strength) {
    const name = strengthName(e.strength.id)
    return name === null ? null : { verb: 'requires', what: name }
  }
  const controls = [...e.controls].map((c) => (c === 'mfa' ? w.mfa : w.controls[c] ?? null))
  if (controls.length === 0 || controls.some((c) => c === null)) return null
  const named = controls as string[]
  return { verb: 'requires', what: e.operator === 'OR' && named.length > 1 ? fillText(w.either, { a: named.slice(0, -1).join(', '), b: named[named.length - 1] }) : list(named) }
}

/**
 * The fact of one step's policy, for a policy step in Turn On MFA for
 * Everyone; null anywhere else, and where the policy is not one this reads.
 */
export function policyFactOf(step: Step, ctx: Pick<StepVarContext, 'snapshot' | 'mapping' | 'nameOf'>): PolicyFact | null {
  if (!isGroupMember(step.id, SECTION)) return null
  if ((contentStepFor(step) as { kind?: unknown } | undefined)?.kind !== 'policy') return null
  const found = policyOf(step, (ctx.snapshot.config.caPolicies?.rows ?? []) as Row[])
  // Every policy the plan leaves behind excludes the exclusions group, whichever
  // step adds it (walk list 4.x items 7 and 26): a policy Configure Emergency
  // Exclusions corrects is finished with the group in it.
  const group = step.state.satisfied ? null : step.action.resolution?.tenant?.exclusionsGroupId ?? step.action.planned?.tenant?.exclusionsGroupId ?? null
  const row = found !== null && group ? withGroupExcluded(found, group) : found
  if (row === null) return null
  const policy = typeof row.displayName === 'string' ? row.displayName.trim() : ''
  if (policy === '') return null
  const e = effectOf(row)
  if (e.unknown.length > 0 || e.scope.unreadable || e.scope.workloadOnly) return null
  const action = actionOf(e, row, (id) => strengthNameIn(id, ctx.snapshot, ctx.mapping))
  if (action === null) return null
  const w = W()
  // A name the scan holds; an id nobody resolved is not a name to print.
  let unresolved = false
  const name = (id: string): string => {
    const n = ctx.nameOf(id)
    if (!n || n.toLowerCase() === id.toLowerCase() || /‹/.test(n)) unresolved = true
    return n
  }
  const accounts = (ids: readonly string[]): string[] => (ids.length > NAMED ? [count(ids.length, 'account')] : ids.map(name))
  // A few roles by name ("Global Administrator"); the baseline's long list counted ("46 admin roles").
  const roles = (ids: readonly string[]): string[] => (ids.length === 0 ? [] : ids.length > NAMED || ids.some((id) => roleName(id) === null) ? [count(ids.length, 'admin role')] : ids.map((id) => roleName(id) as string))
  const s = e.scope
  const who = [
    ...(s.allUsers ? [w.allUsers] : []),
    ...roles(s.roles.include),
    ...s.groups.include.map(name),
    ...accounts(s.users.include),
    ...(!s.allUsers && s.guests.include !== null ? [w.guests] : []),
  ]
  const excluded = [
    ...s.groups.exclude.map(name),
    ...accounts(s.users.exclude),
    ...roles(s.roles.exclude),
    ...(s.guests.exclude !== null ? [w.guests] : []),
  ]
  if (unresolved || who.length === 0) return null
  const whom = excluded.length > 0 ? fillText(w.except, { who: list(who), excluded: list(excluded) }) : list(who)
  const [does, doing] = w.verbs[action.verb].map((verb) => fillText(w.fact, { verb, what: action.what, who: whom }))
  const apps = s.applications
  const all = apps.include.some((a) => a.toLowerCase() === 'all')
  const out = apps.exclude.filter((a) => a.toLowerCase() !== 'none')
  const resources = !all || apps.userActions.length > 0 || apps.authContexts.length > 0 ? null : out.length > 0 ? fillText(w.resourcesExcept, { apps: list(out.map((id) => ctx.nameOf(id))) }) : w.resources
  return { policy, does, doing, resources }
}

/** "Requires MFA for All users except Core - Exclusions": the fact as a card states it. */
export const factSentence = (f: PolicyFact): string => f.does.charAt(0).toUpperCase() + f.does.slice(1)
