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
// Pure: no DOM, no network, no file system.
import type { Condition } from './conditions.ts'
import { conditionErrors } from './conditions.ts'
import type { ConditionVocabulary } from './conditions.ts'
import { invocationErrors } from './invocation.ts'
import type { InvocationSpec } from './invocation.ts'

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
  baselineAuthority?: { pinCommit?: string } & Record<string, unknown>
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
  return text.replace(/\{\{json:[A-Za-z0-9_.-]+\}\}/g, 'null')
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

/** A support block's JSON model: the JSON as written, or a JSON template's shape with its whole-value bindings masked. */
export function supportModelText(block: Block): string {
  return block.meta.format === 'json-template' ? maskJsonTemplate(block.text) : block.text
}

/**
 * Everything wrong with a package, as sentences; empty when the runtime can
 * project it safely. The guide's mechanical checks (§26.9) plus every structure
 * the runtime reads.
 */
export function validatePackage(pkg: CompiledPackage): string[] {
  const errors: string[] = []
  const { meta, blocks } = pkg
  const declared = new Set([...(meta.requiredBindings ?? []), ...(meta.optionalBindings ?? []), CHANGED_FIELDS_BINDING])
  const prerequisites = Array.isArray(meta.prerequisites) ? meta.prerequisites : []
  const prerequisiteIds = new Set(prerequisites.map((p) => p?.id).filter((id): id is string => typeof id === 'string'))
  const vocab: ConditionVocabulary = { bindings: declared, prerequisites: prerequisiteIds, states: new Set(PACKAGE_STATES) }

  // ---- blocks ----
  for (const [id, b] of Object.entries(blocks)) {
    if (!(BLOCK_CHANNELS as readonly string[]).includes(b.meta.channel)) errors.push(`${id}: unsupported channel ${b.meta.channel} (not a channel the runtime renders)`)
    for (const used of bindingsUsed(b.text)) if (!declared.has(used)) errors.push(`${id}: undeclared binding ${used}`)
    if (typeof b.meta.endpoint === 'string') {
      for (const m of b.meta.endpoint.matchAll(/\{([A-Za-z0-9_.-]+)\}/g)) if (!declared.has(m[1])) errors.push(`${id}: endpoint names undeclared binding ${m[1]}`)
    }
    if (b.meta.format === 'json') {
      try {
        JSON.parse(b.text)
      } catch (e) {
        errors.push(`${id}: invalid JSON: ${(e as Error).message}`)
      }
    }
    if (b.meta.format === 'json-template') {
      try {
        JSON.parse(maskJsonTemplate(b.text))
      } catch (e) {
        errors.push(`${id}: template is not JSON-shaped after masking: ${(e as Error).message}`)
      }
    }
  }

  // ---- prerequisites ----
  const seen = new Set<string>()
  prerequisites.forEach((p, i) => {
    const at = `prerequisites[${i}]`
    if (!p || typeof p.id !== 'string' || typeof p.class !== 'string') return errors.push(`${at}: an id and a class`)
    if (seen.has(p.id)) errors.push(`${at}: duplicate id ${p.id}`)
    seen.add(p.id)
    if (p.requiredBefore !== undefined) {
      const [from, to] = String(p.requiredBefore).split('->')
      if (!(PACKAGE_STATES as readonly string[]).includes(from) || !(PACKAGE_STATES as readonly string[]).includes(to)) errors.push(`${at}.requiredBefore: <state>-><state>`)
    }
    if (p.evidence !== undefined) errors.push(...conditionErrors(p.evidence, vocab, `${at}.evidence`))
    for (const b of asStrings(p.invalidatedBy)) if (!declared.has(b)) errors.push(`${at}.invalidatedBy: undeclared binding ${b}`)
  })

  // ---- projections ----
  for (const [state, p] of Object.entries(meta.projection ?? {})) {
    for (const key of Object.keys(p)) if (!PROJECTION_KEYS.has(key)) errors.push(`projection.${state}: unsupported key ${key}`)
    if (p.mode !== undefined && p.mode !== 'composeByMismatch') errors.push(`projection.${state}: mode ${JSON.stringify(p.mode)} is not a composition the runtime implements (authoring guide v2.5 defines composeByMismatch and compose)`)
    for (const r of asStrings(p.requires)) if (!declared.has(r)) errors.push(`projection.${state}.requires: undeclared binding ${r}`)
    if (p.mode === 'composeByMismatch') {
      const binding = mismatchBindingOf(p)
      if (binding === null) errors.push(`projection.${state}: a composed projection names the binding its selected modules are bound to (mismatchBinding, or one requires entry ending .semanticMismatches)`)
      else if (!declared.has(binding)) errors.push(`projection.${state}.mismatchBinding: undeclared binding ${binding}`)
      const table = (p.mismatches ?? {}) as Record<string, Record<string, unknown>>
      if (typeof table !== 'object' || Object.keys(table).length === 0) errors.push(`projection.${state}: a composed projection has at least one mismatch module`)
      for (const [id, m] of Object.entries(table)) {
        const at = `projection.${state}.mismatches.${id}`
        for (const key of Object.keys(m ?? {})) if (!MISMATCH_KEYS.has(key)) errors.push(`${at}: unsupported key ${key}`)
        const facts = m?.facts
        if (facts !== undefined && (!Array.isArray(facts) || facts.some((f) => typeof f !== 'string' || !MATERIAL_ROOTS.some((root) => f === root || f.startsWith(`${root}.`))))) {
          errors.push(`${at}.facts: policy field paths under ${MATERIAL_ROOTS.join(', ')}`)
        }
        if (m?.select !== undefined) errors.push(...conditionErrors(m.select, vocab, `${at}.select`))
        if (m?.alongside !== undefined && typeof m.alongside !== 'boolean') errors.push(`${at}.alongside: true or false`)
        if (facts === undefined && m?.select === undefined) errors.push(`${at}: IAMAI cannot select this module (it declares no facts and no select condition)`)
        for (const r of asStrings(m?.requires)) if (!declared.has(r)) errors.push(`${at}.requires: undeclared binding ${r}`)
      }
    }
    for (const { channel, ref, at } of projectionRefs(p)) {
      const b = blocks[ref.block]
      if (!b) {
        errors.push(`projection.${state}${at}: missing block ${ref.block}`)
        continue
      }
      if (b.meta.channel !== channel) errors.push(`projection.${state}${at}: ${ref.block} is a ${b.meta.channel} block`)
      if (!(b.meta.states ?? []).includes(state)) errors.push(`projection.${state}${at}: ${ref.block} does not declare state ${state}`)
      if (channel === 'powershell' && b.meta.kind === 'deployableAfterBinding') {
        if (typeof ref.mode !== 'string') errors.push(`projection.${state}${at}: a deployable script is projected in a mode`)
        if ((ref.corrections ?? []).length > 0 && typeof b.meta.invocation?.correctionsParameter !== 'string') errors.push(`projection.${state}${at}: corrections need the invocation's correctionsParameter`)
      }
      if (channel === 'email') {
        const own = typeof b.meta.audience === 'string' && typeof b.meta.communicationTrigger === 'string'
        const declaredInMeta = meta.email?.block === ref.block && typeof meta.email.audience === 'string' && typeof meta.email.communicationTrigger === 'string'
        if (!own && !declaredInMeta) errors.push(`projection.${state}${at}: an Email declares its audience and communicationTrigger (guide §26.6)`)
      }
    }
  }
  // Every deployable script declares how it is run, and that declaration agrees with the script (invocation.ts).
  for (const [id, b] of Object.entries(blocks)) {
    if (b.meta.channel !== 'powershell' || b.meta.kind !== 'deployableAfterBinding') continue
    errors.push(...invocationErrors(`${id}.invocation`, b.meta.invocation, b.text, vocab))
  }

  // ---- support models ----
  for (const [channel, ids] of Object.entries(meta.supportBlocks ?? {})) {
    for (const id of ids) {
      const b = blocks[id]
      if (!b) {
        errors.push(`supportBlocks.${channel}: missing block ${id}`)
        continue
      }
      if (b.meta.channel !== channel) {
        errors.push(`supportBlocks.${channel}: ${id} is a ${b.meta.channel} block`)
        continue
      }
      if (b.meta.format !== 'json' && b.meta.format !== 'json-template') {
        errors.push(`${id}: a support model is JSON the runtime reads, not ${b.meta.format ?? 'prose'}`)
        continue
      }
      let model: Record<string, unknown>
      try {
        model = JSON.parse(supportModelText(b)) as Record<string, unknown>
      } catch (e) {
        errors.push(`${id}: does not parse as JSON: ${(e as Error).message}`)
        continue
      }
      if (channel === 'readiness') errors.push(...readinessModelErrors(id, model, vocab))
      if (channel === 'troubleshooting') errors.push(...troubleshootingModelErrors(id, model))
    }
  }
  return errors
}

