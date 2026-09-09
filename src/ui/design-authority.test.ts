// The design-authority guard (task 028; canonical paths corrected by task 030).
//
// IAMAI's four owner-approved HTML design packs were named as authority by
// tasks 011, 012 and 016 and were never actually in the repository, so each of
// those tasks fell back to a prose paraphrase and the older mockups that were
// on disk became the operative reference. The whole class of failure was
// "the authority is whatever file happens to be present".
//
// This test makes that impossible to repeat quietly. The bytes are the
// authority, so it hashes them; the manifest is the machine copy, so it holds
// the manifest to the bytes and to one current record per surface.
//
// It hashes RAW bytes on purpose. src/fingerprint.ts normalises line endings
// because it answers "did the source change" the way git does; this test
// answers "are these the exact approved bytes", and a normalised copy is not
// those bytes. .gitattributes marks docs/design/approved/*.html as `-text` so
// git never rewrites them and the hash is stable on every platform.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

const DIR = 'docs/design/approved'
const MANIFEST = `${DIR}/manifest.json`

/**
 * The long upload names task 028 committed the packs under. Task 030 made the
 * short names canonical and deleted these, because two byte-identical files
 * for one surface is two current authorities and a later reader has to guess
 * which one moved. Nothing may bring them back.
 */
const SUPERSEDED_COPIES = [
  'iamai-home-design-pack-v2.html',
  'iamai-connect-design-pack-v3.html',
  'iamai-plan-step-design-pack.html',
  'iamai-mfa-readiness-design-pack-v2.html',
] as const

/**
 * The owner's decision, written out here rather than read from the manifest:
 * a guard that took its expectations from the file it guards would pass on any
 * self-consistent rewrite.
 */
const APPROVED = [
  {
    surface: 'home',
    file: 'home-v2.html',
    sourceName: 'iamai-home-design-pack-v2.html',
    sha256: '88b9a3a5907e78ad83f7c31dca00b86a2bdd741b9b4efca575254567d6e55a50',
  },
  {
    surface: 'connect',
    file: 'connect-v3.html',
    sourceName: 'iamai-connect-design-pack-v3.html',
    sha256: '903808b07210209a22d1a4f380b9e79dad95bd0e740a0fce0bb3745d265ee48b',
  },
  {
    // The owner's upload was named plan-step-design-pack(1).html. The (1) is
    // provenance, not identity: the canonical file drops it so no later task
    // has two "current" Plan packs to choose between.
    surface: 'plan',
    file: 'plan-step-v1.html',
    sourceName: 'plan-step-design-pack(1).html',
    sha256: '1f1bda574fc76d0cc48c7d2e7a5d26abe34d8ee0aa5fab4888282cd9955ad4ec',
  },
  {
    surface: 'mfa-readiness',
    file: 'mfa-readiness-v2.html',
    sourceName: 'iamai-mfa-readiness-design-pack-v2.html',
    sha256: '12d8bdfbd09f82de66b732037d74da8217a79fca5cd78f12ce673eecbfc76512',
  },
] as const

type Record = {
  surface: string
  path: string
  sha256: string
  ownerApprovedSourceName: string
  approvalState: string
  copyAuthority: boolean
  technicalTruthAuthority: boolean
  productionAssumedConformant: boolean
  implementationState: string
  restorationPack: string
}
type Manifest = {
  surfaces: Record[]
  precedence: { order: string[] }
  generatedPreviews: Record0
  brand: { applicationLayoutAuthority: boolean }
  renderedEvidence: { widths: number[]; mechanism: string; output: string }
  authority: { canonicalHtmlIsApplicationDesignAuthority: boolean; renderedReferenceIsDerivedOnly: boolean; generatedBrandApplicationPreviewsAreAuthoritative: boolean }
}
type Record0 = { [k: string]: unknown }

const manifest = (): Manifest => JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest

test('every approved design pack is present with the owner-approved bytes', () => {
  for (const { surface, file, sha256 } of APPROVED) {
    const path = `${DIR}/${file}`
    assert.ok(existsSync(path), `${path} is missing: ${surface} has no design authority`)
    const got = createHash('sha256').update(readFileSync(path)).digest('hex')
    assert.equal(
      got,
      sha256,
      `${path} is not the owner-approved file (expected ${sha256}, got ${got}). ` +
        'Restore the exact bytes; if only line endings differ, .gitattributes must keep docs/design/approved/*.html as -text.',
    )
  }
})

test('one file per surface: the upload-named copies are gone and cannot come back', () => {
  // Task 028 committed each pack under the owner's upload name; the canonical
  // short names arrived later, byte-identical. Two files with one hash is two
  // current authorities, and the manifest can only point at one of them.
  for (const file of SUPERSEDED_COPIES) {
    assert.ok(!existsSync(`${DIR}/${file}`), `${DIR}/${file} is a second copy of an authority that already has a canonical name`)
  }
  const html = readdirSync(DIR).filter((f) => f.endsWith('.html')).sort()
  assert.deepEqual(html, [...APPROVED.map((a) => a.file)].sort(), 'docs/design/approved holds exactly the four canonical packs')
})

test('no task edits an approved byte: the working tree is what the commit holds', () => {
  // The hashes above are the owner's values, so the test above already proves
  // the bytes. This proves the same thing against git rather than against a
  // constant, which is what catches a hash and its file edited together in one
  // change. A shallow CI checkout still has HEAD, and a source tarball with no
  // git at all skips rather than fails.
  let head: Buffer[] | null = null
  try {
    head = APPROVED.map(({ file }) => execFileSync('git', ['cat-file', '-p', `HEAD:${DIR}/${file}`], { maxBuffer: 8 * 1024 * 1024 }))
  } catch {
    return
  }
  APPROVED.forEach(({ file, sha256 }, i) => {
    const blob = head![i]
    assert.equal(createHash('sha256').update(blob).digest('hex'), sha256, `${file}: the committed authority is not the owner-approved file`)
    assert.deepEqual(readFileSync(`${DIR}/${file}`), blob, `${file}: the working tree differs from the committed authority`)
  })
})

