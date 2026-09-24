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
// those bytes. .gitattributes marks the approved HTML as `-text` so git never
// rewrites it and the hash is stable on every platform.
//
// The four packs moved into docs/design/approved/anatomy/ when the design
// folder was cleaned, so that anatomy sits apart from the current visual
// comparison references in docs/design/approved/reference/. The bytes and the
// hashes below did not change: only the directory did.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'docs/design/approved/anatomy'
const MANIFEST = 'docs/design/approved/manifest.json'

/**
 * The MFA Readiness design files the owner archived on 2026-09-19 (item 22):
 * prompt 62's v3 pack replaced all three, and nothing current renders from
 * them. They are records now, so the only way a live file may name one is by
 * its archive path.
 */
const ARCHIVED = [
  'archive/design/iamai-mfa-readiness-final.html',
  'archive/design/iamai-mfa-readiness-approved-comparison-reference.html',
  'archive/design/mfa-readiness-v2.html',
] as const

/**
 * Where a retired name may still appear as written: the archive itself, the
 * numbered task reports under docs/design/reports/, and any dated record (a
 * file or folder named for its day). Each is history of what a past task
 * worked against, and history is not edited to keep a later layout true.
 */
const HISTORY = (path: string): boolean =>
  path.startsWith('archive/') || path.startsWith('docs/design/reports/') || /\d{4}-\d{2}-\d{2}/.test(path)

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
    sha256: 'd899bd2a99f65bd68e6af6ac156dd765591f06d0df5c53750b8148236becb793',
  },
  {
    // The owner's upload was named plan-step-design-pack(1).html. The (1) is
    // provenance, not identity: the canonical file drops it so no later task
    // has two "current" Plan packs to choose between.
    surface: 'plan',
    file: 'plan-step-v1.html',
    sourceName: 'plan-step-design-pack(1).html',
    sha256: '43de0a7cb9eae37ddf08eeebd829dcd13ed00200ca42e412cbbbfb875df6ae39',
  },
  {
    // Approved by the owner on 2026-09-18 (prompt 62): the v3 layout proposal,
    // promoted byte for byte from docs/design/proposals/.
    surface: 'mfa-readiness',
    file: 'mfa-readiness-v3.html',
    sourceName: 'docs/design/proposals/mfa-readiness-v3.html',
    sha256: '39e18ee8e3a35972085293b888f1ecebf026fd74086144d37ee26cc4780221e4',
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
        `Restore the exact bytes; if only line endings differ, .gitattributes must keep ${DIR}/*.html as -text.`,
    )
  }
  // One file per surface: two files with one hash is two current authorities,
  // and the manifest can only point at one of them (task 030).
  const html = readdirSync(DIR).filter((f) => f.endsWith('.html')).sort()
  assert.deepEqual(html, [...APPROVED.map((a) => a.file)].sort(), `${DIR} holds exactly the four canonical packs`)
})

test('the archived MFA Readiness files are records: no live file names one except by its archive path', () => {
  // Item 22 (2026-09-19). The reference manifest named the Step 7 page as the
  // authority after prompt 62 had made v3 the pack, and three tests still read
  // the retired files. A live reference to an archived file is how a record
  // becomes an authority again, so none may survive outside history.
  let files: string[]
  try {
    files = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n')
      .filter((f) => f && existsSync(f) && /\.(ts|tsx|mjs|cjs|js|json|md|html|css|ya?ml|txt|svg)$/.test(f) && !HISTORY(f))
  } catch {
    return
  }
  assert.ok(files.length > 100, 'the live file list is implausibly short, so the scan below proves nothing')
  const offenders: string[] = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const archived of ARCHIVED) {
      const name = archived.slice(archived.lastIndexOf('/') + 1)
      for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + name.length)) {
        if (!text.slice(0, at).endsWith(archived.slice(0, -name.length))) offenders.push(`${file}: ${name}`)
      }
    }
  }
  assert.deepEqual(offenders, [], 'a live file names an archived MFA Readiness design file; point it at the v3 pack, or at the archive path if it only records history')
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
  // The canonical HTML is the authority; a render is derived from it, never the input to it.
  const { authority, renderedEvidence } = manifest()
  assert.equal(authority.canonicalHtmlIsApplicationDesignAuthority, true)
  assert.equal(authority.renderedReferenceIsDerivedOnly, true)
  assert.equal(authority.generatedBrandApplicationPreviewsAreAuthoritative, false)
  assert.match(renderedEvidence.mechanism, /^scripts\/[a-z-]+\.mjs$/)
  assert.match(renderedEvidence.output, /\.png$/, 'the rendered reference is an image, and the HTML above it is the authority')
  assert.deepEqual(renderedEvidence.widths, [1280, 768, 390])
  // A generated branding preview is never an application authority.
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
    assert.match(record.path, /^docs\/design\/approved\/anatomy\/[a-z0-9.-]+\.html$/, `${record.surface}: authority is an approved anatomy pack`)
    assert.ok(!/preview|brand-frame|concept/i.test(record.path), `${record.surface}: a preview cannot be an application authority`)
  }
})

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

test('no generated branding line reached anything the product ships, and Jon Hope is never named as the product author', () => {
  // Task 041's sweep is over the whole shipped tree, so a surface added later is
  // covered on the day it is written. The forbidden lines are read out of the
  // brand manifest (`brand.forbiddenTaglines`), the one place they are named.
  // "Jon Hope" is a true fact about whose Conditional Access baseline IAMAI
  // reads, and How credits it; "Built by Jon Hope" is a claim about who built
  // this product, which the generated previews invented.
  const brand = JSON.parse(readFileSync('docs/brand/brand-manifest.json', 'utf8')) as { brand: { tagline: string | null; forbiddenTaglines: string[] } }
  const FORBIDDEN = [...brand.brand.forbiddenTaglines, 'Built by Jon Hope', 'Created by Jon Hope', 'Made by Jon Hope']
  assert.ok(FORBIDDEN.length > 5, 'the forbidden list must come from the brand manifest, not from nothing')
  assert.equal(brand.brand.tagline, null, 'the brand has no tagline')
  assert.match(readFileSync('src/ui/surfaces/How.tsx', 'utf8'), /CA_POLICY_ANALYZER/, 'How credits the baseline author’s own project')
  // A test file is allowed to name a forbidden line — that is how it forbids it.
  const files = shipped().filter((f) => !/\.test\.ts$/.test(f))
  assert.ok(files.length > 100, `only ${files.length} files walked — the walk is broken, not the tree`)
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const line of FORBIDDEN) assert.ok(!text.includes(line), `${file} carries the generated line "${line}"`)
  }
})