function readinessModelErrors(id: string, model: Record<string, unknown>, vocab: ConditionVocabulary): string[] {
  const errors: string[] = []
  const tiles = model.tiles
  if (!Array.isArray(tiles)) return [`${id}.tiles: a list`]
  tiles.forEach((t, i) => {
    const at = `${id}.tiles[${i}]`
    const tile = (t ?? {}) as Record<string, unknown>
    if (typeof tile.id !== 'string') errors.push(`${at}: an id`)
    if (typeof tile.label !== 'string' && typeof tile.gate !== 'string') errors.push(`${at}: a label or gate`)
    if (tile.gateKey !== undefined && typeof tile.gateKey !== 'string') errors.push(`${at}.gateKey: a runtime tile key`)
    for (const c of tile.confirms === undefined ? [] : Array.isArray(tile.confirms) ? tile.confirms : [null]) {
      if (typeof c !== 'string' || !vocab.prerequisites.has(c)) errors.push(`${at}.confirms: ${JSON.stringify(c)} is not a declared prerequisite`)
    }
    const rules = tile.rules
    if (!Array.isArray(rules) || rules.length === 0) return errors.push(`${at}.rules: at least one rule`)
    rules.forEach((r, j) => {
      const rule = (r ?? {}) as Record<string, unknown>
      if (!(READINESS_RESULTS as readonly string[]).includes(String(rule.result))) errors.push(`${at}.rules[${j}].result: one of ${READINESS_RESULTS.join(', ')}`)
      if (typeof rule.line !== 'string') errors.push(`${at}.rules[${j}].line: the authored line`)
      if (rule.if === undefined) errors.push(`${at}.rules[${j}]: no machine condition (if), so the runtime can never select it`)
      else errors.push(...conditionErrors(rule.if, vocab, `${at}.rules[${j}].if`))
    })
  })
  const conclusions = (model.conclusions ?? {}) as Record<string, unknown>
  const byState = model.conclusionByState
  if (byState !== undefined) {
    if (!byState || typeof byState !== 'object') errors.push(`${id}.conclusionByState: an object`)
    else
      for (const [state, key] of Object.entries(byState)) {
        if (!(PACKAGE_STATES as readonly string[]).includes(state)) errors.push(`${id}.conclusionByState.${state}: not a runtime state`)
        if (typeof key !== 'string' || typeof conclusions[key] !== 'string') errors.push(`${id}.conclusionByState.${state}: ${JSON.stringify(key)} is not a conclusion`)
      }
  }
  return errors
}

