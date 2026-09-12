// The implementation-content block protocol: one parser, one normaliser and one
// validator for the compact source packages under docs/implementation-content/
// (authoring guide v2.5 §4.2, §6, §8 and §26.9). The compiler
// (scripts/compile-implementation-content.mjs) lints packages and emits the
// runtime registry through it, and the runtime projection (project.ts) reads
// what it produced, so the two cannot disagree about what a block is.
//
// The invariant this module owns: a package that passes `validatePackage` is one
// the runtime can project safely. Every feature the runtime reads is checked
// here — including the structured fields the runtime evaluates (machine
// conditions, correction-module facts, PowerShell invocations; README.md
// "Runtime contract") — and a feature the runtime does not implement is an
// error, never a best guess. What the guide allows but the runtime cannot reach
// (a state IAMAI never enters) is a warning.
//
// The library build keeps that invariant part by part (`withholdInvalid`): every
// issue names the smallest part of the package it belongs to, and that part is
// taken out of the compiled package until what remains validates. Nothing is
// repaired and no source file is edited.
//
// Pure: no DOM, no network, no file system.
import type { Condition } from './conditions.ts'
import { conditionErrors } from './conditions.ts'
import type { ConditionVocabulary } from './conditions.ts'
import { invocationErrors } from './invocation.ts'
import type { InvocationSpec } from './invocation.ts'
import { AUTHORED_STATES } from './states.ts'

export type BlockMeta = { id: string; channel: string; states?: string[]; format?: string; kind?: string; invocation?: InvocationSpec } & Record<string, unknown>
export type Block = { meta: BlockMeta; text: string }

export type VerifiedSource = {
  id: string
  authority?: string
  title: string
  url: string
  purpose?: string
  checkedOn: string
  userFacing?: boolean
  priority?: string
  audience?: string[]
}

/**
 * Something the package needs before a transition (guide §14). `requiredBefore`
 * names the transition it gates (`readyToEnforce->inPlace`); `evidence` is the
 * tenant fact that satisfies it without anybody's word; `invalidatedBy` the
 * bindings whose values a person's confirmation of it was given against.
 */
export type Prerequisite = { id: string; class: string; binding?: string; requiredBefore?: string; evidence?: Condition; invalidatedBy?: string[] }

export type PackageMeta = {
  stepId: string
  title?: string
  contentFile?: string
  requiredBindings?: string[]
  optionalBindings?: string[]
  projection: Record<string, Record<string, unknown>>
  supportBlocks?: Record<string, string[]>
  verifiedSources?: VerifiedSource[]
  prerequisites?: Prerequisite[]
  /**
   * `members`: each baseline policy a multi-policy package names, by its role in
   * the package's bindings (`policies.<family>.<role>.…`) and the pinned
   * baseline's stable id for it — null where the pin surfaces none, and then
   * nothing is bound for that member.
   */
  baselineAuthority?: { pinCommit?: string; members?: { role: string; memberStableId: string | null }[] } & Record<string, unknown>
  email?: { block?: string; audience?: string; communicationTrigger?: string; purpose?: string } & Record<string, unknown>
} & Record<string, unknown>

export type CompiledPackage = { meta: PackageMeta; blocks: Record<string, Block> }

/** One entry of a projection list: a block id, or a block run in a mode (`powershell.run` in `Enforce`). */
export type ProjectionRef = { block: string; mode?: string; corrections?: string[] }

export class PackageError extends Error {}

/** The states IAMAI's runtime enters (stepPackage.ts packageStateOf); guide §2. */
export const PACKAGE_STATES = ['missing', 'partial', 'reportOnly', 'readyToEnforce', 'inPlace', 'blocked', 'needsDecision', 'sourceConflict', 'notLicensed'] as const
export type PackageState = (typeof PACKAGE_STATES)[number]

/** The channels a block may belong to (guide §4.2). A block in any other channel fails the package. */
export const BLOCK_CHANNELS = ['entra', 'json', 'powershell', 'aiInfo', 'email', 'readiness', 'troubleshooting'] as const

/** The user-facing output channels a state projection may name (guide §6). */
export const PROJECTION_CHANNELS = ['entra', 'json', 'powershell', 'aiInfo', 'email'] as const

/**
 * The engine's semantic facts about a correction, as the binding a Partial
 * projection selects its modules from: the policy fields an update changes,
 * named as Graph names them (roadmap/changedFields.ts). IAMAI supplies it; a
 * package never declares it.
 */
export const CHANGED_FIELDS_BINDING = 'policy.current.changedFields'

/** The results a readiness rule may give (guide §33.1). */
export const READINESS_RESULTS = ['Ready', 'Review required', 'Unknown', 'Blocked', 'Not applicable'] as const

/** The fields a correction module's facts may name: the material roots a policy's meaning is read from. */
const MATERIAL_ROOTS = ['conditions', 'grantControls', 'sessionControls']

/** Every key a state projection may carry: its channels, the composition keys of a Partial projection, and inert documentation. */
const PROJECTION_KEYS = new Set<string>(['requires', 'mode', 'sharedBefore', 'mismatches', 'sharedAfter', 'mismatchBinding', 'reason', 'appliesWhen', ...PROJECTION_CHANNELS])
const MISMATCH_KEYS = new Set<string>(['requires', 'appliesWhen', 'facts', 'select', 'alongside', 'id', ...PROJECTION_CHANNELS])

const BEGIN = '@@IAMAI-BEGIN '
const END = '@@IAMAI-END'

/** `{{binding}}` for prose and `{{json:binding}}` for a whole JSON value (guide §4.3). */
export const BINDING = /\{\{(json:)?([A-Za-z0-9_.-]+)\}\}/g

