// Projecting an implementation-content package into what one step shows now.
//
// The package owns the words (CONTENT.md) and the rules for choosing them
// (META.json and the structured fields beside its prose); IAMAI owns the state,
// the tenant's values and what a person has confirmed. This module joins the two
// and adds nothing of its own: a state selects the blocks META.json names for it,
// a Partial state composes only the correction modules the engine's semantic
// facts select, a prerequisite the next transition needs holds that transition's
// artifacts until it is satisfied, and bindings fill the blocks — or, where a
// required value is missing, nothing is produced at all. It never selects a block
// by its heading, its position or a policy's name, and it interprets no prose.
//
// Pure: no DOM, no network, no clock.
import type { Block, CompiledPackage, PackageState, Prerequisite, ProjectionRef, VerifiedSource } from './protocol.ts'
import { BINDING, CHANGED_FIELDS_BINDING, PACKAGE_STATES, memberChangedFieldsBinding, mismatchBindingOf, refsOf } from './protocol.ts'
import type { Bindings, ConditionContext } from './conditions.ts'
import { holds, present } from './conditions.ts'
import { renderInvocation } from './invocation.ts'
import type { ScriptRun } from './invocation.ts'
import type { OwnerConfirmation } from '../../roadmap/decisions.ts'

export { PACKAGE_STATES, present }
export type { Bindings, PackageState }

/**
 * The viewer's channel order: the approved selector's Entra, PowerShell, JSON
 * and AI Info (docs/design/approved/anatomy/plan-step-v1.html `.impl-tabs`),
 * with Email appended as the owner authorised.
 */
export const OUTPUT_ORDER = ['entra', 'powershell', 'json', 'aiInfo', 'email'] as const
export type OutputChannel = (typeof OUTPUT_ORDER)[number]

/** What IAMAI's runtime knows beside the bindings: the prerequisites satisfied now, and the baseline this build pins. */
export type RuntimeContext = { satisfied: ReadonlySet<string>; baselineCommit: string | null }

export const NO_RUNTIME: RuntimeContext = { satisfied: new Set(), baselineCommit: null }

export type ChannelArtifact = {
  channel: OutputChannel
  /** The block ids that made it, in projection order, each once. */
  blocks: string[]
  format: string
  /** The bound text: what the preview shows, the viewer expands and Copy copies. */
  text: string
  /** A JSON body's request, bound: `PATCH /identity/conditionalAccess/policies/<id>`. */
  requests: { method: string; endpoint: string }[]
  /** A mode-based script's first mode, and every correction its runs ask of it. */
  mode: string | null
  corrections: string[]
  /** Every run of a mode-based script, in projection order; empty for anything else. */
  runs: ScriptRun[]
  /** An Email block's declared audience and trigger (guide §26.6). */
  communication: { audience: string; trigger: string; purpose: string } | null
}

/**
 * Why a projection produced nothing: a required value IAMAI does not hold, an
 * engine fact no correction module covers, a prerequisite the next transition
 * needs that nobody has satisfied, a state the package projects nothing for, or
 * bound output that does not hold together.
 */
export type Hold = { missingBindings: string[]; unknownMismatches: string[]; pendingPrerequisites: string[]; noProjection: boolean; invalid: string[] }

/**
 * `preview`: a planning preview (projectPlanned) — the planned work with readable
 * stand-ins for the values IAMAI does not hold yet, never executable, and its
 * `hold` says what is unresolved.
 */
export type Projection = { state: PackageState; hold: Hold | null; channels: ChannelArtifact[]; preview?: true; degraded?: Withheld[] }

/** A channel withheld on its own while the others project: the values it lacks, or why its bound output does not hold together. */
export type Withheld = { channel: OutputChannel; missingBindings: string[]; invalid: string[] }

const emptyHold = (): Hold => ({ missingBindings: [], unknownMismatches: [], pendingPrerequisites: [], noProjection: false, invalid: [] })

/**
 * The states in which a step has nothing to implement now: delivered, held, a
 * question for a person, a source that contradicts itself, a licence the tenant
 * lacks. Their projection is empty whatever a package authors for them, so the
 * step shows its own no-action box.
 */
export const NO_ACTION_STATES: ReadonlySet<PackageState> = new Set<PackageState>(['inPlace', 'blocked', 'needsDecision', 'sourceConflict', 'notLicensed'])

/** The authored marker on a line that disappears when its optional value is unavailable, in either of the library's spellings ("when" and "if"). */
const OMIT = /\s*\[omit (?:this line )?(?:when|if) unavailable\]/g

/**
 * A binding and the template's full stop after it, if there is one (an ellipsis
 * is not a stop). A value that already ends a sentence keeps its own stop and
 * the template's goes: the blockers are bound as whole sentences (stepPackage.ts)
 * and "Blockers: {{dependencies.blockers}}. Resolve …" read "… first.. Resolve …"
 * (Phase 2 export finding 18).
 */
const BINDING_STOP = new RegExp(`${BINDING.source}(\\.(?!\\.))?`, 'g')

/**
 * A tenant's free text on one line. A directory or policy name is stored as read,
 * and a line break in one, put into a sentence, a list item or a script's `#`
 * comment, ends that line: the rest of the name became code in a handed-over
 * script (review 6 R6-1). Line breaks and other control characters read as one
 * space; a tab stays. `{{json:x}}` values are JSON-encoded instead and keep theirs.
 */
