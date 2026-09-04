// Every command IAMAI puts in front of a user is one line, and uses only the
// Graph module cmdlets this tool documents (prompt 43 item 14).
//
// One line is the rule, not a preference. A user pasting a loop into a
// production tenant is how this tool would do harm without ever making a call
// itself, so anything needing more than one line gets a portal path instead.
//
// This sweeps every PowerShell string the app can render, not just the ones
// added by prompt 43 — the rule is about what reaches the user, not about who
// wrote it.
import { powershellFor } from '../ui/surfaces/stepPowerShell.ts'
import { stepOperations } from '../ui/surfaces/stepJson.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ALLOWED_CMDLETS, createCommands } from './servicePrincipals.ts'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'

const ROOT = join(import.meta.dirname, '..')

test('the service-principal commands are one line each and use only documented cmdlets', () => {
  const c = createCommands({ appId: '00000003-0000-0000-c000-000000000000', displayName: 'Microsoft Graph' })
  for (const [key, line] of Object.entries(c)) {
    assert.equal(line.includes('\n'), false, `${key} is one line`)
    assert.equal(line.includes(';'), false, `${key} is one statement, not two joined`)
    assert.equal(/\|\s*ForEach|foreach|\bfor\b|\bwhile\b|try\s*{/.test(line), false, `${key} has no loop or error handling`)
    const cmdlet = line.split(/\s+/)[0]
    assert.ok((ALLOWED_CMDLETS as readonly string[]).includes(cmdlet), `${key} uses a documented cmdlet, got ${cmdlet}`)
  }
})

test('every PowerShell string a step can render is a single line', () => {
  // From the generated plans, which is what a user actually sees: the PowerShell
  // tab renders the JSON tab's body (stepPowerShell.ts).
  const offenders: string[] = []
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) {
      if (!s.action.json) continue
      const ps = powershellFor(stepOperations(s))
      for (const line of ps.split('\n')) {
        const t = line.trim()
        if (t === '' || t.startsWith('#')) continue
        if (/\bforeach\b|\bfor\s*\(|\bwhile\b|try\s*{|\bfunction\b/i.test(t)) offenders.push(`${f.name}/${s.id}: ${t.slice(0, 80)}`)
      }
    }
  }
  assert.deepEqual(offenders, [], 'no step ships a loop, a function, or error handling')
})

test('no copy module hides a multi-line script in a template literal', () => {
  // A single-line rule enforced only at the call site is enforced nowhere, so
  // this reads the copy modules themselves.
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) files.push(p)
    }
  }
  walk(join(ROOT, 'copy'))
  const offenders: string[] = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    // A PowerShell verb-noun cmdlet followed later in the same literal by a newline.
    for (const m of src.matchAll(/`([^`]*(?:Connect-Mg|Get-Mg|New-Mg|Set-Mg|Update-Mg|Remove-Mg)[^`]*)`/g)) {
      const body = m[1]
      if (body.includes('\\n') || body.includes('\n')) offenders.push(`${relative(ROOT, file)}: ${body.slice(0, 70).replace(/\s+/g, ' ')}`)
    }
  }
  assert.deepEqual(offenders, [], 'multi-line Graph scripts in copy')
})
