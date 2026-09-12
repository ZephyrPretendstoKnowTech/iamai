// The implementation-content library on disk, as the registry holds it. Node only:
// the compiler (scripts/compile-implementation-content.mjs --registry) writes the
// registry through it and the tests compare the registry with it; the product
// imports only the registry.
//
// A package is registered when it describes a step the Plan draws as a content
// step (docs/design/content.json `steps`, reached as stepTitle.ts
// contentStepForPackage reaches it), whatever else it describes. Every part of it
// the runtime cannot project safely is withheld (protocol.ts withholdInvalid); the
// package files are never edited.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contentStepForPackage } from '../stepTitle.ts'
import { compileLibraryPackage } from './protocol.ts'
import type { CompiledPackage } from './protocol.ts'
import { driftOf } from './drift.ts'
import type { Drift } from './drift.ts'
import { PINNED } from '../../baseline/pinned.ts'
import { provenanceOf } from './provenance.ts'
import type { Provenance } from './provenance.ts'

export const LIBRARY_ROOT = 'docs/implementation-content'

/**
 * `drift`: the package reviewed against the pin this build carries, member by
 * member (drift.ts). `source`: the package as authored, normalised, before
 * anything is withheld; `errors`: what strict validation refuses in it.
 */
export type LibraryPackage = { dir: string; stepId: string; pkg: CompiledPackage; withheld: string[]; drift: Drift; source: CompiledPackage; errors: string[] }

/** Every package folder under the root (a folder holding META.json), in path order; a package may sit one folder deeper than its name. */
export function packageDirs(root: string = LIBRARY_ROOT): string[] {
  const out: string[] = []
  const walk = (dir: string, depth: number): void => {
    if (existsSync(join(dir, 'META.json'))) {
      out.push(dir)
      return
    }
    if (depth >= 3) return
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) if (e.isDirectory()) walk(join(dir, e.name), depth + 1)
  }
  walk(root, 0)
  return out
}

/** The library compiled: the packages the Plan registers, by step id, and the ones that describe no content step. */
export function compileLibrary(root: string = LIBRARY_ROOT): { registered: LibraryPackage[]; notSteps: LibraryPackage[] } {
  const registered: LibraryPackage[] = []
  const notSteps: LibraryPackage[] = []
  for (const dir of packageDirs(root)) {
    const metaJson = readFileSync(join(dir, 'META.json'), 'utf8')
    const contentFile = (JSON.parse(metaJson) as { contentFile?: string }).contentFile ?? 'CONTENT.md'
    const { pkg, withheld, source, errors } = compileLibraryPackage(metaJson, readFileSync(join(dir, contentFile), 'utf8'))
    const content = contentStepForPackage(pkg.meta.stepId)
    // The members its step implements are the pinned policies its content step's goals map to.
    const authority = pkg.meta.baselineAuthority
    const goals = content ? [content.id, ...((content as { mergesGoals?: string[] }).mergesGoals ?? [])] : []
    const drift = driftOf(authority?.reviewedMembers as Record<string, string> | undefined, typeof authority?.pinCommit === 'string' ? authority.pinCommit : null, goals, PINNED, (authority?.reviewedIdentities as Record<string, string> | undefined) ?? {})
    const entry = { dir: dir.replaceAll('\\', '/'), stepId: pkg.meta.stepId, pkg, withheld, drift, source, errors }
    if (!content) {
      notSteps.push(entry)
      continue
    }
    const twin = registered.find((r) => contentStepForPackage(r.stepId)?.id === content.id)
    if (twin) throw new Error(`two packages for content step ${content.id}: ${twin.stepId}, ${entry.stepId}`)
    registered.push(entry)
  }
  const byId = (a: LibraryPackage, b: LibraryPackage): number => a.stepId.localeCompare(b.stepId)
  return { registered: registered.sort(byId), notSteps: notSteps.sort(byId) }
}

/**
 * The META fields the product reads (protocol.ts, project.ts, stepPackage.ts,
 * provenance.ts). The rest — the author's validation notes, source research,
 * batches, caveats — is authoring evidence that stays in docs/implementation-content:
 * shipped, it was 40 fields of bundle nobody read, and one of them carried a host
 * the network allowlist refuses (correction batch 2).
 */
export const RUNTIME_META_KEYS = ['stepId', 'title', 'relationship', 'contentFile', 'requiredBindings', 'optionalBindings', 'projection', 'supportBlocks', 'verifiedSources', 'prerequisites', 'baselineAuthority', 'email'] as const

const runtimeMeta = (pkg: CompiledPackage): CompiledPackage => ({
  meta: Object.fromEntries(RUNTIME_META_KEYS.filter((k) => pkg.meta[k] !== undefined).map((k) => [k, pkg.meta[k]])) as CompiledPackage['meta'],
  blocks: pkg.blocks,
})

/** The registry file's content for the library. */
export function registryOf(library: { registered: LibraryPackage[] }): { $comment: string; packages: Record<string, CompiledPackage>; reviews: Record<string, Drift>; provenance: Record<string, Provenance | null> } {
  return {
    $comment: 'GENERATED by scripts/compile-implementation-content.mjs --registry from docs/implementation-content/. Do not edit by hand: src/content/implementation/library.test.ts fails when this file and its sources disagree.',
    packages: Object.fromEntries(library.registered.map((r) => [r.stepId, runtimeMeta(r.pkg)])),
    reviews: Object.fromEntries(library.registered.map((r) => [r.stepId, r.drift])),
    provenance: Object.fromEntries(library.registered.map((r) => [r.stepId, provenanceOf(r.stepId, relationshipOf(r.pkg))])),
  }
}