export function oneLine(text: string): string {
  return text.replace(/[\u0000-\u0008\u000a-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ')
}

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? oneLine(x) : JSON.stringify(x))).join(', ')
  if (typeof v === 'string') return oneLine(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

/**
 * Whether IAMAI holds a binding: a value it has, or a null it set on purpose. A
 * resolved policy that sets no session control carries `sessionControls: null`,
 * and that null is the baseline's own value, not a value IAMAI lacks (correction
 * batch 1). A key IAMAI never set is not held.
 */
export function bound(bindings: Bindings, key: string, emptyOk: ReadonlySet<string> = NO_EMPTY): boolean {
  if (!Object.hasOwn(bindings, key)) return false
  const v = bindings[key]
  return v === null || present(v) || (emptyOk.has(key) && Array.isArray(v))
}

const NO_EMPTY: ReadonlySet<string> = new Set()

/**
 * The bindings a package declares a resolved empty list is a value for
 * (`resolvedEmptyBindings`): the authoritative target sets the list, and it is
 * empty — the session policy's excluded accounts, where the pinned target excludes
 * nobody. A key IAMAI did not bind is still missing, a non-list is not a value, and
 * no other required binding becomes optional.
 */
export function resolvedEmptyOf(pkg: { meta: Record<string, unknown> }): ReadonlySet<string> {
  return new Set(asStrings(pkg.meta.resolvedEmptyBindings))
}

/**
 * An IAMAI binding left in bound text, or an authoring marker: the one pattern that
 * means a projection is unfinished. A script's own literal (`-like '{{*'`) is not a
 * binding, and a check that read every `{{` as one held two packages' every channel.
 */
export const UNRESOLVED = /\{\{(?:json:)?[A-Za-z0-9_.-]+\}\}|\[omit (?:this line )?(?:when|if) unavailable\]/

/**
 * A block's text with the tenant's values in place. `{{json:x}}` is replaced by
 * the JSON encoding of the value — `null` where the value is null — and `{{x}}` by
 * its text. A line naming an optional value IAMAI does not have disappears whole,
 * marker and all; a missing required value refuses the block rather than printing
 * a placeholder.
 *
 * A line that introduces indented lines — it ends in a colon — goes with them
 * when every one of them has gone, and a numbered list below it closes the gap.
 * The managed-device create read "5. Conditions → set only what IAMAI resolved,
 * and set each one through its own Configure toggle:" and then "6. Grant", on a
 * target with no location or platform condition: an instruction to set a list
 * of conditions that lists none (Priya D9). With no condition to set, there is
 * no step for Conditions, and every condition stays at its default.
 */
export function bindText(text: string, bindings: Bindings, required: ReadonlySet<string>, emptyOk: ReadonlySet<string> = NO_EMPTY): { text: string } | { missing: string[] } {
  const missing = new Set<string>()
  const lines = text.split('\n')
  const out: (string | null)[] = []
  for (const line of lines) {
    const used = [...line.matchAll(BINDING)].map((m) => ({ json: m[1] !== undefined, key: m[2] }))
    // A whole JSON value may be null; a word in a sentence may not.
    const absent = used.filter((u) => (u.json ? !bound(bindings, u.key, emptyOk) : !present(bindings[u.key]))).map((u) => u.key)
    if (absent.length > 0) {
      for (const b of absent) if (required.has(b)) missing.add(b)
      out.push(null)
      continue
    }
    out.push(line.replace(BINDING_STOP, (_m, json: string | undefined, key: string, stop: string | undefined) => {
      const value = json ? JSON.stringify(bindings[key]) : formatValue(bindings[key])
      return stop === undefined || (!json && /[.!?]$/.test(value)) ? value : `${value}${stop}`
    }).replace(OMIT, ''))
  }
  if (missing.size > 0) return { missing: [...missing] }
  for (let i = 0; i < lines.length; i++) {
    const intro = out[i]
    if (intro === null || !/:\s*$/.test(intro)) continue
    let end = i + 1
    while (end < lines.length && /^[ \t]+\S/.test(lines[end])) end++
    if (end === i + 1 || out.slice(i + 1, end).some((l) => l !== null)) continue
    out[i] = null
    const at = /^(\d+)\.\s/.exec(intro)
    if (at === null) continue
    // The numbered lines that follow it in the same list, each one earlier.
    for (let k = end; k < lines.length; k++) {
      const l = out[k]
      if (l === null || l.trim() === '' || /^[ \t]/.test(l)) continue
      const n = /^(\d+)\.(\s)/.exec(l)
      if (n === null) break
      if (Number(n[1]) > Number(at[1])) out[k] = `${Number(n[1]) - 1}.${l.slice(n[1].length + 1)}`
    }
  }
  return { text: out.filter((l): l is string => l !== null).join('\n').replace(/\s+$/, '') }
}

/** An endpoint with its single-brace identity filled (`/policies/{policy.current.id}`), or the bindings it lacks. */
function bindEndpoint(endpoint: string, bindings: Bindings): { endpoint: string } | { missing: string[] } {
  const missing: string[] = []
  const bound = endpoint.replace(/\{([A-Za-z0-9_.-]+)\}/g, (_m, key: string) => {
    if (!present(bindings[key])) {
      missing.push(key)
      return ''
    }
    return formatValue(bindings[key])
  })
  return missing.length > 0 ? { missing } : { endpoint: bound }
}

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

/** The request methods that change an object that exists, and so must name it. */
const CHANGE_METHODS: ReadonlySet<string> = new Set(['PATCH', 'PUT', 'DELETE'])

/** An endpoint template that names the object it addresses (`/policies/{policy.current.id}`). */
const ENDPOINT_IDENTITY = /\{[A-Za-z0-9_.-]+\}/

/**
 * An endpoint whose object Microsoft names itself: an authentication method's
 * configuration is addressed by the method's fixed id
 * (`/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/fido2`),
 * not by a tenant value IAMAI binds. Nothing else is exempt from naming its target.
 */
const FIXED_IDENTITY = /^https:\/\/graph\.microsoft\.com\/v1\.0\/policies\/authenticationMethodsPolicy\/authenticationMethodConfigurations\/[A-Za-z0-9]+$/

/** Graph's JSON batch endpoint: the requests it sends travel inside its body. */
const BATCH_ENDPOINT = /^https:\/\/graph\.microsoft\.com\/v1\.0\/\$batch$/
/** The one collection a batch sub-request may create a policy in. */
const CA_POLICIES = '/identity/conditionalAccess/policies'
/** A batch sub-request that changes a policy names one member's own bound id: `…/policies/{policies.<family>.<role>.current.id}`. */
const MEMBER_POLICY_URL = /^\/identity\/conditionalAccess\/policies\/\{(policies\.[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.current\.id)\}$/
/** A sub-request url in a JSON block's template that names an identity to bind. */
const BATCH_URL_IDENTITY = /"url":"[^"]*\{([A-Za-z0-9_.-]+)\}"/g
const POLICY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The endpoint-identity guard, reaching into a Graph JSON batch. Every sub-request
 * is one of the package's pinned members, once, by its role. A POST creates in
 * the policies collection. A PATCH addresses that same member's own policy id,
 * bound from a value IAMAI holds: a missing one withholds the channel on it; a
 * value that is not an id, or one another sub-request already targets, is
 * refused. Any other method, url or a body naming an id is refused. The bound ids
 * replace the url templates; `text` is null where nothing needed binding. Graph
 * runs a batch's requests independently: it is not atomic.
 */
function batchRequests(parsed: unknown, pkg: CompiledPackage, b: Bindings, standIns: Readonly<Record<string, string>>): { text: string | null } | { missing: string[] } | { invalid: string[] } {
  const requests = (parsed as { requests?: unknown } | null)?.requests
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length !== 1 || !Array.isArray(requests) || requests.length === 0) return { invalid: ['a $batch body that is not one list of requests'] }
  const roles = new Set((pkg.meta.baselineAuthority?.members ?? []).map((m) => m.role))
  const invalid: string[] = []
  const missing: string[] = []
  const seen = new Set<string>()
  const targets = new Set<string>()
  let rebound = false
  for (const r of requests as unknown[]) {
    const q = (r !== null && typeof r === 'object' && !Array.isArray(r) ? r : {}) as Record<string, unknown>
    const role = typeof q.id === 'string' ? q.id : ''
    const method = typeof q.method === 'string' ? q.method : ''
    const url = typeof q.url === 'string' ? q.url : ''
    const body = q.body
    if (!roles.has(role) || seen.has(role)) {
      invalid.push(`a $batch request ${JSON.stringify(role)} that is not one pinned member, once`)
      continue
    }
    seen.add(role)
    if (body === null || typeof body !== 'object' || Array.isArray(body) || Object.hasOwn(body, 'id')) {
      invalid.push(`${role}: a $batch request whose body is not a policy body`)
      continue
    }
    if (method === 'POST') {
      if (url !== CA_POLICIES) invalid.push(`${role}: a POST to ${JSON.stringify(url)}, not the policies collection`)
      continue
    }
    if (method !== 'PATCH') {
      invalid.push(`${role}: a ${JSON.stringify(method)} request in a $batch`)
      continue
    }
    const m = MEMBER_POLICY_URL.exec(url)
    if (!m || m[2] !== role) {
      invalid.push(`${role}: a PATCH whose url does not name the ${role} member's own policy id`)
      continue
    }
    if (!present(b[m[1]])) {
      missing.push(m[1])
      continue
    }
    const id = formatValue(b[m[1]])
    if (!Object.hasOwn(standIns, m[1]) && !POLICY_ID.test(id)) {
      invalid.push(`${role}: ${m[1]} is not a policy id`)
      continue
    }
    // A GUID names one object in any casing: two spellings of it are one target.
    const target = id.toLowerCase()
    if (targets.has(target)) {
      invalid.push(`${role}: a PATCH to a policy another request in the batch already targets`)
      continue
    }
    targets.add(target)
    q.url = `${CA_POLICIES}/${id}`
    rebound = true
  }
  if (invalid.length > 0) return { invalid }
  if (missing.length > 0) return { missing }
  return { text: rebound ? JSON.stringify(parsed) : null }
}