const JSON_BINDING = /\{\{json:[A-Za-z0-9_.-]+\}\}/g

/**
 * Every block in a CONTENT.md, by id, in file order. Delimiters start at column
 * one on their own line, carry JSON metadata, never nest, and every id is
 * unique; anything else is a package error rather than a best guess.
 */
export function parseBlocks(text: string): Record<string, Block> {
  const lines = text.split(/\r?\n/)
  const blocks: Record<string, Block> = {}
  let current: { meta: BlockMeta; body: string[] } | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith(BEGIN)) {
      if (current) throw new PackageError(`nested block at line ${i + 1}`)
      let meta: BlockMeta
      try {
        meta = JSON.parse(line.slice(BEGIN.length)) as BlockMeta
      } catch (e) {
        throw new PackageError(`invalid block metadata JSON at line ${i + 1}: ${(e as Error).message}`)
      }
      if (!meta || typeof meta.id !== 'string' || meta.id === '') throw new PackageError(`block at line ${i + 1} has no string id`)
      if (Object.hasOwn(blocks, meta.id)) throw new PackageError(`duplicate block id: ${meta.id}`)
      current = { meta, body: [] }
      continue
    }
    if (line === END) {
      if (!current) throw new PackageError(`orphan ${END} at line ${i + 1}`)
      blocks[current.meta.id] = { meta: current.meta, text: current.body.join('\n').replace(/\s+$/, '') + '\n' }
      current = null
      continue
    }
    if (current) current.body.push(line)
  }
  if (current) throw new PackageError(`unterminated block: ${current.meta.id}`)
  return blocks
}

/** The bindings a text names. */
export function bindingsUsed(text: string): string[] {
  return [...new Set([...text.matchAll(BINDING)].map((m) => m[2]))]
}

/** A JSON template with each whole-value binding masked to null: for syntax lint only, never deployable (guide §9.5). */
export function maskJsonTemplate(text: string): string {
  return text.replace(JSON_BINDING, 'null')
}

/**
 * A projection list, normalised: plain ids and `{ block, mode, corrections }`
 * entries alike, a single entry as well as a list, and the guide's singular
 * `correction` as well as `corrections` (§26.4).
 */
export function refsOf(value: unknown): ProjectionRef[] {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
  return list.flatMap((v): ProjectionRef[] => {
    if (typeof v === 'string') return [{ block: v }]
    if (v && typeof v === 'object' && typeof (v as { block?: unknown }).block === 'string') {
      const r = v as { block: string; mode?: unknown; corrections?: unknown; correction?: unknown }
      const corrections = Array.isArray(r.corrections) ? r.corrections.map(String) : typeof r.correction === 'string' ? [r.correction] : null
      return [{ block: r.block, ...(typeof r.mode === 'string' ? { mode: r.mode } : {}), ...(corrections ? { corrections } : {}) }]
    }
    return []
  })
}

/** The references a list names, grouped by the channel each referenced block is in (a compose list names blocks without a channel key). */
function byChannel(value: unknown, blocks: Record<string, Block>): Record<string, ProjectionRef[]> {
  const out: Record<string, ProjectionRef[]> = {}
  for (const ref of refsOf(value)) {
    // A block that does not exist keeps its reference under the first channel so
    // the validator reports it as missing rather than it disappearing here.
    const channel = blocks[ref.block]?.meta.channel ?? PROJECTION_CHANNELS[0]
    ;(out[channel] ??= []).push(ref)
  }
  return out
}

/**
 * A package's projections in the one shape the runtime reads. The guide's
 * `compose` Partial (§8: `sharedBefore`/`sharedAfter` as block lists and
 * `modules: [{ id, … }]`) is the same composition as `composeByMismatch`
 * (§26.4) with the channel keys implied by the blocks, so it is rewritten into
 * that shape: each module becomes the mismatch entry of its id, each list is
 * grouped by its blocks' channels, and every other key travels unchanged.
 */
export function normalizeProjection(meta: PackageMeta, blocks: Record<string, Block>): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const [state, p] of Object.entries(meta.projection ?? {})) {
    if (!p || typeof p !== 'object' || p.mode !== 'compose' || !Array.isArray(p.modules)) {
      out[state] = p
      continue
    }
    const { modules, sharedBefore, sharedAfter, ...rest } = p as Record<string, unknown> & { modules: Record<string, unknown>[] }
    const mismatches: Record<string, Record<string, unknown>> = {}
    for (const m of modules) {
      if (!m || typeof m.id !== 'string') continue
      const entry: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(m)) {
        if (k === 'id') continue
        entry[k] = (PROJECTION_CHANNELS as readonly string[]).includes(k) ? refsOf(v) : v
      }
      mismatches[m.id] = entry
    }
    out[state] = {
      ...rest,
      mode: 'composeByMismatch',
      ...(sharedBefore !== undefined ? { sharedBefore: Array.isArray(sharedBefore) ? byChannel(sharedBefore, blocks) : sharedBefore } : {}),
      ...(sharedAfter !== undefined ? { sharedAfter: Array.isArray(sharedAfter) ? byChannel(sharedAfter, blocks) : sharedAfter } : {}),
      mismatches,
    }
  }
  return out
}

// ---- normalisation (correction batch 2) ----
//
// The library was authored in several shapes of one schema: an Email trigger
// named `trigger`, or declared once in META.email for a list of blocks; a
// troubleshooting scenario whose check is one sentence rather than a list, whose
// states are its block's, and whose symptom is its title; readiness evidence
// written as one paragraph (`whyIamaiSaysThis`) or as safe-now / safe-to-enforce
// lines; content authored under another name for a state the runtime enters
// (`groupMissing` for `missing`). Each is the same structure the runtime reads, so
// it is rewritten into that structure — the author's words unchanged — before
// validation. Nothing is inferred from prose: a tile whose result is a sentence or
// a binding, or whose rule is prose, is still refused by the validator.

