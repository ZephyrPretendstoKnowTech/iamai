// Cycle 3 (C02, RUN-CONTEXT): no correction moves an enabled policy to report-only.
//
// Cycle 2 removed the staging mode from ten packages. Eleven more still carried a
// correction module selected whenever the policy was On ("lifecycle.report-only"):
// beside every correction it drew "Set Enable policy to Report-only while correcting",
// a `{"state":"enabledForReportingButNotEnforced"}` PATCH and a ReportOnly script run,
// so fixing an exclusion took enforcement off. No curated fixture renders those
// corrections, so the matrix never showed it. This reads every registered package's
// Partial projection rather than a rendered sample.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { parseBlocks } from './protocol.ts'
import { packageDirs, packageSources } from './library.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

/**
 * Packages that still return an enabled policy to report-only on a correction, each with the
 * reason it is not changed. None remains: workload-identity-block, the last one (its Correct
 * mode threw unless ReportOnly rode with a material correction), was corrected in cycle 3.
 * A package added here must name its reason, and the test fails once it no longer stages.
 */
const STILL_STAGING: Record<string, string> = {}

type Ref = string | { block: string; mode?: string; corrections?: string[] }
const refsOf = (v: unknown): Ref[] => (v === undefined ? [] : Array.isArray(v) ? (v as Ref[]) : [v as Ref])

/** Everything the Partial projection can draw, with the module it comes from. */
function partialRefs(pkg: CompiledPackage): { module: string; channel: string; ref: Ref }[] {
  const partial = (pkg.meta.projection as Record<string, unknown> | undefined)?.partial as Record<string, unknown> | undefined
  if (!partial) return []
  const out: { module: string; channel: string; ref: Ref }[] = []
  const take = (module: string, m: Record<string, unknown>) => {
    for (const channel of ['entra', 'json', 'powershell', 'aiInfo']) for (const ref of refsOf(m[channel])) out.push({ module, channel, ref })
  }
  for (const shared of ['sharedBefore', 'sharedAfter']) {
    const s = partial[shared]
    if (Array.isArray(s)) for (const ref of s as Ref[]) out.push({ module: shared, channel: 'entra', ref })
    else if (s && typeof s === 'object') take(shared, s as Record<string, unknown>)
  }
  if (partial.mismatches && typeof partial.mismatches === 'object') for (const [id, m] of Object.entries(partial.mismatches as Record<string, Record<string, unknown>>)) take(id, m)
  if (Array.isArray(partial.modules)) for (const m of partial.modules as Record<string, unknown>[]) take(String(m.id), m)
  take('partial', partial)
  return out
}

const REPORT_ONLY_BODY = /^\s*\{\s*"state"\s*:\s*"enabledForReportingButNotEnforced"\s*\}\s*$/
const REPORT_ONLY_PROSE = /\b(set|return|move|switch|keep|stage)\b[^.]{0,80}\*{0,2}Report-only\*{0,2}[^.]{0,40}\b(while|first|before (chang|apply|correct|access-affecting))|canonical Report-only target/i
/**
 * A sentence that moves or keeps a policy in report-only as part of correcting it. A recovery
 * step for when something goes wrong ("If a correction creates unexpected risk, return … to
 * Report-only") is not a correction default and is left alone; "If it is On, return it to
 * Report-only first" is the default, and is not.
 */
const stagesInProse = (text: string): boolean =>
  text.split(/(?<=[.!?])\s+|\n+/).some((s) => !/^\s*(-\s*)?If\b(?![^,]*\bis (currently |still )?On\b)/.test(s) && REPORT_ONLY_PROSE.test(s))

function stagingIn(pkg: CompiledPackage): string[] {
  const found: string[] = []
  for (const { module, channel, ref } of partialRefs(pkg)) {
    const id = typeof ref === 'string' ? ref : ref.block
    const block = pkg.blocks[id]
    if (channel === 'powershell' && typeof ref !== 'string') {
      if (/^(ReportOnly|Stage)/.test(ref.mode ?? '') || (ref.corrections ?? []).includes('ReportOnly')) found.push(`${module}: runs ${ref.mode}${ref.corrections ? ` ${ref.corrections.join(',')}` : ''}`)
    }
    if (!block) continue
    if (channel === 'powershell' && /Refusing correction while policy is On/.test(block.text)) found.push(`${module}: ${id} refuses a correction while the policy is On`)
    if (channel === 'json' && REPORT_ONLY_BODY.test(block.text)) found.push(`${module}: ${id} PATCHes the state to report-only`)
    if ((channel === 'entra' || channel === 'aiInfo') && stagesInProse(block.text)) found.push(`${module}: ${id} tells the technician to move it to report-only`)
  }
  return found
}