/** A projection list with each block once: a block several mismatches share is one correction, its script corrections merged. */
function dedupe(refs: ProjectionRef[]): ProjectionRef[] {
  const out: ProjectionRef[] = []
  for (const r of refs) {
    const seen = out.find((o) => o.block === r.block && (o.mode ?? null) === (r.mode ?? null))
    if (!seen) {
      out.push({ ...r, ...(r.corrections ? { corrections: [...r.corrections] } : {}) })
      continue
    }
    for (const c of r.corrections ?? []) {
      seen.corrections = seen.corrections ?? []
      if (!seen.corrections.includes(c)) seen.corrections.push(c)
    }
  }
  return out
}

/** The prerequisites a state's next transition needs (`requiredBefore: "<state>->…"`). */
export function gatingPrerequisites(pkg: CompiledPackage, state: PackageState): Prerequisite[] {
  return (pkg.meta.prerequisites ?? []).filter((p) => typeof p.requiredBefore === 'string' && p.requiredBefore.startsWith(`${state}->`))
}

const covers = (fact: string, field: string): boolean => field === fact || field.startsWith(`${fact}.`)

/**
 * The correction modules the engine's facts select. A module is chosen when one
 * of the fields it declares is a field the update changes; a module with a
 * `select` condition is chosen when the condition holds — and, where it says
 * `alongside`, only beside another chosen module (returning a live policy to
 * report-only is part of correcting it, never a correction on its own). A
 * changed field no module declares is an unknown mismatch.
 */