/** When an Email authored for exactly one state is sent (guide §26.6): the transition that state leads to, or the stage itself for one the runtime never enters. */
const TRIGGER_BY_STATE: Readonly<Record<string, string>> = { missing: 'before-report-only', partial: 'before-correction', reportOnly: 'during-report-only', readyToEnforce: 'before-enforcement', inPlace: 'after-enforcement' }

const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** The scenario fields the runtime reads as lists (guide §30.3). */
const SCENARIO_LISTS = ['likelyCauses', 'check', 'fix', 'doNot', 'then'] as const

/** The readiness conclusions a model names by the decision it answers (guide §33.2), and the runtime states each answers in. */
const CONCLUSION_STATES: Readonly<Record<string, (state: string) => boolean>> = {
  nextSafeAction: () => true,
  safeNow: (s) => s === 'missing' || s === 'partial' || s === 'reportOnly',
  safeToEnforce: (s) => s === 'readyToEnforce',
}

const isRuntimeState = (s: unknown): s is PackageState => (PACKAGE_STATES as readonly string[]).includes(String(s))

/** A state authored under another name for a runtime state (states.ts `alias`), with that state beside it. */
function withAliases(states: readonly string[]): string[] {
  const out = [...states]
  for (const s of states) {
    const known = AUTHORED_STATES[s]
    if (known?.disposition === 'alias' && known.runtime !== null && !out.includes(known.runtime)) out.push(known.runtime)
  }
  return out
}

function normalizeScenario(s: Record<string, unknown>, blockStates: readonly string[], note: (what: string) => void): void {
  for (const key of SCENARIO_LISTS) {
    if (typeof s[key] === 'string') {
      s[key] = [s[key]]
      note(`troubleshooting ${key} as a list`)
    }
  }
  if (s.sources === undefined && Array.isArray(s.sourceIds)) {
    s.sources = s.sourceIds
    delete s.sourceIds
    note('troubleshooting sources')
  }
  if (s.states === undefined && blockStates.length > 0) {
    s.states = [...blockStates]
    note('troubleshooting states from its block')
  }
  if (Array.isArray(s.states)) s.states = withAliases(s.states.map(String))
  // Written symptom-first, the symptom is the title (§30.4), and it is shown once.
  if (typeof s.title !== 'string' && typeof s.symptom === 'string' && s.symptom.trim() !== '') {
    s.title = s.symptom.trim().replace(/\.$/, '')
    delete s.symptom
    note('troubleshooting title from its symptom')
  }
}

function normalizeReadiness(model: Record<string, unknown>, blockStates: readonly string[], note: (what: string) => void): void {
  const runtime = blockStates.filter(isRuntimeState)
  const why = model.whyIamaiSaysThis ?? model.whyIAMAI
  if (model.whyIamAISaysThis === undefined && why !== undefined) {
    const sections: Record<string, unknown> = {}
    if (typeof why === 'string') sections.whyItMatters = why
    else if (isObject(why)) {
      if (typeof why.whyItMatters === 'string') sections.whyItMatters = why.whyItMatters
      const unknown = [...asStrings(why.unknown), ...(typeof why.unknownRule === 'string' ? [why.unknownRule] : [])]
      if (unknown.length > 0) sections.unknownCannotProve = unknown
    }
    if (Object.keys(sections).length > 0) {
      model.whyIamAISaysThis = { sections }
      note('readiness evidence sections')
    }
  }
  if (model.conclusionByState === undefined) {
    const conclusions: Record<string, string> = {}
    const byState: Record<string, string> = {}
    for (const [key, applies] of Object.entries(CONCLUSION_STATES)) {
      if (typeof model[key] !== 'string') continue
      conclusions[key] = model[key] as string
      for (const s of runtime) if (applies(s)) byState[s] = key
    }
    if (Object.keys(byState).length > 0) {
      model.conclusions = { ...(isObject(model.conclusions) ? model.conclusions : {}), ...conclusions }
      model.conclusionByState = byState
      note('readiness conclusions by state')
    }
  }
  // A tile whose written result opens with a result the runtime knows ("Unknown
  // until tested") is that result in every state its block declares. A result that
  // is a binding or any other sentence stays as written, and the validator refuses it.
  for (const t of Array.isArray(model.tiles) ? model.tiles : []) {
    if (!isObject(t) || t.rules !== undefined || typeof t.result !== 'string' || typeof t.line !== 'string' || runtime.length === 0) continue
    const text = t.result
    const result = READINESS_RESULTS.find((r) => text === r || text.startsWith(`${r} `))
    if (!result) continue
    t.rules = [{ if: { state: [...runtime] }, result, line: t.line }]
    note('readiness tile with a written result')
  }
}

/** The Email metadata the runtime reads, on the block: `trigger` is the guide's `communicationTrigger`, META.email declares its blocks, and a one-state Email is sent for that state. */
function normalizeEmail(id: string, meta: BlockMeta, email: PackageMeta['email'], note: (what: string) => void): BlockMeta {
  const m: BlockMeta = { ...meta }
  if (typeof m.communicationTrigger !== 'string' && typeof m.trigger === 'string') {
    m.communicationTrigger = m.trigger
    delete m.trigger
    note('email trigger')
  }
  const declared = email ? [email.block, ...asStrings((email as Record<string, unknown>).blocks)] : []
  if (email && declared.includes(id)) {
    for (const key of ['audience', 'communicationTrigger', 'purpose'] as const) {
      if (typeof m[key] !== 'string' && typeof email[key] === 'string') {
        m[key] = email[key]
        note(`email ${key} from META.email`)
      }
    }
  }
  const states = m.states ?? []
  if (typeof m.communicationTrigger !== 'string' && states.length === 1) {
    m.communicationTrigger = TRIGGER_BY_STATE[states[0]] ?? `during-${kebab(states[0])}`
    note('email trigger from its one state')
  }
  return m
}