test('no package, registered or as authored with the parts the registry withholds, corrects a policy by moving it to report-only, apart from any named with its reason', () => {
  // no registered package corrects a policy by moving it to report-only, apart from any named with its reason
  {
    const staging: Record<string, string[]> = {}
    for (const [id, pkg] of Object.entries(PACKAGES)) {
      const found = stagingIn(pkg)
      if (found.length > 0) staging[id] = found
    }
    assert.deepEqual(Object.keys(staging).sort(), Object.keys(STILL_STAGING).sort(), JSON.stringify(staging, null, 1))
  }
  // no authored package, the parts the registry withholds included, corrects a policy by moving it to report-only
  // Cycle 6: the registry is compiled with the parts the runtime cannot project withheld, so a
  // withheld Partial projection never reaches the scan above. s-goal-unmanaged-browser's was
  // one: its authored correction ran StageA/StageB, refused to correct an enabled policy and
  // said "Stage any enabled policy to Report-only". Nothing drew it, but the authored package
  // is the source a later compile would project, so every authored package is scanned too.
  {
    // Every authored package, a task a folder folds in included (library.ts
    // packageSources; Stage 3 folded the countries location into the countries
    // block's folder).
    const sources = packageDirs().flatMap(packageSources)
    // The floor moves down when a step retires and its package goes with it
    // (step-redundancy-analysis.md: eleven step identities, 2026-09-19). What the
    // number guards is that the sweep below reads the whole corpus, not a shard.
    assert.ok(sources.length >= 43, `${sources.length} authored packages`)
    const staging: Record<string, string[]> = {}
    for (const source of sources) {
      const meta = JSON.parse(source.metaJson) as { stepId: string }
      const authored = { meta, blocks: parseBlocks(source.content) } as unknown as CompiledPackage
      const found = stagingIn(authored)
      if (found.length > 0) staging[`${source.dir}:${meta.stepId}`] = found
    }
    assert.deepEqual(staging, {})
  }
})

test('the scan sees staging where it is, in a synthetic lifecycle module and in prose, and leaves a recovery step alone', () => {
  // the scan sees staging where it is: any named package, and a synthetic lifecycle module
  {
    for (const id of Object.keys(STILL_STAGING)) assert.ok(stagingIn(PACKAGES[id]).length > 0, `${id} no longer stages: remove it from STILL_STAGING`)
    const base = PACKAGES['s-goal-user-risk']
    const partial = (base.meta.projection as Record<string, Record<string, unknown>>).partial
    const synthetic = {
      ...base,
      meta: { ...base.meta, projection: { ...base.meta.projection, partial: { ...partial, mismatches: { ...(partial.mismatches as object), 'lifecycle.report-only': { select: { equals: ['policy.current.state', 'enabled'] }, alongside: true, entra: ['entra.correct.lifecycle'], json: ['json.correct.report-only'], powershell: [{ block: 'powershell.run', mode: 'ReportOnly' }] } } } } },
    } as unknown as CompiledPackage
    const found = stagingIn(synthetic)
    assert.ok(found.some((f) => /runs ReportOnly/.test(f)), JSON.stringify(found))
    assert.ok(found.some((f) => /PATCHes the state/.test(f)), JSON.stringify(found))
    assert.ok(found.some((f) => /tells the technician/.test(f)), JSON.stringify(found))
    assert.deepEqual(stagingIn(base), [], 'the unchanged package stages nothing')
  }
  // prose control: a recovery step is not a correction default, a report-only move while correcting is
  {
    assert.equal(stagesInProse('If a correction creates unexpected risk, return the same policy to Report-only before further changes.'), false)
    assert.equal(stagesInProse('If a required workflow fails, return the same stable policy to Report-only first.'), false)
    assert.equal(stagesInProse("Keep the policy's current state: if it is On, the correction applies to sign-ins as soon as you save."), false)
    assert.equal(stagesInProse('If it is On, return that same policy to Report-only first.'), true)
    assert.equal(stagesInProse('If the workload policy is currently On and the location range is wrong, return the workload policy to Report-only before changing the allowed address.'), true)
    assert.equal(stagesInProse('Keep or return a materially incorrect policy to **Report-only** while correcting it.'), true)
    assert.equal(stagesInProse('Set **Enable policy** to **Report-only** before applying semantic corrections.'), true)
    // Cycle 6: unmanaged-browser's wording, which the verb list missed (it also ran StageA/StageB).
    assert.equal(stagesInProse('Stage any enabled policy to Report-only before access-affecting correction.'), true)
    assert.equal(stagesInProse('GOAL\nMove the existing resolved policy to the canonical Report-only target without creating a duplicate.'), true)
  }
})
