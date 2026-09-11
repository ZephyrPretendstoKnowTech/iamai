// The implementation-content block protocol: one parser and one validator for
// the compact source packages under docs/implementation-content/ (authoring
// guide v2.5 §4.2, §6 and §26.9). The compiler
// (scripts/compile-implementation-content.mjs) lints packages and emits the
// runtime registry through it, and the runtime projection (project.ts) reads
// what it produced, so the two cannot disagree about what a block is.
//
// Pure: no DOM, no network, no file system.

export type BlockMeta = { id: string; channel: string; states?: string[]; format?: string; kind?: string } & Record<string, unknown>
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

export type PackageMeta = {
  stepId: string
  title?: string
  contentFile?: string
  requiredBindings?: string[]
  optionalBindings?: string[]
  projection: Record<string, Record<string, unknown>>
  supportBlocks?: Record<string, string[]>
  verifiedSources?: VerifiedSource[]
} & Record<string, unknown>

export type CompiledPackage = { meta: PackageMeta; blocks: Record<string, Block> }

/** One entry of a projection list: a block id, or a block run in a mode (`powershell.run` in `Enforce`). */
export type ProjectionRef = { block: string; mode?: string; corrections?: string[] }

export class PackageError extends Error {}

/** The channels a block may belong to (guide §4.2). A block in any other channel fails the package. */
export const BLOCK_CHANNELS = ['entra', 'json', 'powershell', 'aiInfo', 'email', 'readiness', 'troubleshooting'] as const

/** The user-facing output channels a state projection may name (guide §6). */
export const PROJECTION_CHANNELS = ['entra', 'json', 'powershell', 'aiInfo', 'email'] as const

/** Every key a state projection may carry: its channels, and the composition keys of a Partial projection. */
const PROJECTION_KEYS = new Set<string>(['requires', 'mode', 'sharedBefore', 'mismatches', 'sharedAfter', ...PROJECTION_CHANNELS])

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

/** A projection list, normalised: plain ids and `{ block, mode, corrections }` entries alike. */
export function refsOf(value: unknown): ProjectionRef[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((v): ProjectionRef[] => {
    if (typeof v === 'string') return [{ block: v }]
    if (v && typeof v === 'object' && typeof (v as { block?: unknown }).block === 'string') {
      const r = v as { block: string; mode?: unknown; corrections?: unknown }
      return [{ block: r.block, ...(typeof r.mode === 'string' ? { mode: r.mode } : {}), ...(Array.isArray(r.corrections) ? { corrections: r.corrections.map(String) } : {}) }]
    }
    return []
  })
}

/** Every (channel, reference) a state projection names, wherever in the projection it names it. */
function projectionRefs(p: Record<string, unknown>): { channel: string; ref: ProjectionRef }[] {
  const out: { channel: string; ref: ProjectionRef }[] = []
  const take = (holder: unknown): void => {
    if (!holder || typeof holder !== 'object') return
    for (const ch of PROJECTION_CHANNELS) for (const ref of refsOf((holder as Record<string, unknown>)[ch])) out.push({ channel: ch, ref })
  }
  take(p)
  take(p.sharedBefore)
  take(p.sharedAfter)
  const mismatches = p.mismatches
  if (mismatches && typeof mismatches === 'object') for (const m of Object.values(mismatches)) take(m)
  return out
}

/**
 * Everything wrong with a package, as sentences; empty when it is sound. The
 * checks are the guide's mechanical ones (§26.9) plus the ones a renderer needs
 * before it may trust a projection: every referenced block exists, belongs to
 * the channel it is projected into and declares the state it is projected in,
 * and no block sits in a channel the viewer does not have.
 */
export function validatePackage(pkg: CompiledPackage): string[] {
  const errors: string[] = []
  const { meta, blocks } = pkg
  const declared = new Set([...(meta.requiredBindings ?? []), ...(meta.optionalBindings ?? [])])
  for (const [id, b] of Object.entries(blocks)) {
    if (!(BLOCK_CHANNELS as readonly string[]).includes(b.meta.channel)) errors.push(`${id}: unsupported channel ${b.meta.channel}`)
    for (const used of bindingsUsed(b.text)) if (!declared.has(used)) errors.push(`${id}: undeclared binding ${used}`)
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
  for (const [state, p] of Object.entries(meta.projection ?? {})) {
    for (const key of Object.keys(p)) if (!PROJECTION_KEYS.has(key)) errors.push(`projection.${state}: unsupported key ${key}`)
    for (const { channel, ref } of projectionRefs(p)) {
      const b = blocks[ref.block]
      if (!b) {
        errors.push(`projection.${state}.${channel}: missing block ${ref.block}`)
        continue
      }
      if (b.meta.channel !== channel) errors.push(`projection.${state}.${channel}: ${ref.block} is a ${b.meta.channel} block`)
      if (!(b.meta.states ?? []).includes(state)) errors.push(`projection.${state}.${channel}: ${ref.block} does not declare state ${state}`)
    }
  }
  for (const [channel, ids] of Object.entries(meta.supportBlocks ?? {})) {
    for (const id of ids) {
      const b = blocks[id]
      if (!b) errors.push(`supportBlocks.${channel}: missing block ${id}`)
      else if (b.meta.channel !== channel) errors.push(`supportBlocks.${channel}: ${id} is a ${b.meta.channel} block`)
    }
  }
  return errors
}

/** A package from its META.json and CONTENT.md text, validated; a package with any error is refused whole. */
export function compilePackage(metaJson: string, contentMd: string): CompiledPackage {
  let meta: PackageMeta
  try {
    meta = JSON.parse(metaJson) as PackageMeta
  } catch (e) {
    throw new PackageError(`META.json does not parse: ${(e as Error).message}`)
  }
  const pkg: CompiledPackage = { meta, blocks: parseBlocks(contentMd) }
  const errors = validatePackage(pkg)
  if (errors.length > 0) throw new PackageError(`${meta.stepId ?? 'package'}:\n${errors.join('\n')}`)
  return pkg
}
