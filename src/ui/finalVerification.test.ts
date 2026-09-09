// The final guards of the visual-restoration program (task 041).
//
// Packs 030-040 each proved their own surface, and those tests stay where they
// are: this file adds only what NO earlier file could assert, because each of
// them could only see its own pack.
//
// Three things, and nothing that another file already owns:
//
//   1. The generated-preview sweep is over the WHOLE shipped tree rather than a
//      hand-written list of surfaces. src/ui/convergence.test.ts checks the
//      three surfaces task 040 touched, src/home.test.ts checks the public
//      page, src/ui/primitives.test.ts checks the shared layer — and a surface
//      added tomorrow is in none of those lists. Walking the tree means a new
//      file is covered on the day it is written.
//   2. The two authority records agree with each other about what landed. The
//      design manifest and the brand manifest each state the restoration state
//      separately, and until task 041 they had drifted apart from the
//      repository and from one another.
//   3. This task's report exists and names its evidence, the way
//      src/ui/foundation.test.ts holds task 030 to its own report.
//
// What this file deliberately does NOT do is assert conformance. A test cannot
// see a layout. Conformance is the two-sided anatomy tests reading the canonical
// bytes at test time, plus the rendered comparison a person looks at; this file
// only stops the records lying about which of those has been done.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string): string => readFileSync(p, 'utf8')
const REPORT = 'docs/design/reports/041-final-approved-design-brand-verification.md'

const DESIGN = JSON.parse(read('docs/design/approved/manifest.json')) as {
  restorationVerifiedBy: string
  restorationReport: string
  surfaces: { surface: string; implementationState: string; restorationPack: string; productionAssumedConformant: boolean }[]
}
const BRAND = JSON.parse(read('docs/brand/brand-manifest.json')) as {
  brand: { tagline: string | null; forbiddenTaglines: string[] }
  production: Record<string, boolean | string>
}

/** Every text file a person's browser is served, or that generates one. */
function shipped(): string[] {
  const TEXT = /\.(html|css|ts|tsx|mjs|json)$/
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry).replace(/\\/g, '/')
      if (statSync(full).isDirectory()) walk(full, out)
      else if (TEXT.test(entry)) out.push(full)
    }
    return out
  }
  return [...walk('src'), ...walk('home'), 'docs/design/content.json', 'index.html', 'scripts/build-home.ts']
}

// ------------------------------------------- 1. nothing generated is anywhere

test('no generated branding line reached anything the product ships, anywhere in the tree', () => {
  // The forbidden lines are read out of the brand manifest rather than listed
  // again here, so the brand authority stays the one place they are named
  // (docs/brand/brand-manifest.json `brand.forbiddenTaglines`), plus the
  // founder attribution the generated application previews carried.
  const FORBIDDEN = [...BRAND.brand.forbiddenTaglines, 'Built by Jon Hope']
  assert.ok(FORBIDDEN.length > 3, 'the forbidden list must come from the brand manifest, not from nothing')
  assert.equal(BRAND.brand.tagline, null, 'the brand has no tagline')

  // A test file is allowed to name a forbidden line — that is how it forbids
  // it. Everything else is product source.
  const files = shipped().filter((f) => !/\.test\.ts$/.test(f))
  assert.ok(files.length > 100, `only ${files.length} files walked — the walk is broken, not the tree`)

  for (const file of files) {
    const text = read(file)
    for (const line of FORBIDDEN) {
      assert.ok(!text.includes(line), `${file} carries the generated line "${line}"`)
    }
  }
})

test('Jon Hope is named as the baseline author and never as the product author', () => {
  // The distinction the generated previews blurred. "Jon Hope" is a true fact
  // about whose Conditional Access baseline IAMAI reads, and How credits it;
  // "Built by Jon Hope" is a claim about who built this product, which the
  // previews invented. The first is required, the second is forbidden above.
  const how = read('src/ui/surfaces/How.tsx')
  assert.match(how, /CA_POLICY_ANALYZER/, 'How credits the baseline author’s own project')
  for (const file of shipped().filter((f) => !/\.test\.ts$/.test(f))) {
    const text = read(file)
    for (const claim of ['Built by Jon Hope', 'Created by Jon Hope', 'Made by Jon Hope']) {
      assert.ok(!text.includes(claim), `${file} claims Jon Hope built the product`)
    }
  }
})

// ------------------------------------ 2. the two authority records agree