export function selectMismatches(p: Record<string, unknown>, ctx: ConditionContext): { selected: string[]; unknown: string[] } {
  const changed = asStrings(ctx.bindings[CHANGED_FIELDS_BINDING])
  const table = (p.mismatches ?? {}) as Record<string, Record<string, unknown>>
  const ids = Object.keys(table)
  // A module scoped to one member of a multi-policy package (`member`, correction
  // batch 2) reads that member's changed fields, never the set's: correcting the
  // member that differs must not touch the sibling that does not.
  const memberOf = (id: string): string | null => (typeof table[id].member === 'string' ? (table[id].member as string) : null)
  const held = Object.keys(ctx.bindings)
  const changedFor = (role: string | null): string[] => {
    if (role === null) return changed
    const key = memberChangedFieldsBinding(held, role)
    return key === null ? [] : asStrings(ctx.bindings[key])
  }
  const coveredBy = (id: string, field: string): boolean => asStrings(table[id].facts).some((f) => covers(f, field))
  const byFacts = ids.filter((id) => changedFor(memberOf(id)).some((c) => coveredBy(id, c)))
  const bySelect = ids.filter((id) => !byFacts.includes(id) && table[id].select !== undefined && holds(table[id].select as never, ctx) && (table[id].alongside !== true || byFacts.some((b) => memberOf(b) === memberOf(id))))
  const roles = [...new Set(ids.map(memberOf).filter((r): r is string => r !== null))]
  let unknown: string[]
  if (roles.length === 0) unknown = changed.filter((c) => !ids.some((id) => coveredBy(id, c)))
  else {
    // Each member's changes are covered by that member's modules; a change the set
    // reports that no member's own changes account for belongs to nobody IAMAI can name.
    unknown = roles.flatMap((role) => changedFor(role).filter((c) => !ids.some((id) => memberOf(id) === role && coveredBy(id, c))).map((c) => `${role}:${c}`))
    const attributed = new Set(roles.flatMap((role) => changedFor(role)))
    unknown.push(...changed.filter((c) => !attributed.has(c) && !ids.some((id) => memberOf(id) === null && coveredBy(id, c))))
  }
  // In the table's own order, so the page reads the corrections the way the package lists them.
  return { selected: ids.filter((id) => byFacts.includes(id) || bySelect.includes(id)), unknown }
}

/**
 * What one state of one package shows. Every channel META.json names for the
 * state is built from its blocks; a channel it names nothing for is absent. A
 * value the state as a whole requires holds every channel; a channel that refuses
 * on its own is withheld whole and named in `degraded`, so no half-built artifact
 * reaches the page and one format never hides another.
 */
export function projectImplementation(pkg: CompiledPackage, state: PackageState, bindings: Bindings, runtime: RuntimeContext = NO_RUNTIME): Projection {
  return build(pkg, state, bindings, runtime, null)
}

/**
 * The planning preview of one state of one package (owner, 2026-09-11): the work
 * the step will require, for review, estimation and approval while it cannot be
 * executed. The same blocks the executable projection names, with a readable
 * stand-in (`placeholder`) for every required value IAMAI does not hold — never a
 * raw `{{binding}}`, never a silently invented value — and nothing waits on the
 * transition's prerequisites. The result is marked `preview` and its hold names
 * what is unresolved; a caller never offers it as something to run or copy.
 */
export function projectPlanned(pkg: CompiledPackage, state: PackageState, bindings: Bindings, runtime: RuntimeContext, placeholder: (binding: string) => string): Projection {
  return build(pkg, state, bindings, runtime, placeholder)
}

/**
 * Every value a planning preview names that IAMAI does not hold, as its stand-in:
 * the projection's own requirements, and the required values, request endpoints
 * and script parameters of the blocks it draws. A value only another state's
 * blocks name is not this step's to resolve, and listing it said "Values still to
 * resolve" about values the step never uses (correction batch 1).
 */
function planningValues(pkg: CompiledPackage, p: Record<string, unknown>, drawn: ReadonlySet<string>, requires: ReadonlySet<string>, bindings: Bindings, placeholder: (binding: string) => string, runModes: ReadonlyMap<string, ReadonlySet<string>> = new Map()): Record<string, string> {
  const required = new Set(pkg.meta.requiredBindings ?? [])
  const keys = new Set<string>(requires)
  for (const id of drawn) {
    const block: Block | undefined = pkg.blocks[id]
    if (!block) continue
    for (const m of block.text.matchAll(BINDING)) if (required.has(m[2])) keys.add(m[2])
    // A missing setting must not erase a numbered instruction. Optional narrative
    // lines can still disappear; procedural lines keep an explicit value to resolve.
    if (block.meta.channel === 'entra') for (const line of block.text.split('\n')) {
      if (/^\s*\d+\.\s/.test(line)) for (const m of line.matchAll(BINDING)) keys.add(m[2])
    }
    if (typeof block.meta.endpoint === 'string') for (const m of block.meta.endpoint.matchAll(/\{([A-Za-z0-9_.-]+)\}/g)) keys.add(m[1])
    // A batch sub-request's own url identity (batchRequests) is this step's value too.
    if (isJsonFormat(block)) for (const m of block.text.matchAll(BATCH_URL_IDENTITY)) keys.add(m[1])
    // A script parameter is this step's value only in a mode the preview runs: a create
    // never passes the policy id its corrections take (cycle 7, session-lifetime).
    const modes = runModes.get(id)
    for (const param of Object.values((block.meta.invocation?.parameters ?? {}) as Record<string, { binding?: unknown; modes?: unknown }>)) {
      if (typeof param?.binding !== 'string') continue
      if (modes && Array.isArray(param.modes) && !param.modes.some((m) => modes.has(String(m)))) continue
      keys.add(param.binding)
    }
  }
  // The engine's facts about a correction and the selected-module binding are IAMAI's to supply, never a value to resolve.
  const own = mismatchBindingOf(p)
  const out: Record<string, string> = {}
  const emptyOk = resolvedEmptyOf(pkg as unknown as { meta: Record<string, unknown> })
  for (const k of keys) if (!bound(bindings, k, emptyOk) && k !== CHANGED_FIELDS_BINDING && k !== own && !k.endsWith('.semanticMismatches')) out[k] = placeholder(k)
  return out
}

const isJsonFormat = (block: Block): boolean => block.meta.format === 'json' || block.meta.format === 'json-template'

/** Explanations and communications do not execute a transition. Their own
 * required bindings still apply, but a deployment hold must not hide them. */
export function projectExplanation(pkg: CompiledPackage, state: PackageState, bindings: Bindings, runtime: RuntimeContext): Projection {
  const p = pkg.meta.projection[state] ?? {}
  const explanatory = { ...pkg, meta: { ...pkg.meta, prerequisites: [], projection: { [state]: { aiInfo: p.aiInfo, email: p.email } } } }
  try { return build(explanatory, state, bindings, runtime, null, true) }
  catch { return { state, hold: { ...emptyHold(), noProjection: true }, channels: [] } }
}