/**
 * A package in the one shape the validator and the runtime read, and what was
 * rewritten to get there. Only structure moves: every sentence, block and value
 * is the author's.
 */
export function normalizePackage(meta: PackageMeta, source: Record<string, Block>): { meta: PackageMeta; blocks: Record<string, Block>; normalized: string[] } {
  const normalized: string[] = []
  const note = (what: string): void => void normalized.push(what)
  const blocks: Record<string, Block> = {}
  for (const [id, b] of Object.entries(source)) {
    let block: Block = b
    if (b.meta.channel === 'email') block = { meta: normalizeEmail(id, b.meta, meta.email, note), text: b.text }
    if ((b.meta.channel === 'troubleshooting' || b.meta.channel === 'readiness') && (b.meta.format === 'json' || b.meta.format === 'json-template')) {
      const own = b.meta.states ?? []
      try {
        block = editModel(block, (model) => {
          if (b.meta.channel === 'readiness') normalizeReadiness(model, withAliases(own), note)
          else for (const s of Array.isArray(model.scenarios) ? model.scenarios : []) if (isObject(s)) normalizeScenario(s, own, note)
        })
      } catch {
        // A model that does not parse is left as written; the validator names it.
      }
    }
    // Content authored for a state under another name is content for that state.
    const states = block.meta.states ?? []
    const aliased = withAliases(states)
    if (aliased.length !== states.length) block = { meta: { ...block.meta, states: aliased }, text: block.text }
    blocks[id] = block
  }
  const projection = normalizeProjection(meta, blocks)
  for (const [state, p] of Object.entries({ ...projection })) {
    const known = AUTHORED_STATES[state]
    if (known?.disposition !== 'alias' || known.runtime === null || projection[known.runtime] !== undefined) continue
    projection[known.runtime] = structuredClone(p)
    note(`state ${state} authored for ${known.runtime}`)
  }
  return { meta: { ...meta, projection }, blocks, normalized }
}

/**
 * The binding a Partial projection's selected module ids are bound to, so the
 * package's own text can name them: the explicit `mismatchBinding`, or the one
 * `requires` entry that ends in `.semanticMismatches`. Null where neither says.
 */
export function mismatchBindingOf(p: Record<string, unknown>): string | null {
  if (typeof p.mismatchBinding === 'string') return p.mismatchBinding
  const named = (Array.isArray(p.requires) ? p.requires : []).filter((r): r is string => typeof r === 'string' && r.endsWith('.semanticMismatches'))
  return named.length === 1 ? named[0] : null
}

/** Every (channel, reference, where) a state projection names, wherever in the projection it names it. */
function projectionRefs(p: Record<string, unknown>): { channel: string; ref: ProjectionRef; at: string }[] {
  const out: { channel: string; ref: ProjectionRef; at: string }[] = []
  const take = (holder: unknown, at: string): void => {
    if (!holder || typeof holder !== 'object') return
    for (const ch of PROJECTION_CHANNELS) for (const ref of refsOf((holder as Record<string, unknown>)[ch])) out.push({ channel: ch, ref, at: `${at}.${ch}` })
  }
  take(p, '')
  take(p.sharedBefore, '.sharedBefore')
  take(p.sharedAfter, '.sharedAfter')
  const mismatches = p.mismatches
  if (mismatches && typeof mismatches === 'object') for (const [id, m] of Object.entries(mismatches)) take(m, `.mismatches.${id}`)
  return out
}

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/** A support block's JSON model: the JSON as written, or a JSON template's shape with its whole-value bindings masked. */
export function supportModelText(block: Block): string {
  return block.meta.format === 'json-template' ? maskJsonTemplate(block.text) : block.text
}

/**
 * The smallest part of a package an issue belongs to: the part the library build
 * takes out (`withholdInvalid`) so that what remains means what it meant.
 *
 * - `block`: the block, and so every channel that projects it;
 * - `prerequisite`: the prerequisite, with the state whose transition it gates;
 * - `state`: the state's whole projection;
 * - `key`: a projection key the runtime does not read;
 * - `module`: one correction module of a composed Partial;
 * - `channel`: one channel of one state, wherever in that state it is named;
 * - `support`: a support block, or a support channel's whole list (`block: null`);
 * - `entry`: one readiness tile or troubleshooting scenario;
 * - `entryState`: one state a scenario names that the runtime never enters;
 * - `conclusion`: one `conclusionByState` entry.
 */
export type IssueLocus =
  | { kind: 'block'; block: string }
  | { kind: 'prerequisite'; index: number }
  | { kind: 'state'; state: string }
  | { kind: 'key'; state: string; key: string }
  | { kind: 'module'; state: string; module: string }
  | { kind: 'channel'; state: string; channel: string }
  | { kind: 'support'; channel: string; block: string | null }
  | { kind: 'entry'; block: string; list: 'tiles' | 'scenarios'; index: number }
  | { kind: 'entryState'; block: string; index: number; value: string }
  | { kind: 'conclusion'; block: string; state: string }

export type PackageIssue = { at: IssueLocus; message: string }

/**
 * Everything wrong with a package, as sentences; empty when the runtime can
 * project it safely. The guide's mechanical checks (§26.9) plus every structure
 * the runtime reads.
 */
export function validatePackage(pkg: CompiledPackage): string[] {
  return packageIssues(pkg).map((i) => i.message)
}