test('the design manifest and the brand manifest tell the same story about what landed', () => {
  // Until task 041 they did not. The design manifest said every surface was
  // `restoration-pending` and the brand manifest said `pageCompositionRestored:
  // false`, months after packs 032-038 restored all four — two authority files
  // stating something false about their own repository, with two tests pinning
  // the falsehood in place.
  assert.equal(BRAND.production.pageCompositionRestored, true)
  const packs = DESIGN.surfaces.map((s) => s.restorationPack)
  assert.deepEqual([...packs].sort(), ['032', '033-036', '037', '038'])

  for (const s of DESIGN.surfaces) {
    assert.equal(s.implementationState, 'restored', `${s.surface} is not recorded as restored`)
    // And the record stays honest about what "restored" is not: a certificate.
    assert.equal(s.productionAssumedConformant, false, `${s.surface}: conformance is evidenced, never assumed`)
  }

  // The brand manifest's range has to contain every pack the design manifest
  // names, so the two cannot drift apart again without one of them failing.
  const [from, to] = String(BRAND.production.pageCompositionRestoredBy).split('-').map(Number)
  for (const pack of packs) {
    for (const n of pack.split('-').map(Number)) {
      assert.ok(n >= from && n <= to, `the brand manifest's ${from}-${to} does not contain design pack ${n}`)
    }
  }
})

test('neither machine authority still describes the restoration packs as work to come', () => {
  // The flags agreeing is not enough on its own. Task 041 set
  // `pageCompositionRestored: true` while the brand manifest's own
  // `typography.appliedNote` still read "What typography does NOT yet do is
  // compose a page ... when its restoration pack (031-038) lands" — one file
  // answering the same question twice, in two tenses, with the prose half
  // telling a later engineer the program is outstanding. A machine authority
  // that says a landed pack is future work is the exact defect this task was
  // opened to close, so the prose in these two files is held to their flags.
  const strings = (v: unknown, out: string[] = []): string[] => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) for (const x of v) strings(x, out)
    else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out)
    return out
  }

  // Present-tense or future-tense claims that page composition, the display
  // ramp or a restoration pack is still to come. Past-tense history is what
  // these notes are FOR and is deliberately not matched: "packs 031-040 did
  // that" and "expressed the display ramp only once its own pack restored it"
  // both describe what happened and both pass.
  const PENDING = [
    /\bdoes not yet\b/i,
    /\b(is|are|has|have) not yet\b/i,
    /\bnot yet (applied|restored|composed|landed|expressed)\b/i,
    /\bwhen (its|their|the) restoration pack\b/i,
    /restoration pack[^.]*\b(lands|will)\b/i,
    /\b(page composition|display ramp)[^.]*\b(pending|outstanding|still to|remains? to)\b/i,
  ]

  assert.equal(BRAND.production.pageCompositionRestored, true, 'this guard reads the flag it holds the prose to')
  for (const file of ['docs/brand/brand-manifest.json', 'docs/design/approved/manifest.json']) {
    const all = strings(JSON.parse(read(file)))
    assert.ok(all.length > 30, `only ${all.length} strings walked in ${file} — the walk is broken, not the file`)
    for (const value of all) {
      for (const pattern of PENDING) {
        assert.ok(!pattern.test(value), `${file} still calls restoration future work (${pattern}): ${value.slice(0, 160)}`)
      }
    }
  }
})

// ---------------------------------------------- 3. the report is the artifact

test('the final verification report exists and names its authority and its evidence', () => {
  assert.equal(DESIGN.restorationVerifiedBy, '041-final-approved-design-brand-verification')
  assert.equal(DESIGN.restorationReport, REPORT)
  assert.ok(existsSync(REPORT), `${REPORT} is this task's artifact and is not optional`)
  const text = read(REPORT)

  // The four hashes, so the report cannot claim conformance against bytes it
  // never read.
  for (const surface of DESIGN.surfaces) {
    const sha = (JSON.parse(read('docs/design/approved/manifest.json')) as { surfaces: { surface: string; sha256: string }[] }).surfaces.find(
      (s) => s.surface === surface.surface,
    )!.sha256
    assert.ok(text.includes(sha), `the report does not carry ${surface.surface}'s canonical hash`)
  }

  // The rendered evidence it rests on, and every surface it claims to cover.
  for (const needed of [
    'docs/design/approved/rendered',
    'docs/screens/041',
    'scripts/render-design.mjs',
    'scripts/responsive-probe.mjs',
    'Home',
    'Connect',
    'Plan',
    'MFA Readiness',
    'Export',
    'How',
    'Inventory',
  ]) {
    assert.ok(text.includes(needed), `the report does not name ${needed}`)
  }

  // And it must not overclaim. The task contract forbids calling the product
  // audited beyond the scope actually performed, and forbids claiming the
  // owner approved this task's own result — "owner-approved" describing the
  // four HTML packs is a true statement and is deliberately not on this list.
  for (const overclaim of ['fully audited', 'WCAG certified', 'WCAG compliant', 'the owner approved this', 'is perfect']) {
    assert.ok(!text.toLowerCase().includes(overclaim.toLowerCase()), `the report overclaims: "${overclaim}"`)
  }
})