/** The JSON string a planning preview's unresolved whole JSON value stands as while its body is parsed and merged. */
const standInToken = (key: string): string => JSON.stringify(`@@iamai-stand-in:${key}@@`)
const STAND_IN_TOKEN = /"@@iamai-stand-in:([A-Za-z0-9_.-]+)@@"/g

/**
 * A JSON block's `{{json:x}}` values IAMAI does not hold yet, as tokens: the body
 * still parses and merges as one request, and the stand-in is put back bare
 * (`unmaskStandIns`). Bound as a quoted string, `"conditions": "‹policy
 * conditions›"` read as a typed Graph body with a string where Graph takes an
 * object or a list; bare, the preview is visibly a template with a value to
 * resolve, which is what it is (C06).
 */
function maskStandIns(text: string, standIns: Readonly<Record<string, string>>): string {
  return text.replace(/\{\{json:([A-Za-z0-9_.-]+)\}\}/g, (m, key: string) => (Object.hasOwn(standIns, key) ? standInToken(key) : m))
}

function unmaskStandIns(text: string, standIns: Readonly<Record<string, string>>): string {
  return text.replace(STAND_IN_TOKEN, (m, key: string) => (Object.hasOwn(standIns, key) ? standIns[key] : m))
}

function build(pkg: CompiledPackage, state: PackageState, bindings: Bindings, runtime: RuntimeContext, placeholder: ((binding: string) => string) | null, explanationOnly = false): Projection {
  const planning = placeholder !== null
  if (!planning && !explanationOnly && NO_ACTION_STATES.has(state)) return { state, hold: null, channels: [] }
  const hold = emptyHold()
  const p = pkg.meta.projection[state] as Record<string, unknown> | undefined
  if (!p) return { state, hold: { ...hold, noProjection: true }, channels: [] }
  const emptyOk = resolvedEmptyOf(pkg as unknown as { meta: Record<string, unknown> })

  // The next transition's prerequisites, before anything is built: an artifact
  // that performs a transition a person has not cleared is not offered. A
  // planning preview offers nothing, and names them instead.
  hold.pendingPrerequisites = gatingPrerequisites(pkg, state).filter((pr) => !runtime.satisfied.has(pr.id)).map((pr) => pr.id)
  if (!planning && hold.pendingPrerequisites.length > 0) return { state, hold, channels: [] }

  const requires = new Set(asStrings(p.requires))
  let selection: { binding: string; selected: string[] } | null = null
  const refs = new Map<OutputChannel, ProjectionRef[]>()
  if (p.mode === 'composeByMismatch') {
    const ctx: ConditionContext = { state, bindings, satisfied: runtime.satisfied, baselineCommit: runtime.baselineCommit }
    const { selected, unknown } = selectMismatches(p, ctx)
    hold.unknownMismatches = unknown
    if (unknown.length > 0) return { state, hold, channels: [] }
    if (selected.length === 0) return { state, hold: { ...hold, invalid: ['no correction module is selected'] }, channels: [] }
    const binding = mismatchBindingOf(p)
    if (binding !== null) selection = { binding, selected }
    const table = (p.mismatches ?? {}) as Record<string, Record<string, unknown>>
    for (const id of selected) for (const r of asStrings(table[id].requires)) requires.add(r)
    const before = (p.sharedBefore ?? {}) as Record<string, unknown>
    const after = (p.sharedAfter ?? {}) as Record<string, unknown>
    for (const ch of OUTPUT_ORDER) {
      const own = selected.flatMap((id) => refsOf(table[id][ch]))
      refs.set(ch, [...(own.length > 0 ? [...refsOf(before[ch]), ...own, ...refsOf(after[ch])] : []), ...refsOf(p[ch])])
    }
  } else {
    for (const ch of OUTPUT_ORDER) refs.set(ch, refsOf(p[ch]))
  }
  const drawn = new Set([...refs.values()].flat().map((r) => r.block))
  const runModes = new Map<string, Set<string>>()
  for (const r of [...refs.values()].flat()) if (typeof r.mode === 'string') runModes.set(r.block, new Set([...(runModes.get(r.block) ?? []), r.mode]))
  const standIns = planning ? planningValues(pkg, p, drawn, requires, bindings, placeholder, runModes) : {}
  let b: Bindings = planning ? { ...bindings, ...standIns } : bindings
  if (selection !== null) b = { ...b, [selection.binding]: selection.selected }
  // What the state as a whole requires holds every channel: none of them is the work without it.
  hold.missingBindings = [...requires].filter((r) => !present(b[r]) && !(emptyOk.has(r) && Array.isArray(b[r])))
  if (hold.missingBindings.length > 0) return { state, hold, channels: [] }

  const required = new Set(pkg.meta.requiredBindings ?? [])
  const channels: ChannelArtifact[] = []
  const degraded: Withheld[] = []
  /** The channels whose blocks carry one of IAMAI's values: a binding, a bound endpoint, an invocation. */
  const bearing = new Set<OutputChannel>()
  for (const ch of OUTPUT_ORDER) {
    const list = dedupe(refs.get(ch) ?? [])
    if (list.length === 0) continue
    const miss: string[] = []
    const bad: string[] = []
    const blockIds = [...new Set(list.map((r) => r.block))]
    const texts: string[] = []
    const requests: ChannelArtifact['requests'] = []
    const runs: ScriptRun[] = []
    const bodies: { method: string; endpoint: string; body: Record<string, unknown>; text: string }[] = []
    let communication: ChannelArtifact['communication'] = null
    for (const id of blockIds) {
      const block: Block | undefined = pkg.blocks[id]
      if (!block) {
        bad.push(`${id}: no such block`)
        continue
      }
      const bound = bindText(planning && isJsonFormat(block) ? maskStandIns(block.text, standIns) : block.text, b, required, emptyOk)
      if ('missing' in bound) {
        miss.push(...bound.missing)
        continue
      }
      if (UNRESOLVED.test(bound.text)) {
        bad.push(`${id}: an unresolved placeholder`)
        continue
      }
      const ownRuns = list.filter((r) => r.block === id && typeof r.mode === 'string').map((r) => ({ mode: r.mode as string, corrections: r.corrections ?? [] }))
      if (ch === 'powershell' && block.meta.kind === 'deployableAfterBinding') {
        if (!block.meta.invocation || ownRuns.length === 0) {
          bad.push(`${id}: a deployable script with no invocation`)
          continue
        }
        const rendered = renderInvocation(bound.text, block.meta.invocation, ownRuns, b, runtime.satisfied, new Set(Object.keys(standIns)), emptyOk)
        if ('missing' in rendered) {
          miss.push(...rendered.missing)
          continue
        }
        // A script whose withheld modes cannot be removed cleanly is not shipped
        // half stripped: the channel is withheld and says which mode did it.
        if ('unstripped' in rendered) {
          bad.push(`${id}: modes it does not run cannot be removed from the script: ${rendered.unstripped.join(', ')}`)
          continue
        }
        runs.push(...ownRuns)
        texts.push(rendered.text)
        continue
      }
      // The JSON channel is a request or nothing (S6, A1 §16.2): a body with the
      // method and endpoint it is sent with, and — for a change to an existing
      // object — the identifier of the object it changes, bound from a value IAMAI
      // holds (`bindEndpoint` refuses one it lacks; nothing invents an id). A bare
      // body, or a PATCH with nowhere to send it, is not implementation content.
      if (ch === 'json') {
        const method = typeof block.meta.method === 'string' ? block.meta.method.toUpperCase() : ''
        const endpoint = typeof block.meta.endpoint === 'string' ? block.meta.endpoint : ''
        if (block.meta.format !== 'json' && block.meta.format !== 'json-template') {
          bad.push(`${id}: a JSON channel block that is not a JSON body`)
          continue
        }
        if (method === '' || endpoint === '') {
          bad.push(`${id}: a JSON body with no request (method and endpoint)`)
          continue
        }
        if (CHANGE_METHODS.has(method) && !ENDPOINT_IDENTITY.test(endpoint) && !FIXED_IDENTITY.test(endpoint)) {
          bad.push(`${id}: a ${method} whose endpoint names no target identifier`)
          continue
        }
      }
      if (block.meta.format === 'json' || block.meta.format === 'json-template') {
        let parsed: unknown
        try {
          parsed = JSON.parse(bound.text)
        } catch {
          bad.push(`${id}: bound JSON does not parse`)
          continue
        }
        let text = bound.text
        // A Graph JSON batch carries its requests inside the body, where the guard above does not reach.
        if (ch === 'json' && BATCH_ENDPOINT.test(String(block.meta.endpoint ?? ''))) {
          const batch = batchRequests(parsed, pkg, b, standIns)
          if ('missing' in batch) {
            miss.push(...batch.missing)
            continue
          }
          if ('invalid' in batch) {
            bad.push(...batch.invalid.map((x) => `${id}: ${x}`))
            continue
          }
          if (batch.text !== null) text = batch.text
        }
        if (typeof block.meta.endpoint === 'string') {
          const ep = bindEndpoint(block.meta.endpoint, b)
          if ('missing' in ep) {
            miss.push(...ep.missing)
            continue
          }
          bodies.push({ method: String(block.meta.method ?? ''), endpoint: ep.endpoint, body: (parsed ?? {}) as Record<string, unknown>, text })
          continue
        }
      }
      if (ch === 'email') {
        const declared = pkg.meta.email?.block === id ? pkg.meta.email : null
        communication = {
          audience: String(block.meta.audience ?? declared?.audience ?? ''),
          trigger: String(block.meta.communicationTrigger ?? declared?.communicationTrigger ?? ''),
          purpose: String(block.meta.purpose ?? declared?.purpose ?? ''),
        }
      }
      texts.push(bound.text)
    }
    // Request bodies: one request carries one body. Several blocks that send to the
    // same endpoint with the same method are one request whose body is theirs
    // together (a correction's conditions and grant are one PATCH), so the copied
    // JSON is a single document Graph accepts. Two blocks that set the same
    // top-level field, or bodies for different requests, do not hold together as
    // one artifact and withhold the channel instead.
    if (bodies.length > 0) {
      const targets = new Set(bodies.map((x) => `${x.method} ${x.endpoint}`))
      if (targets.size > 1) bad.push(`${ch}: bodies for ${targets.size} different requests`)
      else if (bodies.length === 1) {
        texts.push(bodies[0].text)
        requests.push({ method: bodies[0].method, endpoint: bodies[0].endpoint })
      } else {
        const merged: Record<string, unknown> = {}
        for (const x of bodies) {
          for (const [k, v] of Object.entries(x.body)) {
            if (Object.hasOwn(merged, k) && JSON.stringify(merged[k]) !== JSON.stringify(v)) bad.push(`${ch}: two bodies set ${k}`)
            merged[k] = v
          }
        }
        texts.push(JSON.stringify(merged, null, 2))
        requests.push({ method: bodies[0].method, endpoint: bodies[0].endpoint })
      }
    }
    // A channel that does not bind, or whose output does not hold together, is
    // withheld on its own (correction batch 1): one format IAMAI cannot finish
    // never hides the others, and nothing half-built from it reaches the page.
    if (miss.length > 0 || bad.length > 0) {
      degraded.push({ channel: ch, missingBindings: [...new Set(miss)], invalid: bad })
      continue
    }
    const bears = blockIds.some((id) => {
      const bl = pkg.blocks[id]
      // A binding the block names but IAMAI does not hold dropped its line, and carries nothing.
      return bl !== undefined && ([...bl.text.matchAll(BINDING)].some((m) => bound(b, m[2], emptyOk)) || (typeof bl.meta.endpoint === 'string' && /\{[A-Za-z0-9_.-]+\}/.test(bl.meta.endpoint)) || (isJsonFormat(bl) && [...bl.text.matchAll(BATCH_URL_IDENTITY)].length > 0) || bl.meta.invocation !== undefined)
    })
    if (bears) bearing.add(ch)
    const corrections = [...new Set(runs.flatMap((r) => r.corrections))]
    channels.push({ channel: ch, blocks: blockIds, format: String(pkg.blocks[blockIds[0]]?.meta.format ?? 'markdown'), text: planning ? unmaskStandIns(texts.join('\n\n'), standIns) : texts.join('\n\n'), requests, mode: runs[0]?.mode ?? null, corrections, runs, communication })
  }
  // A channel that carries none of IAMAI's values — a parameterised script
  // template, a note — is this tenant's work only beside one that does. Where
  // every channel that binds a value is withheld, the rest are not offered alone.
  if (degraded.length > 0 && !channels.some((c) => bearing.has(c.channel))) {
    return { state, hold: { ...hold, missingBindings: [...new Set(degraded.flatMap((d) => d.missingBindings))], invalid: degraded.flatMap((d) => d.invalid) }, channels: [] }
  }
  const withheld = degraded.length > 0 ? { degraded } : {}
  if (planning) return { state, hold: { ...emptyHold(), missingBindings: Object.keys(standIns), pendingPrerequisites: hold.pendingPrerequisites }, channels, preview: true, ...withheld }
  return { state, hold: null, channels, ...withheld }
}

