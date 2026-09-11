// Projecting an implementation-content package into what one step shows now.
//
// The package owns the words (CONTENT.md) and the rules for choosing them
// (META.json); IAMAI owns the state and the tenant's values. This module joins
// the two and adds nothing of its own: a state selects the blocks META.json
// names for it, a Partial state composes only the correction modules for the
// semantic mismatches IAMAI supplied, and bindings fill the blocks — or, where a
// required value is missing, nothing is produced at all. It never selects a
// block by its heading, its position or a policy's name.
//
// Pure: no DOM, no network, no clock.
import type { Block, CompiledPackage, ProjectionRef, VerifiedSource } from './protocol.ts'
import { BINDING, PackageError, refsOf } from './protocol.ts'

/** The states a package projects (guide §2). */
export const PACKAGE_STATES = ['missing', 'partial', 'reportOnly', 'readyToEnforce', 'inPlace', 'blocked', 'needsDecision', 'sourceConflict', 'notLicensed'] as const
export type PackageState = (typeof PACKAGE_STATES)[number]

/**
 * The viewer's channel order: the approved selector's Entra, PowerShell, JSON
 * and AI Info (docs/design/approved/anatomy/plan-step-v1.html `.impl-tabs`),
 * with Email appended as the owner authorised.
 */
export const OUTPUT_ORDER = ['entra', 'powershell', 'json', 'aiInfo', 'email'] as const
export type OutputChannel = (typeof OUTPUT_ORDER)[number]

export type Bindings = Readonly<Record<string, unknown>>

export type ChannelArtifact = {
  channel: OutputChannel
  /** The block ids that made it, in projection order, each once. */
  blocks: string[]
  format: string
  /** The bound text: what the preview shows, the viewer expands and Copy copies. */
  text: string
  /** A JSON block's request, bound: `PATCH /identity/conditionalAccess/policies/<id>`. */
  requests: { method: string; endpoint: string }[]
  /** A mode-based script's mode, and the corrections a Partial projection asks of it. */
  mode: string | null
  corrections: string[]
  /** An Email block's declared audience and trigger (guide §26.6). */
  communication: { audience: string; trigger: string; purpose: string } | null
}

/** Why a projection produced nothing: a required value IAMAI does not have, a mismatch the package has no module for, or bound output that does not parse. */
export type Hold = { missingBindings: string[]; unknownMismatches: string[]; invalid: string[] }

export type Projection = { state: PackageState; hold: Hold | null; channels: ChannelArtifact[] }

/** A binding IAMAI actually has: not absent, not blank, not an empty list. */
export function present(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  return true
}

/** The authored marker on a line that disappears when its optional value is unavailable. */
const OMIT = /\s*\[omit (?:this line )?when unavailable\]/g

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(', ')
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

/**
 * A block's text with the tenant's values in place. `{{json:x}}` is replaced by
 * the JSON encoding of the value, `{{x}}` by its text. A line naming an optional
 * value IAMAI does not have disappears whole, marker and all; a missing required
 * value refuses the block rather than printing a placeholder.
 */
export function bindText(text: string, bindings: Bindings, required: ReadonlySet<string>): { text: string } | { missing: string[] } {
  const missing = new Set<string>()
  const out: string[] = []
  for (const line of text.split('\n')) {
    const used = [...line.matchAll(BINDING)].map((m) => m[2])
    const absent = used.filter((b) => !present(bindings[b]))
    if (absent.length > 0) {
      for (const b of absent) if (required.has(b)) missing.add(b)
      continue
    }
    out.push(line.replace(BINDING, (_m, json: string | undefined, key: string) => (json ? JSON.stringify(bindings[key]) : formatValue(bindings[key]))).replace(OMIT, ''))
  }
  if (missing.size > 0) return { missing: [...missing] }
  return { text: out.join('\n').replace(/\s+$/, '') }
}

/** An endpoint with its single-brace identity filled (`/policies/{policy.current.id}`), or null where the identity is unknown. */
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