test('the manifest says, as values, what is authority and what is derived', () => {
  const { authority } = manifest()
  assert.equal(authority.canonicalHtmlIsApplicationDesignAuthority, true)
  assert.equal(authority.renderedReferenceIsDerivedOnly, true)
  assert.equal(authority.generatedBrandApplicationPreviewsAreAuthoritative, false)
  // A render is derived from the HTML; it is never the input to it.
  const { mechanism, output } = manifest().renderedEvidence
  assert.match(mechanism, /^scripts\/[a-z-]+\.mjs$/)
  assert.match(output, /\.png$/, 'the rendered reference is an image, and the HTML above it is the authority')
})

test('the Plan authority is canonical without the (1) upload name', () => {
  const plan = APPROVED.find((a) => a.surface === 'plan')!
  assert.ok(!plan.file.includes('('), 'the canonical Plan file name must not carry the upload suffix')
  assert.ok(!existsSync(`${DIR}/${plan.sourceName}`), `${DIR}/${plan.sourceName} would be a second current Plan pack`)

  const record = manifest().surfaces.find((s) => s.surface === 'plan')!
  assert.equal(record.path, `${DIR}/${plan.file}`)
  assert.ok(!record.path.includes('('), 'the manifest path must not carry the upload suffix')
  // Provenance is kept, and only as provenance.
  assert.equal(record.ownerApprovedSourceName, plan.sourceName, 'the original upload name is the recorded provenance')
})

test('the manifest names exactly the four canonical authorities, once each', () => {
  const { surfaces } = manifest()
  const current = surfaces.filter((s) => s.approvalState === 'current')

  assert.deepEqual(
    [...current.map((s) => s.surface)].sort(),
    [...APPROVED.map((a) => a.surface)].sort(),
    'the governed surfaces are exactly home, connect, plan and mfa-readiness',
  )
  assert.equal(current.length, new Set(current.map((s) => s.surface)).size, 'a surface has more than one current authority')
  assert.equal(current.length, surfaces.length, 'a non-current record would leave a future task choosing')

  for (const { surface, file, sha256 } of APPROVED) {
    const record = current.find((s) => s.surface === surface)!
    assert.equal(record.path, `${DIR}/${file}`, `${surface} points somewhere other than its canonical pack`)
    assert.equal(record.sha256, sha256, `${surface}'s recorded hash drifted from the owner's value`)
  }
})

test('the manifest keeps visual authority apart from copy and technical truth', () => {
  for (const record of manifest().surfaces) {
    assert.equal(record.copyAuthority, false, `${record.surface}: a pack is not a copy authority`)
    assert.equal(record.technicalTruthAuthority, false, `${record.surface}: a pack is not a technical-truth authority`)
    // `productionAssumedConformant` is false forever, and task 041 deliberately
    // left it false after the restoration landed. It does not mean "not restored
    // yet" — it means conformance is EVIDENCED rather than assumed. The two-sided
    // anatomy tests read the canonical bytes at test time and the rendered
    // comparison is shot per task; the commit after this one can regress a
    // surface without touching this file, so nothing here may assume.
    assert.equal(record.productionAssumedConformant, false, `${record.surface}: production must not be assumed conformant`)
    // What DID change is the landed state. Packs 031-040 restored all four
    // surfaces (the pack that did it is `restorationPack`), so a record still
    // reading `restoration-pending` would be the authority file stating
    // something false about its own repository (task 041).
    assert.equal(record.implementationState, 'restored', `${record.surface}: restoration state`)
    assert.match(record.restorationPack, /^\d{3}(-\d{3})?$/, `${record.surface}: a restored surface names the pack that restored it`)
  }
  assert.deepEqual(manifest().precedence.order, [
    'production technical/content truth',
    'approved HTML application architecture',
    'approved brand skin',
  ])
})

test('a generated branding preview is never an application authority', () => {
  const { generatedPreviews, brand, surfaces } = manifest()
  // Every authority flag on the previews block is false, whatever flags exist.
  for (const [key, value] of Object.entries(generatedPreviews)) {
    if (/Authority$/.test(key)) assert.equal(value, false, `generatedPreviews.${key} must be false`)
  }
  for (const flag of ['applicationLayoutAuthority', 'architectureAuthority', 'informationHierarchyAuthority', 'copyAuthority']) {
    assert.equal(generatedPreviews[flag], false, `generatedPreviews.${flag} is missing or true`)
  }
  assert.deepEqual(generatedPreviews.supersedes, [], 'a preview supersedes nothing')
  assert.equal(brand.applicationLayoutAuthority, false, 'the brand skin does not own page layout')
  // A preview must never appear as a governed surface's authority.
  for (const record of surfaces) {
    assert.match(record.path, /^docs\/design\/approved\/[a-z0-9.-]+\.html$/, `${record.surface}: authority is an approved pack`)
    assert.ok(!/preview|brand-frame|concept/i.test(record.path), `${record.surface}: a preview cannot be an application authority`)
  }
})

test('the rendered-evidence widths later packs must use are recorded', () => {
  // Passing tests never proved conformance before; a restoration pack renders.
  assert.deepEqual(manifest().renderedEvidence.widths, [1280, 768, 390])
})