// ---- faults ----

/** Where a projection that throws is reported: the console, always, so a development run and a test log both show it. */
export function reportPackageFault(stepId: string, what: string, error: unknown): void {
  console.error(`[IAMAI implementation content] ${stepId}: ${what} failed:`, error)
}

/**
 * The projection, and never an exception: a package the runtime cannot project
 * holds its implementation (the step still renders, with its lifecycle, its
 * readiness and a truthful no-action box) and the fault is reported.
 */
export function projectSafely(pkg: CompiledPackage, state: PackageState, bindings: Bindings, runtime: RuntimeContext, report: typeof reportPackageFault = reportPackageFault): Projection {
  try {
    return projectImplementation(pkg, state, bindings, runtime)
  } catch (e) {
    report(pkg.meta.stepId, `projection (${state})`, e)
    return { state, hold: { ...emptyHold(), invalid: [`runtime fault: ${(e as Error)?.message ?? String(e)}`] }, channels: [] }
  }
}

/** The planning preview, and never an exception (see projectSafely). */
export function planSafely(pkg: CompiledPackage, state: PackageState, bindings: Bindings, runtime: RuntimeContext, placeholder: (binding: string) => string, report: typeof reportPackageFault = reportPackageFault): Projection {
  try {
    return projectPlanned(pkg, state, bindings, runtime, placeholder)
  } catch (e) {
    report(pkg.meta.stepId, `planning preview (${state})`, e)
    return { state, hold: { ...emptyHold(), invalid: [`runtime fault: ${(e as Error)?.message ?? String(e)}`] }, channels: [] }
  }
}