/** Everything wrong with a package, each with the part it belongs to. */
export function packageIssues(pkg: CompiledPackage): PackageIssue[] {
  const issues: PackageIssue[] = []
  const add = (at: IssueLocus, ...messages: string[]): void => {
    for (const message of messages) issues.push({ at, message })
  }
  const { meta, blocks } = pkg
  const declared = new Set([...asStrings(meta.requiredBindings), ...asStrings(meta.optionalBindings), CHANGED_FIELDS_BINDING])
  const prerequisites = Array.isArray(meta.prerequisites) ? meta.prerequisites : []
  const prerequisiteIds = new Set(prerequisites.map((p) => p?.id).filter((id): id is string => typeof id === 'string'))
  const vocab: ConditionVocabulary = { bindings: declared, prerequisites: prerequisiteIds, states: new Set(PACKAGE_STATES) }

  // ---- blocks ----
  for (const [id, b] of Object.entries(blocks)) {
    const at: IssueLocus = { kind: 'block', block: id }
    if (!(BLOCK_CHANNELS as readonly string[]).includes(b.meta.channel)) add(at, `${id}: unsupported channel ${b.meta.channel} (not a channel the runtime renders)`)
    for (const used of bindingsUsed(b.text)) if (!declared.has(used)) add(at, `${id}: undeclared binding ${used}`)
    if (typeof b.meta.endpoint === 'string') {
      for (const m of b.meta.endpoint.matchAll(/\{([A-Za-z0-9_.-]+)\}/g)) if (!declared.has(m[1])) add(at, `${id}: endpoint names undeclared binding ${m[1]}`)
    }
    if (b.meta.format === 'json') {
      try {
        JSON.parse(b.text)
      } catch (e) {
        add(at, `${id}: invalid JSON: ${(e as Error).message}`)
      }
    }
    if (b.meta.format === 'json-template') {
      try {
        JSON.parse(maskJsonTemplate(b.text))
      } catch (e) {
        add(at, `${id}: template is not JSON-shaped after masking: ${(e as Error).message}`)
      }
    }
  }

  // ---- prerequisites ----
  const seen = new Set<string>()
  prerequisites.forEach((p, i) => {
    const locus: IssueLocus = { kind: 'prerequisite', index: i }
    const at = `prerequisites[${i}]`
    if (!p || typeof p.id !== 'string' || typeof p.class !== 'string') return add(locus, `${at}: an id and a class`)
    if (seen.has(p.id)) add(locus, `${at}: duplicate id ${p.id}`)
    seen.add(p.id)
    if (p.requiredBefore !== undefined) {
      const [from, to] = String(p.requiredBefore).split('->')
      if (!(PACKAGE_STATES as readonly string[]).includes(from) || !(PACKAGE_STATES as readonly string[]).includes(to)) add(locus, `${at}.requiredBefore: <state>-><state>`)
    }
    if (p.evidence !== undefined) add(locus, ...conditionErrors(p.evidence, vocab, `${at}.evidence`))
    for (const b of asStrings(p.invalidatedBy)) if (!declared.has(b)) add(locus, `${at}.invalidatedBy: undeclared binding ${b}`)
  })

  // ---- projections ----
  for (const [state, p] of Object.entries(meta.projection ?? {})) {
    const whole: IssueLocus = { kind: 'state', state }
    if (!isObject(p)) {
      add(whole, `projection.${state}: an object`)
      continue
    }
    for (const key of Object.keys(p)) if (!PROJECTION_KEYS.has(key)) add({ kind: 'key', state, key }, `projection.${state}: unsupported key ${key}`)
    if (p.mode !== undefined && p.mode !== 'composeByMismatch') add(whole, `projection.${state}: mode ${JSON.stringify(p.mode)} is not a composition the runtime implements (authoring guide v2.5 defines composeByMismatch and compose)`)
    for (const r of asStrings(p.requires)) if (!declared.has(r)) add(whole, `projection.${state}.requires: undeclared binding ${r}`)
    if (state === 'partial' && p.mode === undefined) add(whole, `projection.partial: a correction is composed from the engine's changed fields (composeByMismatch, or compose with modules), so only the corrections that apply are shown`)
    if (p.mode === 'composeByMismatch') {
      const binding = mismatchBindingOf(p)
      if (binding === null) add(whole, `projection.${state}: a composed projection names the binding its selected modules are bound to (mismatchBinding, or one requires entry ending .semanticMismatches)`)
      else if (!declared.has(binding)) add(whole, `projection.${state}.mismatchBinding: undeclared binding ${binding}`)
      const table = p.mismatches
      if (!isObject(table) || Object.keys(table).length === 0) add(whole, `projection.${state}: a composed projection has at least one mismatch module`)
      for (const [id, m] of Object.entries(isObject(table) ? table : {})) {
        const mod: IssueLocus = { kind: 'module', state, module: id }
        const at = `projection.${state}.mismatches.${id}`
        if (!isObject(m)) {
          add(mod, `${at}: an object`)
          continue
        }
        for (const key of Object.keys(m)) if (!MISMATCH_KEYS.has(key)) add(mod, `${at}: unsupported key ${key}`)
        const facts = m.facts
        if (facts !== undefined && (!Array.isArray(facts) || facts.some((f) => typeof f !== 'string' || !MATERIAL_ROOTS.some((root) => f === root || f.startsWith(`${root}.`))))) {
          add(mod, `${at}.facts: policy field paths under ${MATERIAL_ROOTS.join(', ')}`)
        }
        if (m.select !== undefined) add(mod, ...conditionErrors(m.select, vocab, `${at}.select`))
        if (m.alongside !== undefined && typeof m.alongside !== 'boolean') add(mod, `${at}.alongside: true or false`)
        if (facts === undefined && m.select === undefined) add(mod, `${at}: IAMAI cannot select this module (it declares no facts and no select condition)`)
        for (const r of asStrings(m.requires)) if (!declared.has(r)) add(mod, `${at}.requires: undeclared binding ${r}`)
      }
    }
    for (const { channel, ref, at } of projectionRefs(p)) {
      const locus: IssueLocus = { kind: 'channel', state, channel }
      const b = blocks[ref.block]
      if (!b) {
        add(locus, `projection.${state}${at}: missing block ${ref.block}`)
        continue
      }
      if (b.meta.channel !== channel) add(locus, `projection.${state}${at}: ${ref.block} is a ${b.meta.channel} block`)
      if (!(b.meta.states ?? []).includes(state)) add(locus, `projection.${state}${at}: ${ref.block} does not declare state ${state}`)
      if (channel === 'powershell' && b.meta.kind === 'deployableAfterBinding') {
        if (typeof ref.mode !== 'string') add(locus, `projection.${state}${at}: a deployable script is projected in a mode`)
        if ((ref.corrections ?? []).length > 0 && typeof b.meta.invocation?.correctionsParameter !== 'string') add(locus, `projection.${state}${at}: corrections need the invocation's correctionsParameter`)
        const withheld = b.meta.invocation?.withheldModes
        if (typeof ref.mode === 'string' && withheld && typeof withheld[ref.mode] === 'string') add(locus, `projection.${state}${at}: mode ${ref.mode} is withheld by its invocation: ${withheld[ref.mode]}`)
      }
      if (channel === 'email') {
        const own = typeof b.meta.audience === 'string' && typeof b.meta.communicationTrigger === 'string'
        const declaredInMeta = meta.email?.block === ref.block && typeof meta.email.audience === 'string' && typeof meta.email.communicationTrigger === 'string'
        if (!own && !declaredInMeta) add(locus, `projection.${state}${at}: an Email declares its audience and communicationTrigger (guide §26.6)`)
      }
    }
  }
  // Every deployable script declares how it is run, and that declaration agrees with the script (invocation.ts).
  for (const [id, b] of Object.entries(blocks)) {
    if (b.meta.channel !== 'powershell' || b.meta.kind !== 'deployableAfterBinding') continue
    add({ kind: 'block', block: id }, ...invocationErrors(`${id}.invocation`, b.meta.invocation, b.text, vocab))
  }

  // ---- support models ----
  for (const [channel, ids] of Object.entries(meta.supportBlocks ?? {})) {
    if (!Array.isArray(ids)) {
      add({ kind: 'support', channel, block: null }, `supportBlocks.${channel}: a list of block ids`)
      continue
    }
    for (const id of ids) {
      const whole: IssueLocus = { kind: 'support', channel, block: id }
      const b = blocks[id]
      if (!b) {
        add(whole, `supportBlocks.${channel}: missing block ${id}`)
        continue
      }
      if (b.meta.channel !== channel) {
        add(whole, `supportBlocks.${channel}: ${id} is a ${b.meta.channel} block`)
        continue
      }
      if (b.meta.format !== 'json' && b.meta.format !== 'json-template') {
        add(whole, `${id}: a support model is JSON the runtime reads, not ${b.meta.format ?? 'prose'}`)
        continue
      }
      let model: unknown
      try {
        model = JSON.parse(supportModelText(b))
      } catch (e) {
        add(whole, `${id}: does not parse as JSON: ${(e as Error).message}`)
        continue
      }
      if (!isObject(model)) {
        add(whole, `${id}: a support model is a JSON object`)
        continue
      }
      if (channel === 'readiness') issues.push(...readinessModelIssues(id, whole, model, vocab))
      if (channel === 'troubleshooting') issues.push(...troubleshootingModelIssues(id, whole, model))
    }
  }
  return issues
}

