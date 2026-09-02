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
  assert.match(guard, /d\.redact \? redactIdentifiers\(content\) : content/, 'the guard no longer redacts on the default branch')
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
  assert.deepEqual(declared.sort(), ['grounding-bundle', 'plan-file', 'print-document'], 'the set of unredacted surfaces changed')

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
  for (const surface of declared) {
    const at = callers.get(surface) ?? []
    assert.equal(at.length, 1, `${surface} is claimed from ${at.length} places (${at.join(', ')}); it must be exactly one, next to its warning`)
  }
})

test('the grounding bundle still warns before it can be unredacted', () => {
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
})

test('redaction defaults to on for the bundle', () => {
  const page = readFileSync('src/ui/surfaces/Export.tsx', 'utf8')
  assert.match(page, /useState\(true\)[^\n]*\n?/, 'no state initialises to true')
  assert.match(page, /bundleRedacted[\s\S]{0,80}useState\(true\)|useState\(true\)[\s\S]{0,80}bundleRedacted/, 'bundleRedacted does not default to redacted')
})