// ---- prerequisites and confirmations ----

/** A person's confirmation of one prerequisite: when, and the values it was given against (roadmap/decisions.ts). */
export type { OwnerConfirmation }

/** FNV-1a over the canonical text: short, stable, and carrying none of the tenant's values into the plan record. */
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * The values a confirmation of this prerequisite is given against: its
 * `invalidatedBy` bindings, in order. A confirmation holds while they are the
 * same values, and a policy recreated under a new id, or a changed exclusion set,
 * is a different thing to have confirmed.
 */
export function prerequisiteBasis(pr: Prerequisite, bindings: Bindings): string {
  const values = (pr.invalidatedBy ?? []).map((k) => {
    const v = bindings[k]
    return Array.isArray(v) ? [...v].map(String).sort() : v ?? null
  })
  return hash(JSON.stringify([pr.id, values]))
}

export type PrerequisiteStatus = { id: string; satisfied: boolean; by: 'evidence' | 'confirmation' | null; confirmedAt: string | null }

/**
 * Every prerequisite's standing now: satisfied by the tenant fact the package
 * names (`evidence`), or by a person's confirmation whose basis still matches —
 * never by the absence of a problem. A confirmation whose values changed no
 * longer counts, and is not shown as confirmed.
 */
export function prerequisiteStatus(pkg: CompiledPackage, state: PackageState, bindings: Bindings, confirmations: Readonly<Record<string, OwnerConfirmation>>, baselineCommit: string | null): PrerequisiteStatus[] {
  const ctx: ConditionContext = { state, bindings, satisfied: new Set(), baselineCommit }
  return (pkg.meta.prerequisites ?? []).map((pr) => {
    if (pr.evidence !== undefined && holds(pr.evidence, ctx)) return { id: pr.id, satisfied: true, by: 'evidence', confirmedAt: null }
    const c = confirmations[pr.id]
    if (c && c.basis === prerequisiteBasis(pr, bindings)) return { id: pr.id, satisfied: true, by: 'confirmation', confirmedAt: c.at }
    return { id: pr.id, satisfied: false, by: null, confirmedAt: null }
  })
}

// ---- sources, troubleshooting, readiness ----

/** The package's verified sources a person may be shown (guide §29). */
const userFacing = (pkg: CompiledPackage): VerifiedSource[] => (pkg.meta.verifiedSources ?? []).filter((s) => s.userFacing === true)

const sourceById = (pkg: CompiledPackage, id: string): VerifiedSource | null => userFacing(pkg).find((s) => s.id === id) ?? null

/**
 * The date the package's Microsoft sources were last checked
 * (`verifiedSources[].checkedOn`, YYYY-MM-DD): the latest one over every
 * verified source, user-facing or not, deterministically (batch A decision 10:
 * the line renders wherever a checked date exists). Never the build, the
 * deploy, the browser or a file's time.
 */