function troubleshootingModelErrors(id: string, model: Record<string, unknown>): string[] {
  const errors: string[] = []
  const scenarios = model.scenarios
  if (!Array.isArray(scenarios)) return [`${id}.scenarios: a list`]
  scenarios.forEach((s, i) => {
    const at = `${id}.scenarios[${i}]`
    const sc = (s ?? {}) as Record<string, unknown>
    if (typeof sc.id !== 'string') errors.push(`${at}: an id`)
    if (typeof sc.title !== 'string') errors.push(`${at}: a title`)
    if (!Array.isArray(sc.states) || sc.states.length === 0) errors.push(`${at}.states: the states it applies to (guide §30.5)`)
    else for (const st of sc.states) if (!(PACKAGE_STATES as readonly string[]).includes(String(st))) errors.push(`${at}.states: ${JSON.stringify(st)} is not a runtime state`)
    for (const key of ['likelyCauses', 'check', 'fix', 'doNot', 'then', 'sources']) {
      if (sc[key] !== undefined && !Array.isArray(sc[key])) errors.push(`${at}.${key}: a list`)
    }
  })
  return errors
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

/**
 * A package from its META.json and CONTENT.md text, normalised and validated; a
 * package with any error is refused whole.
 */
export function compilePackage(metaJson: string, contentMd: string): CompiledPackage {
  let meta: PackageMeta
  try {
    meta = JSON.parse(metaJson) as PackageMeta
  } catch (e) {
    throw new PackageError(`META.json does not parse: ${(e as Error).message}`)
  }
  const blocks = parseBlocks(contentMd)
  const pkg: CompiledPackage = { meta: { ...meta, projection: normalizeProjection(meta, blocks) }, blocks }
  const errors = validatePackage(pkg)
  if (errors.length > 0) throw new PackageError(`${meta.stepId ?? 'package'}:\n${errors.join('\n')}`)
  return pkg
}