const relationshipOf = (pkg: CompiledPackage): string | undefined => (typeof pkg.meta.relationship === 'string' ? pkg.meta.relationship : undefined)

/** The channels LIBRARY.json reports a package authoring content for. */
const INDEX_CHANNELS = ['entra', 'json', 'powershell', 'aiInfo', 'email', 'readiness', 'troubleshooting'] as const

const PENDING_DEFINITION = 'PENDING-HOLISTIC-INTEGRATION-REVIEW'

type IndexEntry = Record<string, unknown>
export type LibraryIndex = Record<string, unknown> & { packages: IndexEntry[]; bindings: IndexEntry[]; aggregate: IndexEntry; coverage?: IndexEntry }

const countBy = (values: readonly string[]): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const v of [...values].sort()) out[v] = (out[v] ?? 0) + 1
  return out
}

/**
 * LIBRARY.json with every fact the packages already state regenerated from them
 * (correction batch 2): block and binding counts, the outputs and states each
 * authors, the binding inventory, what strict validation refuses, the provenance
 * and the re-pin review. What only the author can say — definitions, issues,
 * primitives, caveats — is kept as written. Two books kept by hand drifted apart;
 * `library.test.ts` now fails when this one does.
 */
export function libraryIndexOf(library: { registered: LibraryPackage[]; notSteps: LibraryPackage[] }, current: LibraryIndex): LibraryIndex {
  const all = [...library.registered, ...library.notSteps]
  const byId = new Map(all.map((p) => [p.stepId, p]))
  const packages = current.packages.map((entry) => {
    const p = byId.get(String(entry.stepId))
    if (!p) return entry
    const { meta, blocks } = p.source
    const partial = meta.projection.partial as { mismatches?: Record<string, unknown> } | undefined
    return {
      ...entry,
      contentBlocks: Object.keys(blocks).length,
      outputs: Object.fromEntries(INDEX_CHANNELS.map((c) => [c, Object.values(blocks).some((b) => b.meta.channel === c)])),
      statesSupported: Object.keys(meta.projection),
      correctionModules: Object.keys(partial?.mismatches ?? {}).length,
      requiredBindings: (meta.requiredBindings ?? []).length,
      optionalBindings: (meta.optionalBindings ?? []).length,
      validationResult: p.errors.length === 0 ? 'pass' : 'parts-withheld',
      strictValidationErrors: p.errors.length,
      registered: library.registered.includes(p),
      provenance: provenanceOf(p.stepId, relationshipOf(p.source)),
      review: p.drift.status,
    }
  })
  const declared = new Map<string, { requiredBy: string[]; optionalBy: string[] }>()
  const slot = (b: string): { requiredBy: string[]; optionalBy: string[] } => {
    let s = declared.get(b)
    if (!s) declared.set(b, (s = { requiredBy: [], optionalBy: [] }))
    return s
  }
  for (const p of all) {
    for (const b of p.source.meta.requiredBindings ?? []) slot(b).requiredBy.push(p.stepId)
    for (const b of p.source.meta.optionalBindings ?? []) slot(b).optionalBy.push(p.stepId)
  }
  const prior = new Map(current.bindings.map((b) => [String(b.binding), b]))
  const bindings = [...declared.keys()].sort().map((binding): IndexEntry => {
    const d = declared.get(binding)!
    const facts = { requiredBy: [...d.requiredBy].sort(), optionalBy: [...d.optionalBy].sort(), packages: [...new Set([...d.requiredBy, ...d.optionalBy])].sort() }
    const was = prior.get(binding)
    return was ? { ...was, ...facts } : { binding, ...facts, knownIAMAIInput: null, definitionStatus: PENDING_DEFINITION }
  })
  const aggregate: IndexEntry = {
    ...current.aggregate,
    packageCount: all.length,
    contentBlocks: all.reduce((n, p) => n + Object.keys(p.source.blocks).length, 0),
    uniqueBindings: bindings.length,
    bindingsRequiredByAtLeastOneProjection: bindings.filter((b) => (b.requiredBy as string[]).length > 0).length,
    bindingsOptionalInAtLeastOnePackage: bindings.filter((b) => (b.optionalBy as string[]).length > 0).length,
    bindingDefinitionsCarriedForward: bindings.filter((b) => b.definitionStatus === 'CARRIED-FORWARD').length,
    bindingDefinitionsPendingHolisticReview: bindings.filter((b) => b.definitionStatus === PENDING_DEFINITION).length,
    knownIAMAIInputTrue: bindings.filter((b) => b.knownIAMAIInput === true).length,
    knownIAMAIInputFalse: bindings.filter((b) => b.knownIAMAIInput === false).length,
    knownIAMAIInputUnreviewed: bindings.filter((b) => typeof b.knownIAMAIInput !== 'boolean').length,
    packagesPassingStrictValidation: all.filter((p) => p.errors.length === 0).length,
    packagesWithWithheldParts: all.filter((p) => p.errors.length > 0).length,
    provenance: countBy(packages.map((e) => String(e.provenance))),
    review: countBy(all.map((p) => p.drift.status)),
  }
  return {
    ...current,
    ...(current.coverage ? { coverage: { ...current.coverage, packageCount: all.length } } : {}),
    derivedBy: 'scripts/compile-implementation-content.mjs --library-index regenerates every count, output, state, binding inventory, validationResult, provenance and review here from the packages; library.test.ts fails when they drift. Definitions, issues, primitives and caveats are the author’s.',
    packages,
    bindings,
    aggregate,
  }
}