export function sourceUpdatedOn(pkg: CompiledPackage): string | null {
  const dates = (pkg.meta.verifiedSources ?? [])
    .map((s) => s.checkedOn)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
  return dates.length > 0 ? dates[dates.length - 1] : null
}

export type TroubleshootingScenario = {
  id: string
  title: string
  symptom: string
  likelyCauses: string[]
  check: string[]
  fix: string[]
  doNot: string[]
  then: string[]
  sources: VerifiedSource[]
}

/** A support model, bound: the first block of the channel that declares the state (or the first), its JSON template filled. */
function supportModel(pkg: CompiledPackage, channel: 'readiness' | 'troubleshooting', state: PackageState, bindings: Bindings): Record<string, unknown> | null {
  const ids = pkg.meta.supportBlocks?.[channel] ?? []
  const id = ids.find((x) => (pkg.blocks[x]?.meta.states ?? []).includes(state)) ?? ids[0]
  const block = id ? pkg.blocks[id] : undefined
  if (!block) return null
  if (block.meta.format === 'json-template') {
    const bound = bindText(block.text, bindings, new Set())
    return 'missing' in bound ? null : (JSON.parse(bound.text) as Record<string, unknown>)
  }
  return JSON.parse(block.text) as Record<string, unknown>
}

/** The package's authored troubleshooting scenarios for this state, with their user-facing sources; none where it authors none. */
export function troubleshootingFor(pkg: CompiledPackage, state: PackageState, bindings: Bindings = {}): TroubleshootingScenario[] {
  const model = supportModel(pkg, 'troubleshooting', state, bindings)
  const scenarios = (model?.scenarios ?? []) as Record<string, unknown>[]
  return scenarios
    .filter((s) => asStrings(s.states).includes(state))
    .map((s) => ({
      id: String(s.id),
      title: String(s.title),
      symptom: String(s.symptom ?? ''),
      likelyCauses: asStrings(s.likelyCauses),
      check: asStrings(s.check),
      fix: asStrings(s.fix),
      doNot: asStrings(s.doNot),
      then: asStrings(s.then),
      sources: asStrings(s.sources)
        .map((id) => sourceById(pkg, id))
        .filter((x): x is VerifiedSource => x !== null),
    }))
}

export type PackageReadinessTile = {
  id: string
  gate: string
  result: string
  line: string
  /** The runtime tile that states the same fact, which answers instead where it exists (`gateKey`). */
  gateKey: string | null
  /** The prerequisites the next transition needs that this tile's confirmation covers, and whether they are all satisfied. */
  confirm: { prerequisites: string[]; satisfied: boolean } | null
}

export type PackageReadiness = {
  tiles: PackageReadinessTile[]
  /** The package's conclusion for this state, where it names one (`conclusionByState`). */
  conclusion: string | null
  whyItMatters: string | null
  unknowns: string[]
  references: VerifiedSource[]
}

/**
 * The package's readiness tiles evaluated against what IAMAI holds. Each tile is
 * the first of its rules whose machine condition holds; a tile none of whose
 * conditions holds is not shown. Nothing is inferred from prose, and nothing
 * from the absence of a problem.
 */
export function packageReadiness(pkg: CompiledPackage, state: PackageState, bindings: Bindings, runtime: RuntimeContext = NO_RUNTIME): PackageReadiness | null {
  const model = supportModel(pkg, 'readiness', state, bindings)
  if (!model) return null
  const ctx: ConditionContext = { state, bindings, satisfied: runtime.satisfied, baselineCommit: runtime.baselineCommit }
  const gating = new Set(gatingPrerequisites(pkg, state).map((p) => p.id))
  const tiles: PackageReadinessTile[] = []
  for (const t of (model.tiles ?? []) as Record<string, unknown>[]) {
    const rule = ((t.rules ?? []) as { if?: unknown; result: string; line: string }[]).find((r) => r.if !== undefined && holds(r.if as never, ctx))
    if (!rule) continue
    const confirmable = asStrings(t.confirms).filter((id) => gating.has(id))
    tiles.push({
      id: String(t.id),
      gate: String(t.label ?? t.gate),
      result: rule.result,
      line: rule.line,
      gateKey: typeof t.gateKey === 'string' ? t.gateKey : null,
      confirm: confirmable.length > 0 ? { prerequisites: confirmable, satisfied: confirmable.every((id) => runtime.satisfied.has(id)) } : null,
    })
  }
  const conclusions = (model.conclusions ?? {}) as Record<string, string>
  const key = ((model.conclusionByState ?? {}) as Record<string, string>)[state]
  const sections = ((model.whyIamAISaysThis as Record<string, unknown> | undefined)?.sections ?? {}) as Record<string, unknown>
  return {
    tiles,
    conclusion: key && typeof conclusions[key] === 'string' ? conclusions[key] : null,
    whyItMatters: typeof sections.whyItMatters === 'string' ? sections.whyItMatters : null,
    unknowns: asStrings(sections.unknownCannotProve),
    references: asStrings(sections.microsoftReferences)
      .map((id) => sourceById(pkg, id))
      .filter((x): x is VerifiedSource => x !== null),
  }
}

/** Readiness, and never an exception (see projectSafely). */
export function readinessSafely(pkg: CompiledPackage, state: PackageState, bindings: Bindings, runtime: RuntimeContext, report: typeof reportPackageFault = reportPackageFault): PackageReadiness | null {
  try {
    return packageReadiness(pkg, state, bindings, runtime)
  } catch (e) {
    report(pkg.meta.stepId, `readiness (${state})`, e)
    return null
  }
}

/** Troubleshooting, and never an exception (see projectSafely). */
export function troubleshootingSafely(pkg: CompiledPackage, state: PackageState, bindings: Bindings, report: typeof reportPackageFault = reportPackageFault): TroubleshootingScenario[] {
  try {
    return troubleshootingFor(pkg, state, bindings)
  } catch (e) {
    report(pkg.meta.stepId, `troubleshooting (${state})`, e)
    return []
  }
}