function readinessModelIssues(id: string, whole: IssueLocus, model: Record<string, unknown>, vocab: ConditionVocabulary): PackageIssue[] {
  const issues: PackageIssue[] = []
  const tiles = model.tiles
  if (!Array.isArray(tiles)) return [{ at: whole, message: `${id}.tiles: a list` }]
  tiles.forEach((t, i) => {
    const locus: IssueLocus = { kind: 'entry', block: id, list: 'tiles', index: i }
    const add = (message: string): void => void issues.push({ at: locus, message })
    const at = `${id}.tiles[${i}]`
    const tile = (t ?? {}) as Record<string, unknown>
    if (typeof tile.id !== 'string') add(`${at}: an id`)
    if (typeof tile.label !== 'string' && typeof tile.gate !== 'string') add(`${at}: a label or gate`)
    if (tile.gateKey !== undefined && typeof tile.gateKey !== 'string') add(`${at}.gateKey: a runtime tile key`)
    for (const c of tile.confirms === undefined ? [] : Array.isArray(tile.confirms) ? tile.confirms : [null]) {
      if (typeof c !== 'string' || !vocab.prerequisites.has(c)) add(`${at}.confirms: ${JSON.stringify(c)} is not a declared prerequisite`)
    }
    const rules = tile.rules
    if (!Array.isArray(rules) || rules.length === 0) return add(`${at}.rules: at least one rule`)
    rules.forEach((r, j) => {
      const rule = (r ?? {}) as Record<string, unknown>
      if (!(READINESS_RESULTS as readonly string[]).includes(String(rule.result))) add(`${at}.rules[${j}].result: one of ${READINESS_RESULTS.join(', ')}`)
      if (typeof rule.line !== 'string') add(`${at}.rules[${j}].line: the authored line`)
      if (rule.if === undefined) add(`${at}.rules[${j}]: no machine condition (if), so the runtime can never select it`)
      else for (const e of conditionErrors(rule.if, vocab, `${at}.rules[${j}].if`)) add(e)
    })
  })
  const conclusions = (model.conclusions ?? {}) as Record<string, unknown>
  const byState = model.conclusionByState
  if (byState !== undefined) {
    if (!isObject(byState)) issues.push({ at: whole, message: `${id}.conclusionByState: an object` })
    else
      for (const [state, key] of Object.entries(byState)) {
        const at: IssueLocus = { kind: 'conclusion', block: id, state }
        if (!(PACKAGE_STATES as readonly string[]).includes(state)) issues.push({ at, message: `${id}.conclusionByState.${state}: not a runtime state` })
        if (typeof key !== 'string' || typeof conclusions[key] !== 'string') issues.push({ at, message: `${id}.conclusionByState.${state}: ${JSON.stringify(key)} is not a conclusion` })
      }
  }
  return issues
}

