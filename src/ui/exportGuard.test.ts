// The enumeration is the point.
//
// Redaction used to be a convention applied at each call site, and three of
// fourteen export paths applied it (audit redact-06). Moving the logic into
// `exportGuard.ts` fixes today; this test is what stops tomorrow. It walks the
// source, finds every use of a browser export API, and fails if any of them is
// outside the guard — so an export added later fails the build until it routes
// correctly, rather than silently becoming the fifteenth path that forgot.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import test from 'node:test'

const GUARD = 'src/ui/exportGuard.ts'

function sources(dir = 'src'): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...sources(p))
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p.split(sep).join('/'))
  }
  return out
}

/** Every way a browser lets an app hand bytes to the user or another program. */
const EXPORT_APIS: { name: string; pattern: RegExp }[] = [
  { name: 'a download', pattern: /URL\.createObjectURL\s*\(/ },
  { name: 'a download link', pattern: /\.download\s*=/ },
  { name: 'a clipboard write', pattern: /navigator\.clipboard/ },
  { name: 'a print', pattern: /window\.print\s*\(/ },
  { name: 'a form post', pattern: /\.submit\s*\(\s*\)/ },
]

test('every export path goes through the guard', () => {
  const offenders: string[] = []
  for (const file of sources()) {
    if (file === GUARD) continue
    const text = readFileSync(file, 'utf8')
    for (const { name, pattern } of EXPORT_APIS) {
      if (pattern.test(text)) offenders.push(`${file} reaches ${name} directly`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these files bypass ${GUARD}. Route them through exportDownload / exportClipboard / exportPrint, which apply redaction unless a disposition says otherwise.`,
  )
})

test('the guard is the only thing that redacts, and it always does by default', () => {
  const guard = readFileSync(GUARD, 'utf8')
  assert.match(guard, /redactIdentifiers/, 'the guard does not redact at all')
  // `d.keep` is the vendor constants a runbook's redaction leaves (runbookRedaction); REDACTED has none.
  assert.match(guard, /d\.redact \? redactIdentifiers\(content, d\.keep\) : content/, 'the guard no longer redacts on the default branch')
  // No optional or defaulted disposition: omitting it has to be a compile error,
  // not a silent fallthrough to whichever branch the author assumed.
  assert.doesNotMatch(guard, /d\s*:\s*Disposition\s*=/, 'the disposition has a default, so an export can omit the decision')
  assert.doesNotMatch(guard, /d\?\s*:\s*Disposition/, 'the disposition is optional, so an export can omit the decision')
})

test('an unredacted export is only reachable from a surface that warns', () => {
  const guard = readFileSync(GUARD, 'utf8')
  const declared = [...guard.matchAll(/'([a-z-]+)'/g)]
    .map((m) => m[1])
    .filter((v) => guard.includes(`UnredactedSurface = `) && guard.slice(guard.indexOf('UnredactedSurface ='), guard.indexOf('\n', guard.indexOf('UnredactedSurface ='))).includes(`'${v}'`))
  assert.deepEqual(declared.sort(), ['grounding-bundle', 'implementation-artifact', 'inventory-csv', 'plan-file', 'plan-policies', 'print-document'], 'the set of unredacted surfaces changed')
  // Policies as JSON (F-024): its card says the object IDs are in full.
  assert.match(String((JSON.parse(readFileSync('docs/design/content.json', 'utf8')) as { pages: { export: { cards: { policies: string[] } } } }).pages.export.cards.policies[1]), /Object IDs are in full\. Review it before sharing\./)

  // Each surface may be claimed from exactly one place, and that place is the
  // component that renders the warning.
  const callers = new Map<string, string[]>()
  for (const file of sources()) {
    if (file === GUARD) continue
    const text = readFileSync(file, 'utf8')
    for (const surface of declared) {
      if (text.includes(`unredactedFrom('${surface}')`)) callers.set(surface, [...(callers.get(surface) ?? []), file])
    }
  }
  // The inventory tables and MFA Readiness's person list (prompt 62) each carry the CSV notice on their control.
  assert.deepEqual((callers.get('inventory-csv') ?? []).sort(), ['src/ui/components/DataTable.tsx', 'src/ui/surfaces/Export.tsx', 'src/ui/surfaces/MfaReadiness.tsx'])
  assert.match(readFileSync('src/ui/components/DataTable.tsx', 'utf8'), /shared\.csvNotice/)
  assert.match(readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8'), /title=\{String\(shared\.csvNotice\)\} onClick=\{exportCsv\}/)
  for (const surface of declared) {
    const at = callers.get(surface) ?? []
    assert.equal(at.length, surface === 'inventory-csv' ? 3 : 1, `${surface} is claimed from ${at.length} places (${at.join(', ')}); it must be exactly one, next to its warning`)
  }
})

test('the grounding bundle warns before its redaction control, and redaction defaults to on', () => {
  // The grounding bundle still warns before it can be unredacted.
  {
    // The one export the product deliberately offers in full. The warning has to
    // render above the control that clears redaction, not after it.
    const page = readFileSync('src/ui/surfaces/Export.tsx', 'utf8')
    const warning = page.indexOf('GROUNDING.warning')
    // The rendered control, not the useState declaration hundreds of lines above
    // it — the first version of this test compared against the declaration and
    // failed on correct code.
    const checkbox = page.indexOf('onChange={(e) => setBundleRedacted(')
    assert.ok(warning > 0, 'the grounding bundle warning is gone')
    assert.ok(checkbox > 0, 'the redaction checkbox is gone')
    assert.ok(warning < checkbox, 'the warning renders after the control it warns about')
  }
  // Redaction defaults to on for the bundle.
  {
    const page = readFileSync('src/ui/surfaces/Export.tsx', 'utf8')
    assert.match(page, /useState\(true\)[^\n]*\n?/, 'no state initialises to true')
    assert.match(page, /bundleRedacted[\s\S]{0,80}useState\(true\)|useState\(true\)[\s\S]{0,80}bundleRedacted/, 'bundleRedacted does not default to redacted')
  }
})

// F-061: the Implementation viewer's Copy is the unredacted
// `implementation-artifact` surface, and its AI Info (the step handed to an
// assistant outside the tenant, names and object ids in full) was justified by
// a warning above the preview that a V1 rewrite had dropped. stepPackage.ts
// artifactText strips the package's own copy of that warning because the tab
// draws it, so it was said nowhere. It stands above the AI Info text in the
// preview and in the expanded viewer, before the text Copy copies.
test('AI Info carries its tenant-context warning above the text, in the preview and in the expanded viewer', () => {
  const step = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  const viewer = step.slice(step.indexOf('export function Implementation('), step.indexOf('return (', step.indexOf('export function Implementation(')))
  const warnings = [...viewer.matchAll(/\{tab === 'ai' && <Callout kind="warning">\{W\.aiWarning\}<\/Callout>\}/g)].map((m) => m.index)
  assert.equal(warnings.length, 2, 'the preview and the expanded viewer each draw the warning')
  const preview = viewer.indexOf("{body('preview-text')}")
  const dialog = viewer.indexOf("{body('dialog-code', true)}")
  assert.ok(warnings[0]! < preview && preview < warnings[1]! && warnings[1]! < dialog, 'each warning stands above the text it warns about')
  assert.match(readFileSync(GUARD, 'utf8'), /AI Info carries its tenant-context warning above the same/, 'the guard still names the warning')
})

// Security audit, 2026-09-29: SECURITY.md and the README said three exports
// carried names and ids in full, while every CSV and the Implementation viewer's
// Copy did too, and the docs still described a feedback link that prefilled a
// scan summary. The published docs name every surface that exports in full, and
// a surface added to the guard fails here until they do.
test('SECURITY.md and the README name every surface that exports names, sign-in addresses and object ids in full', () => {
  const guard = readFileSync(GUARD, 'utf8')
  const surfaces = [...(/export type UnredactedSurface = ([^\n]+)/.exec(guard)?.[1] ?? '').matchAll(/'([a-z-]+)'/g)].map((m) => m[1])
  assert.ok(surfaces.length >= 5, `surfaces read: ${surfaces.join(', ')}`)
  /** How each surface is named in the docs. */
  const NAMED: Record<string, { security: RegExp; readme: RegExp }> = {
    'plan-file': { security: /The plan file:/, readme: /the plan file/ },
    'print-document': { security: /The print document:[\s\S]{0,200}sign-in address/, readme: /the print document/ },
    'grounding-bundle': { security: /The grounding bundle with its redaction checkbox cleared/, readme: /the unmasked grounding bundle/ },
    'inventory-csv': { security: /Every CSV:[\s\S]{0,300}`Id` column/, readme: /every CSV\s+\(the groups CSV includes each group's object id\)/ },
    'implementation-artifact': { security: /Copy in a step's Implementation viewer, AI Info included/, readme: /Copy in a step's Implementation\s+viewer, AI Info included/ },
    'plan-policies': { security: /Policies as JSON on the Export page:[\s\S]{0,200}object ids/, readme: /and Policies as JSON/ },
  }
  const security = readFileSync('SECURITY.md', 'utf8')
  const inFull = security.slice(security.indexOf('**In full.**'), security.indexOf('## What it never does'))
  const readme = readFileSync('README.md', 'utf8')
  const exportsBullet = readme.slice(readme.indexOf('- **Exports.**'), readme.indexOf('- **Hosting.**'))
  for (const surface of surfaces) {
    const named = NAMED[surface]
    assert.ok(named, `${surface} exports in full and SECURITY.md and README.md do not name it: add it to both, and here`)
    assert.match(inFull, named.security, `SECURITY.md's "In full" list does not name ${surface}`)
    assert.match(exportsBullet, named.readme, `README.md's Exports line does not name ${surface}`)
  }
  assert.doesNotMatch(security, /Three exports carry names and ids in full|prefills the message|scan summary is\s+optional/, 'a stale claim is back')
  // The worker the scan's bulk reads run in has no CSP of its own; the docs say what keeps the token on Graph there.
  assert.match(security, /does not reach the dedicated worker[\s\S]{0,700}refuses any URL whose origin is not exactly\s+`https:\/\/graph\.microsoft\.com`/)
  assert.match(guard, /- `inventory-csv` —/, 'the guard\'s comment does not describe the inventory-csv surface')
})

// Security review, 2026-09-29: the docs named a masked "policy's JSON downloaded
// from the plan footer" that no one can download (no housekeeping line carries
// JSON, so the footer never offers it), and the guard's comment opened by saying
// every surface warns before its export while its own bullets say two do not.
test('the docs name no export the app does not offer, and the guard says which in-full surfaces do not warn yet', () => {
  for (const file of ['SECURITY.md', 'README.md']) assert.doesNotMatch(readFileSync(file, 'utf8'), /policy's\s+JSON/, file)
  const footer = readFileSync('src/ui/surfaces/PlanFooter.tsx', 'utf8')
  assert.doesNotMatch(footer, /housekeeping\.push\(\{[^\n]*\bjson\b/, 'a plan-footer line now offers its JSON: name that download in SECURITY.md and README.md')
  const guard = readFileSync(GUARD, 'utf8')
  const lead = guard.slice(guard.indexOf(' * The surfaces allowed to export without redaction'), guard.indexOf(' * - `grounding-bundle`'))
  assert.ok(lead.length > 0, 'the comment is not where it was')
  assert.doesNotMatch(lead, /Each value names a place in\s+\* the UI that shows the user what the export contains before/)
  assert.match(lead, /print/, 'the lead does not say the print card has no identifier warning')
  assert.match(lead, /tooltip/, 'the lead does not say the CSV notice is a tooltip on two pages')
  assert.doesNotMatch(guard, /Names in full, only from a surface that warns first/)
})
