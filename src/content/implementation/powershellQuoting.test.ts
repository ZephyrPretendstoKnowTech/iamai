// A value bound into a PowerShell script cannot end the string it sits in
// (security audit, 2026-09-29). The authentication-strength script reads the
// baseline's combinations as `ConvertFrom-Json -InputObject '{{json:…}}'`, and a
// JSON encoding keeps ' and U+2018–U+201B as they are, all of which end a
// PowerShell single-quoted string: a combination "x'); <code>; ('" ran as code in
// the admin's session, after Connect-MgGraph with a write scope. Today the only
// source is the pinned baseline, whose values are safe; this keeps it so.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { BINDING } from './protocol.ts'
import { projectImplementation } from './project.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

/** Every character PowerShell reads as a single quote. */
const QUOTE = /['\u2018\u2019\u201a\u201b]/

/**
 * A single-quoted PowerShell string starting at `open` (the quote), read as
 * PowerShell reads it: two quote characters in a row are one quote in the value,
 * and any other quote character ends the string. Returns the value and where the
 * string ends.
 */
function singleQuoted(line: string, open: number): { value: string; end: number } {
  let value = ''
  for (let i = open + 1; i < line.length; i++) {
    if (QUOTE.test(line[i])) {
      if (i + 1 < line.length && QUOTE.test(line[i + 1])) {
        value += line[i]
        i++
        continue
      }
      return { value, end: i }
    }
    value += line[i]
  }
  throw new Error('the string never ends')
}

const HOSTILE = [
  "x'); Write-Host INJECTED; ('",
  'x\u2019); Write-Host INJECTED; (\u2019',
  'x\u2018); Write-Host INJECTED; (\u2018',
  'x\u201a); Write-Host INJECTED; (\u201b',
  "x''); Write-Host INJECTED; (''",
  'M\u00fcller, fido2',
]

test('a strength combination holding a quote cannot end the string it is bound into in the PowerShell script', () => {
  const pkg = PACKAGES['s-prereq-auth-strength']
  for (const state of ['missing'] as const) {
    const combinations = ['fido2', ...HOSTILE]
    const p = projectImplementation(pkg, state, { 'strength.target.allowedCombinations': combinations })
    const ps = p.channels.find((c) => c.channel === 'powershell')
    assert.ok(ps, `${state}: no PowerShell channel (${JSON.stringify(p.hold ?? p.degraded)})`)
    const line = ps.text.split('\n').find((l) => l.includes('$Desired='))!
    const open = line.indexOf("-InputObject '") + '-InputObject '.length
    const { value, end } = singleQuoted(line, open)
    assert.equal(line.slice(end), "')", `${state}: the string ends early and code follows it: ${line}`)
    assert.deepEqual(JSON.parse(value), combinations, 'ConvertFrom-Json reads the same combinations back')
    assert.ok(!/[\u007f-\uffff]/.test(line), 'the line is ASCII, so no code page turns a byte into a quote')
  }
})

test('a PowerShell block binds tenant text only into a # comment, where no quote can end anything', () => {
  // The binder escapes a {{json:…}} value for any PowerShell context; a {{…}}
  // text value is bound as it is, which is safe only where the line is a comment.
  const found: string[] = []
  for (const [id, pkg] of Object.entries(PACKAGES)) {
    for (const [blockId, block] of Object.entries(pkg.blocks)) {
      if (block.meta.format !== 'powershell') continue
      for (const line of block.text.split('\n')) {
        for (const m of line.matchAll(BINDING)) {
          if (m[1] !== undefined) continue
          found.push(`${id} ${blockId}: ${m[0]}`)
          assert.match(line, /^\s*#/, `${id} ${blockId}: ${m[0]} is bound outside a comment: ${line.trim()}`)
        }
      }
    }
  }
  assert.ok(found.length > 0, 'the walk read no PowerShell block')
})