function troubleshootingModelIssues(id: string, whole: IssueLocus, model: Record<string, unknown>): PackageIssue[] {
  const issues: PackageIssue[] = []
  const scenarios = model.scenarios
  if (!Array.isArray(scenarios)) return [{ at: whole, message: `${id}.scenarios: a list` }]
  scenarios.forEach((s, i) => {
    const locus: IssueLocus = { kind: 'entry', block: id, list: 'scenarios', index: i }
    const add = (message: string): void => void issues.push({ at: locus, message })
    const at = `${id}.scenarios[${i}]`
    const sc = (s ?? {}) as Record<string, unknown>
    if (typeof sc.id !== 'string') add(`${at}: an id`)
    if (typeof sc.title !== 'string') add(`${at}: a title`)
    if (!Array.isArray(sc.states) || sc.states.length === 0) add(`${at}.states: the states it applies to (guide §30.5)`)
    else
      for (const st of sc.states) {
        if (!(PACKAGE_STATES as readonly string[]).includes(String(st))) issues.push({ at: { kind: 'entryState', block: id, index: i, value: String(st) }, message: `${at}.states: ${JSON.stringify(st)} is not a runtime state` })
      }
    for (const key of ['likelyCauses', 'check', 'fix', 'doNot', 'then', 'sources']) {
      if (sc[key] !== undefined && !Array.isArray(sc[key])) add(`${at}.${key}: a list`)
    }
  })
  return issues
}

/** What the guide allows and the runtime will never reach: reported, not refused. */
export function packageWarnings(pkg: CompiledPackage): string[] {
  const warnings: string[] = []
  for (const state of Object.keys(pkg.meta.projection ?? {})) {
    if (!(PACKAGE_STATES as readonly string[]).includes(state)) warnings.push(`projection.${state}: IAMAI's runtime never enters this state, so it is never shown`)
  }
  for (const state of PACKAGE_STATES) if (!pkg.meta.projection?.[state]) warnings.push(`projection.${state}: no projection, so the step shows no implementation in that state`)
  const sources = pkg.meta.verifiedSources ?? []
  if (sources.length === 0 || sources.every((s) => s.userFacing !== true)) warnings.push('verifiedSources: none is userFacing, so no source date and no reference is shown')
  return warnings
}

// ---- withholding ----

/** Stands in for a whole-value `{{json:x}}` binding while a JSON template's model is edited as JSON. */
const TEMPLATE_TOKEN = '@@iamai-json-binding-'

type ModelEdit = { entries: Set<number>; entryStates: Map<number, Set<string>>; conclusions: Set<string> }

/**
 * A support model with tiles or scenarios taken out, states a scenario names
 * that the runtime never enters dropped from it, and conclusions taken out. A
 * JSON template keeps its whole-value bindings exactly where they were.
 */
function editSupportModel(block: Block, list: 'tiles' | 'scenarios' | null, edit: ModelEdit): Block {
  return editModel(block, (model) => {
    if (list !== null && Array.isArray(model[list])) {
      const entries = model[list] as unknown[]
      for (const [index, drop] of edit.entryStates) {
        const entry = entries[index]
        if (isObject(entry) && Array.isArray(entry.states)) entry.states = entry.states.filter((s) => !drop.has(String(s)))
      }
      model[list] = entries.filter((_, i) => !edit.entries.has(i))
    }
    if (isObject(model.conclusionByState)) for (const state of edit.conclusions) delete model.conclusionByState[state]
  })
}

/** A support block's JSON model edited as JSON; a JSON template keeps its whole-value bindings exactly where they were. Throws where the model does not parse. */
function editModel(block: Block, edit: (model: Record<string, unknown>) => void): Block {
  const bindings: string[] = []
  const source = block.meta.format === 'json-template' ? block.text.replace(JSON_BINDING, (m) => JSON.stringify(`${TEMPLATE_TOKEN}${bindings.push(m) - 1}`)) : block.text
  const model = JSON.parse(source) as Record<string, unknown>
  edit(model)
  const text = JSON.stringify(model, null, 2).replace(new RegExp(`"${TEMPLATE_TOKEN}(\\d+)"`, 'g'), (_m, i: string) => bindings[Number(i)])
  return { meta: block.meta, text: `${text}\n` }
}

/**
 * One round of withholding: every part an issue names is taken out. Taking a
 * part out never widens what the rest allows: a module that cannot be selected
 * leaves the changes it would have covered uncovered, so Partial holds; a
 * prerequisite that cannot be read takes the transition it gates with it; and a
 * projection key the runtime does not read is dropped alone only where it is a
 * channel the runtime does not render, otherwise the state goes.
 */
