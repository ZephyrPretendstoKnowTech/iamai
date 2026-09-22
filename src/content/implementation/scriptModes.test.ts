// A step holding enforcement back said "the instruction being withheld is the
// one that turns the policy on". The Portal channel withheld it and the JSON
// channel withheld it; the PowerShell script shipped its Enforce branch whole,
// with the target policy and its id pre-filled on the invocation line, one
// word's edit from the Observe mode it did offer. Its four guards check policy
// shape only, so on a tenant where readiness cannot be measured -Mode 'Enforce'
// would have run straight through them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriptForRuns } from './invocation.ts'
import type { InvocationSpec } from './invocation.ts'

const Q = String.fromCharCode(39)
const SPEC: InvocationSpec = { modeParameter: 'Mode', parameters: {} }
const run = (...modes: string[]): { mode: string; corrections: string[] }[] => modes.map((mode) => ({ mode, corrections: [] }))
const text = (r: ReturnType<typeof scriptForRuns>): string => 'text' in r ? r.text : `UNSTRIPPED: ${r.unstripped.join(', ')}`

const IF_SCRIPT = [
  'param(',
  ` [Parameter(Mandatory)][ValidateSet(${Q}Create${Q},${Q}Observe${Q},${Q}Enforce${Q})][string]$Mode`,
  ')',
  'function Helper { 1 }',
  `if($Mode -eq ${Q}Create${Q}){ POST }`,
  `if($Mode -eq ${Q}Enforce${Q}){ PATCH @{state=${Q}enabled${Q}} }`,
  'Write-Host done',
].join('\n')

test('a script is shipped in the modes it is called in, and the others are gone', () => {
  const only = text(scriptForRuns(IF_SCRIPT, SPEC, run('Observe')))
  assert.ok(only.includes(`ValidateSet(${Q}Observe${Q})`), only)
  assert.ok(!only.includes('PATCH'), `the enforce branch is still shipped:\n${only}`)
  assert.ok(!only.includes('POST'), 'the create branch is still shipped')
  // Everything that is not a mode's own branch is untouched.
  assert.ok(only.includes('function Helper { 1 }') && only.includes('Write-Host done'))
  // Called in a mode, it keeps that mode and nothing else.
  const two = text(scriptForRuns(IF_SCRIPT, SPEC, run('Create', 'Enforce')))
  assert.ok(two.includes('POST') && two.includes('PATCH'))
  assert.ok(two.includes(`ValidateSet(${Q}Create${Q},${Q}Enforce${Q})`), two)
})

test('a switch arm is removed the same way, and braces inside strings and subexpressions are text', () => {
  const script = [
    `param([ValidateSet(${Q}Create${Q},${Q}Enforce${Q})][string]$Mode)`,
    'switch ($Mode){',
    ` ${Q}Create${Q} {`,
    `   if($Name -like ${Q}{{*${Q}){throw ${Q}unresolved${Q}}`,
    `   $f="displayName eq ${Q}$($Name.Replace("${Q}","${Q}${Q}"))${Q}"`,
    '   POST',
    ' }',
    ` ${Q}Enforce${Q}{ PATCH }`,
    '}',
    'Write-Host end',
  ].join('\n')
  const only = text(scriptForRuns(script, SPEC, run('Create')))
  assert.ok(!only.includes('PATCH'), `the enforce arm survived:\n${only}`)
  // The Create arm is whole: its own braces sit inside a string and a subexpression.
  assert.ok(only.includes('POST') && only.includes('unresolved') && only.includes('Write-Host end'), only)
  assert.ok(only.includes(`ValidateSet(${Q}Create${Q})`), only)
})

test('a guard that only names a mode is left alone; a branch this does not recognise withholds the channel', () => {
  // "if($Mode -ne 'X')" and "if($Mode -in @(...))" stop firing once the
  // ValidateSet rejects the mode, so they are not a way to reach it.
  const guarded = [
    `param([ValidateSet(${Q}Create${Q},${Q}Extra${Q})][string]$Mode)`,
    `if($Mode -ne ${Q}Extra${Q}){ Check-Common }`,
    `if($Mode -eq ${Q}Extra${Q}){ EXTRA }`,
  ].join('\n')
  const only = text(scriptForRuns(guarded, SPEC, run('Create')))
  assert.ok(!only.includes('EXTRA'), only)
  assert.ok(only.includes('Check-Common'), 'the shared precondition was removed with the mode')

  // A dispatch in a shape this cannot cut withholds the whole channel rather
  // than shipping a script half stripped.
  const odd = [
    `param([ValidateSet(${Q}Create${Q},${Q}Enforce${Q})][string]$Mode)`,
    `if($Mode -eq ${Q}Enforce${Q}) PATCH`,
  ].join('\n')
  const refused = scriptForRuns(odd, SPEC, run('Create'))
  assert.deepEqual('unstripped' in refused ? refused.unstripped : null, ['Enforce'])
})

test('a script with no mode ValidateSet, or called in every mode it declares, is untouched', () => {
  assert.equal(text(scriptForRuns('Write-Host hi', SPEC, run('Create'))), 'Write-Host hi')
  assert.equal(text(scriptForRuns(IF_SCRIPT, SPEC, run('Create', 'Observe', 'Enforce'))), IF_SCRIPT)
})
