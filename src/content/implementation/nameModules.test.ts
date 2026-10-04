// No policy package keeps a correction module IAMAI can never select for a name.
//
// A name.canonical module declared no facts and no select condition, so the
// compiler withheld it ("cannot select this module"): a renamed tagged policy is
// adopted under its new name, and renames live in 8.2 Align Policy Names (owner,
// 2026-09-26). 4.3 lost its module first (e7295033); every other policy package
// followed. A module that is selectable stays. Named-location packages are out of
// scope here: their partial projection is withheld whole (no mismatch binding).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import registry from './registry.generated.json' with { type: 'json' }
import { normalizeProjection, parseBlocks, validatePackage } from './protocol.ts'
import type { CompiledPackage, PackageMeta } from './protocol.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/implementation-content')
const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

/** Every authored policy package, as its source reads: META.json and CONTENT.md. */
function policySources(): { id: string; meta: PackageMeta; blocks: ReturnType<typeof parseBlocks> }[] {
  return fs.readdirSync(ROOT, { withFileTypes: true }).flatMap((d) => {
    const dir = path.join(ROOT, d.name, d.name)
    if (!d.isDirectory() || !fs.existsSync(path.join(dir, 'META.json')) || !fs.existsSync(path.join(dir, 'CONTENT.md'))) return []
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'META.json'), 'utf8')) as PackageMeta & { family?: string }
    if (meta.family !== 'policy') return []
    return [{ id: d.name, meta, blocks: parseBlocks(fs.readFileSync(path.join(dir, 'CONTENT.md'), 'utf8')) }]
  })
}

test('no policy package keeps a name module IAMAI cannot select, and no registered package carries its blocks', () => {
  const sources = policySources()
  assert.ok(sources.length >= 12, `the premise: the policy packages are read (${sources.length})`)
  for (const { id, meta, blocks } of sources) {
    const errors = validatePackage({ meta: { ...meta, projection: normalizeProjection(meta, blocks) }, blocks })
    assert.deepEqual(errors.filter((e) => /mismatches\.name\.[^:]*: IAMAI cannot select/.test(e)), [], id)
    assert.deepEqual(Object.keys(blocks).filter((b) => /correct-name/.test(b)), [], id)
    assert.doesNotMatch(blocks['powershell.run']?.text ?? '', /CorrectName/, id)
  }
  for (const [id, pkg] of Object.entries(PACKAGES)) {
    assert.deepEqual(Object.keys(pkg.blocks).filter((b) => /correct-name/.test(b)), [], id)
    assert.doesNotMatch(pkg.blocks['powershell.run']?.text ?? '', /CorrectName/, id)
  }
})