/** A projection list with each block once: a block several mismatches share is one correction, its script corrections merged. */
function dedupe(refs: ProjectionRef[]): ProjectionRef[] {
  const out: ProjectionRef[] = []
  for (const r of refs) {
    const seen = out.find((o) => o.block === r.block)
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

/**
 * What one state of one package shows. Every channel META.json names for the
 * state is built from its blocks; a channel it names nothing for is absent. Any
 * refusal — a required value missing, a mismatch with no module, bound JSON that
 * does not parse — holds the whole projection, so no partial deployable
 * artifact can reach the page.
 */
export function projectImplementation(pkg: CompiledPackage, state: PackageState, bindings: Bindings): Projection {
  const p = pkg.meta.projection[state] as Record<string, unknown> | undefined
  if (!p) throw new PackageError(`${pkg.meta.stepId}: no projection for ${state}`)
  const hold: Hold = { missingBindings: [], unknownMismatches: [], invalid: [] }
  hold.missingBindings = asStrings(p.requires).filter((b) => !present(bindings[b]))
  if (hold.missingBindings.length > 0) return { state, hold, channels: [] }

  const refs = new Map<OutputChannel, ProjectionRef[]>()
  if (p.mode === 'composeByMismatch') {
    const ids = asStrings(bindings['policy.current.semanticMismatches'])
    const table = (p.mismatches ?? {}) as Record<string, Record<string, unknown>>
    hold.unknownMismatches = ids.filter((id) => !Object.hasOwn(table, id))
    if (hold.unknownMismatches.length > 0) return { state, hold, channels: [] }
    const before = (p.sharedBefore ?? {}) as Record<string, unknown>
    const after = (p.sharedAfter ?? {}) as Record<string, unknown>
    for (const ch of OUTPUT_ORDER) {
      const own = ids.flatMap((id) => refsOf(table[id][ch]))
      refs.set(ch, [...(own.length > 0 ? [...refsOf(before[ch]), ...own, ...refsOf(after[ch])] : []), ...refsOf(p[ch])])
    }
  } else {
    for (const ch of OUTPUT_ORDER) refs.set(ch, refsOf(p[ch]))
  }

  const required = new Set(pkg.meta.requiredBindings ?? [])
  const channels: ChannelArtifact[] = []
  for (const ch of OUTPUT_ORDER) {
    const list = dedupe(refs.get(ch) ?? [])
    if (list.length === 0) continue
    const texts: string[] = []
    const requests: ChannelArtifact['requests'] = []
    const corrections: string[] = []
    let mode: string | null = null
    let communication: ChannelArtifact['communication'] = null
    for (const ref of list) {
      const block: Block | undefined = pkg.blocks[ref.block]
      if (!block) throw new PackageError(`${pkg.meta.stepId}: ${state} names missing block ${ref.block}`)
      const bound = bindText(block.text, bindings, required)
      if ('missing' in bound) {
        hold.missingBindings.push(...bound.missing)
        continue
      }
      if (/\{\{|\[omit /.test(bound.text)) {
        hold.invalid.push(ref.block)
        continue
      }
      if (block.meta.format === 'json' || block.meta.format === 'json-template') {
        try {
          JSON.parse(bound.text)
        } catch {
          hold.invalid.push(ref.block)
          continue
        }
      }
      if (typeof block.meta.endpoint === 'string') {
        const ep = bindEndpoint(block.meta.endpoint, bindings)
        if ('missing' in ep) {
          hold.missingBindings.push(...ep.missing)
          continue
        }
        requests.push({ method: String(block.meta.method ?? ''), endpoint: ep.endpoint })
      }
      if (ref.mode) {
        if (mode !== null && mode !== ref.mode) hold.invalid.push(ref.block)
        mode = ref.mode
      }
      for (const c of ref.corrections ?? []) if (!corrections.includes(c)) corrections.push(c)
      if (ch === 'email') {
        communication = { audience: String(block.meta.audience ?? ''), trigger: String(block.meta.communicationTrigger ?? ''), purpose: String(block.meta.purpose ?? '') }
      }
      texts.push(bound.text)
    }
    channels.push({ channel: ch, blocks: list.map((r) => r.block), format: String(pkg.blocks[list[0].block].meta.format ?? 'markdown'), text: texts.join('\n\n'), requests, mode, corrections, communication })
  }
  if (hold.missingBindings.length > 0 || hold.invalid.length > 0) {
    return { state, hold: { ...hold, missingBindings: [...new Set(hold.missingBindings)] }, channels: [] }
  }
  return { state, hold: null, channels }
}

/** The package's verified sources a person may be shown (guide §29). */
const userFacing = (pkg: CompiledPackage): VerifiedSource[] => (pkg.meta.verifiedSources ?? []).filter((s) => s.userFacing === true)

const sourceById = (pkg: CompiledPackage, id: string): VerifiedSource | null => userFacing(pkg).find((s) => s.id === id) ?? null

/**
 * The date the package's user-facing Microsoft sources were last checked
 * (`verifiedSources[].checkedOn`, YYYY-MM-DD): the latest one, deterministically.
 * Never the build, the deploy, the browser or a file's time.
 */
export function sourceUpdatedOn(pkg: CompiledPackage): string | null {
  const dates = userFacing(pkg)
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

const supportModel = (pkg: CompiledPackage, channel: 'readiness' | 'troubleshooting'): Record<string, unknown> | null => {
  const id = pkg.meta.supportBlocks?.[channel]?.[0]
  const block = id ? pkg.blocks[id] : undefined
  return block ? (JSON.parse(block.text) as Record<string, unknown>) : null
}

/** The package's authored troubleshooting scenarios for this state, with their user-facing sources; none where it authors none. */
export function troubleshootingFor(pkg: CompiledPackage, state: PackageState): TroubleshootingScenario[] {
  const model = supportModel(pkg, 'troubleshooting')
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

export type PackageReadinessTile = { id: string; gate: string; result: string; line: string }

export type PackageReadiness = {
  tiles: PackageReadinessTile[]
  /** The package's conclusion for this state's next transition, where it authors one. */
  conclusion: string | null
  whyItMatters: string | null
  unknowns: string[]
  references: VerifiedSource[]
}

/**
 * Readiness gates whose rules are scoped by lifecycle state and by a record of
 * human checks, which the package states in prose. They are read here, once,
 * for the one active package, and never as a positive rule: IAMAI keeps no
 * record that the human pre-enforcement checks were completed, so the Ready
 * rule can never be selected, and before enforcement the gate still asks for
 * those checks.
 */
const STATE_SCOPED_RESULT: Record<string, (state: PackageState) => string | null> = {
  'readiness.enforcement-settings': (s) => (s === 'missing' || s === 'partial' || s === 'reportOnly' || s === 'readyToEnforce' ? 'Review required' : null),
}

/** The conclusion key a state's next transition reads (the package's `conclusions`). */
const CONCLUSION_FOR: Partial<Record<PackageState, string>> = {
  missing: 'safeToCreateOrCorrect',
  partial: 'safeToCreateOrCorrect',
  reportOnly: 'safeToObserve',
  readyToEnforce: 'safeToEnforce',
}

/**
 * The package's readiness gates evaluated against what IAMAI actually holds.
 *
 * A gate with a `requiredInput` is Ready only when that value is bound and
 * non-empty — the canonical exclusion set resolved, not merely no problem
 * recorded — and Blocked when it is not. A gate with an `optionalInput` IAMAI
 * does not have is Unknown. A baseline requirement with one rule is that rule.
 * A gate this cannot evaluate from structured data is left out rather than
 * guessed.
 */
export function packageReadiness(pkg: CompiledPackage, state: PackageState, bindings: Bindings): PackageReadiness | null {
  const model = supportModel(pkg, 'readiness')
  if (!model) return null
  const tiles: PackageReadinessTile[] = []
  for (const t of (model.tiles ?? []) as Record<string, unknown>[]) {
    const rules = (t.rules ?? []) as { result: string; line: string }[]
    const byResult = (r: string | null): { result: string; line: string } | null => (r === null ? null : (rules.find((x) => x.result === r) ?? null))
    let rule: { result: string; line: string } | null = null
    if (typeof t.requiredInput === 'string') rule = byResult(present(bindings[t.requiredInput]) ? 'Ready' : 'Blocked')
    else if (typeof t.optionalInput === 'string') rule = present(bindings[t.optionalInput]) ? null : byResult('Unknown')
    else if (t.sourceType === 'baseline-requirement' && rules.length === 1) rule = rules[0]
    else if (typeof t.id === 'string' && STATE_SCOPED_RESULT[t.id]) rule = byResult(STATE_SCOPED_RESULT[t.id](state))
    if (rule) tiles.push({ id: String(t.id), gate: String(t.gate), result: rule.result, line: rule.line })
  }
  const conclusions = (model.conclusions ?? {}) as Record<string, string>
  const key = CONCLUSION_FOR[state]
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