function withholdOnce(pkg: CompiledPackage, issues: PackageIssue[]): CompiledPackage {
  const meta = structuredClone(pkg.meta)
  const blocks = { ...pkg.blocks }
  const projection: Record<string, Record<string, unknown>> = isObject(meta.projection) ? meta.projection : {}
  const states = new Set<string>()
  let allStates = false
  const keys: { state: string; key: string }[] = []
  const modules: { state: string; module: string }[] = []
  const channels: { state: string; channel: string }[] = []
  const prerequisites = new Set<number>()
  const support: { channel: string; block: string | null }[] = []
  const edits = new Map<string, { list: 'tiles' | 'scenarios' | null; edit: ModelEdit }>()
  const editOf = (block: string): { list: 'tiles' | 'scenarios' | null; edit: ModelEdit } => {
    let e = edits.get(block)
    if (!e) edits.set(block, (e = { list: null, edit: { entries: new Set(), entryStates: new Map(), conclusions: new Set() } }))
    return e
  }
  for (const { at } of issues) {
    switch (at.kind) {
      case 'block':
        delete blocks[at.block]
        break
      case 'prerequisite': {
        prerequisites.add(at.index)
        const gate = (meta.prerequisites ?? [])[at.index]?.requiredBefore
        const from = typeof gate === 'string' ? gate.split('->')[0] : null
        if (from !== null && (PACKAGE_STATES as readonly string[]).includes(from)) states.add(from)
        else if (gate !== undefined) allStates = true
        break
      }
      case 'state':
        states.add(at.state)
        break
      case 'key': {
        const refs = refsOf(projection[at.state]?.[at.key])
        if (refs.length > 0 && refs.every((r) => pkg.blocks[r.block]?.meta.channel === at.key)) keys.push(at)
        else states.add(at.state)
        break
      }
      case 'module':
        modules.push(at)
        break
      case 'channel':
        channels.push(at)
        break
      case 'support':
        support.push(at)
        break
      case 'entry': {
        const e = editOf(at.block)
        e.list = at.list
        e.edit.entries.add(at.index)
        break
      }
      case 'entryState': {
        const e = editOf(at.block)
        e.list = 'scenarios'
        const drop = e.edit.entryStates.get(at.index) ?? new Set<string>()
        drop.add(at.value)
        e.edit.entryStates.set(at.index, drop)
        break
      }
      case 'conclusion':
        editOf(at.block).edit.conclusions.add(at.state)
        break
    }
  }
  for (const { state, key } of keys) delete projection[state]?.[key]
  for (const { state, module } of modules) {
    const table = projection[state]?.mismatches
    if (isObject(table)) delete table[module]
  }
  for (const { state, channel } of channels) {
    const p = projection[state]
    if (!isObject(p)) continue
    const table = isObject(p.mismatches) ? Object.values(p.mismatches) : []
    for (const holder of [p, p.sharedBefore, p.sharedAfter, ...table]) if (isObject(holder)) delete holder[channel]
  }
  for (const state of states) delete projection[state]
  meta.projection = allStates ? {} : projection
  if (prerequisites.size > 0) meta.prerequisites = (meta.prerequisites ?? []).filter((_, i) => !prerequisites.has(i))
  for (const { channel, block } of support) {
    if (!meta.supportBlocks) continue
    const list = meta.supportBlocks[channel]
    if (block === null || !Array.isArray(list)) delete meta.supportBlocks[channel]
    else meta.supportBlocks[channel] = list.filter((id) => id !== block)
  }
  for (const [id, { list, edit }] of edits) if (blocks[id]) blocks[id] = editSupportModel(blocks[id], list, edit)
  return { meta, blocks }
}

/**
 * A library package the runtime can project safely, and what was withheld to
 * make it so: every issue's part is taken out, round after round, until the
 * package validates. A part taken out can only take away what the step shows —
 * a channel, a state, a correction, a tile, a scenario — never add to it or
 * release an artifact a check was holding.
 */
export function withholdInvalid(pkg: CompiledPackage): { pkg: CompiledPackage; withheld: string[] } {
  let current: CompiledPackage = { meta: structuredClone(pkg.meta), blocks: { ...pkg.blocks } }
  const withheld: string[] = []
  for (let round = 0; round < 32; round++) {
    const issues = packageIssues(current)
    if (issues.length === 0) return { pkg: current, withheld }
    withheld.push(...issues.map((i) => i.message))
    current = withholdOnce(current, issues)
  }
  throw new PackageError(`${pkg.meta.stepId ?? 'package'}: its invalid parts could not be withheld`)
}

function parseMeta(metaJson: string): PackageMeta {
  try {
    return JSON.parse(metaJson) as PackageMeta
  } catch (e) {
    throw new PackageError(`META.json does not parse: ${(e as Error).message}`)
  }
}

/**
 * A package from its META.json and CONTENT.md text, normalised and validated; a
 * package with any error is refused whole.
 */
export function compilePackage(metaJson: string, contentMd: string): CompiledPackage {
  const meta = parseMeta(metaJson)
  const { meta: normalized, blocks } = normalizePackage(meta, parseBlocks(contentMd))
  const pkg: CompiledPackage = { meta: normalized, blocks }
  const errors = validatePackage(pkg)
  if (errors.length > 0) throw new PackageError(`${meta.stepId ?? 'package'}:\n${errors.join('\n')}`)
  return pkg
}

/**
 * A package as the library registers it: normalised, with every part the runtime
 * cannot project safely withheld (`withholdInvalid`). Only a package whose files
 * do not parse at all is refused.
 */
export function compileLibraryPackage(metaJson: string, contentMd: string): { pkg: CompiledPackage; withheld: string[] } {
  const { meta, blocks } = normalizePackage(parseMeta(metaJson), parseBlocks(contentMd))
  return withholdInvalid({ meta, blocks })
}
