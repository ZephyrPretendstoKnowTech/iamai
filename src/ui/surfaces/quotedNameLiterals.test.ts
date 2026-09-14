// Review 7 R7-1: PowerShell ends a single-quoted string at U+2018, U+2019, U+201A and
// U+201B as well as at U+0027, and a correction's -TargetPolicyJson carries the tenant
// policy's own name. Doubling only U+0027 left "Finance’s MFA policy" unparseable, and a
// name ending "’; Remove-MgGroup … #" parsed cleanly with Remove-MgGroup as a command.
// Review 8 R8-1: doubling the five characters holds only while the text is read as
// Unicode. A copied script saved without a BOM is read by Windows PowerShell 5.1 in the
// ANSI code page, where the UTF-8 bytes of "Ñ" (C3 91), "В" (D0 92) or "€" (E2 82 AC)
// include single quotes, so "Policy Ñ; Remove-MgGroup … #" broke out again. An invocation
// line is now ASCII alone: JSON carries \uXXXX, other text [char] terms.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderInvocation } from '../../content/implementation/invocation.ts'
import type { InvocationSpec } from '../../content/implementation/invocation.ts'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../mapping/safetyChoice.ts'
import { personReadiness } from '../../scoring/phishingResistant.ts'
import { stepBodyOf } from './stepBody.ts'

const QUOTES = ["'", '‘', '’', '‚', '‛']
const COMMAND = 'Remove-MgGroup -GroupId 00000000-0000-0000-0000-000000000000'
// Characters whose UTF-8 bytes include 0x91, 0x92 or 0x82 (single quotes in Windows-1252).
const ANSI_QUOTES = ['Ñ', 'Ò', 'Â', 'Б', 'В', '€', '‑', '‒']
const ASCII = /^[\x20-\x7e]*$/

/** A single-quoted PowerShell string on an ASCII line, read the way its tokenizer reads one: '' is one quote of the value. */
function readQuoted(line: string, start: number): { value: string; end: number } {
  assert.equal(line[start], "'", `no literal at ${start}: ${line.slice(start, start + 20)}`)
  let value = ''
  for (let i = start + 1; i < line.length; i++) {
    if (line[i] !== "'") {
      value += line[i]
      continue
    }
    if (line[i + 1] !== "'") return { value, end: i }
    value += "'"
    i++
  }
  assert.fail(`unterminated literal: ${line.slice(start)}`)
}

/** A literal as renderInvocation writes one: '…', or ('…' + [char]0xXXXX + …), which evaluates to the concatenation. */
function readLiteral(line: string, start: number): { value: string; end: number } {
  if (line[start] === "'") return readQuoted(line, start)
  assert.equal(line[start], '(', line.slice(start, start + 20))
  let value = ''
  let i = start + 1
  for (;;) {
    if (line[i] === "'") {
      const q = readQuoted(line, i)
      value += q.value
      i = q.end + 1
    } else {
      const m = /^\[char\]0x([0-9A-F]{4})/.exec(line.slice(i))
      assert.ok(m, `not a term: ${line.slice(i, i + 20)}`)
      value += String.fromCharCode(parseInt(m[1], 16))
      i += m[0].length
    }
    if (line.startsWith(' + ', i)) i += 3
    else {
      assert.equal(line[i], ')', line.slice(i, i + 20))
      return { value, end: i }
    }
  }
}

const SPEC: InvocationSpec = {
  modeParameter: 'Mode',
  parameters: {
    Name: { binding: 'name', modes: ['Create'] },
    Ids: { binding: 'ids', modes: ['Create'] },
    TargetJson: { binding: 'target.json', modes: ['Create'] },
  },
}
const SCRIPT = 'param([Parameter(Mandatory)][string]$Mode, [string]$Name, [string[]]$Ids, [string]$TargetJson)'

test('an invocation line is ASCII alone, and every text, list item and JSON value reads back as the value', () => {
  // Review 9 L9-2: a tab or line break in text left the call spread over lines.
  // Review 10: NUL, ESC, a lone CR, U+001F and U+007F take the same path.
  for (const q of [...QUOTES, ...ANSI_QUOTES, '\u{1F600}', 'Équipe – “Staff”', '\t', '\n', '\r\n', '\0', '[31m', '\r', '', '']) {
    const name = `Finance${q}s MFA${q}; ${COMMAND} #`
    const target = JSON.stringify({ displayName: name })
    const r = renderInvocation(SCRIPT, SPEC, [{ mode: 'Create', corrections: [] }], { name, ids: [`g${q}1`, 'g2'], 'target.json': target }, new Set())
    assert.ok('calls' in r)
    const call = r.calls[0]
    const label = `U+${q.codePointAt(0)!.toString(16)}`
    // Windows PowerShell 5.1 reads the same ASCII bytes whatever the code page.
    assert.match(call, ASCII, label)
    const name1 = readLiteral(call, call.indexOf('-Name ') + '-Name '.length)
    assert.equal(name1.value, name, label)
    assert.ok(call.slice(name1.end + 1).startsWith(' -Ids @('), label)
    const id1 = readLiteral(call, name1.end + 1 + ' -Ids @('.length)
    assert.equal(id1.value, `g${q}1`, label)
    assert.ok(call.slice(id1.end + 1).startsWith(", 'g2') -TargetJson '"), label)
    const json = readLiteral(call, call.indexOf('-TargetJson ') + '-TargetJson '.length)
    assert.equal(json.end, call.length - 1, label)
    // The JSON stays one quoted literal; ConvertFrom-Json reads \uXXXX as the character.
    assert.equal(call[call.indexOf('-TargetJson ') + '-TargetJson '.length], "'", label)
    assert.deepEqual(JSON.parse(json.value), { displayName: name }, label)
  }
  // The exact forms.
  const r = renderInvocation(SCRIPT, SPEC, [{ mode: 'Create', corrections: [] }], { name: "Ñ Finance's", ids: ['a'], 'target.json': '{"n":"Ñ\'"}' }, new Set())
  assert.ok('calls' in r)
  assert.equal(r.calls[0], `Invoke-IAMAIStep -Mode 'Create' -Name ('' + [char]0x00D1 + ' Finance''s') -Ids @('a') -TargetJson '{"n":"\\u00d1''"}'`)
  // Control: ASCII text, double quotes, $(…) and backticks are left as they are, one quoted literal.
  const other = 'Contoso "MFA" $(Get-Date) `n ok'
  const plain = renderInvocation(SCRIPT, SPEC, [{ mode: 'Create', corrections: [] }], { name: other, ids: ['a'], 'target.json': '{}' }, new Set())
  assert.ok('calls' in plain)
  assert.equal(plain.calls[0], `Invoke-IAMAIStep -Mode 'Create' -Name '${other}' -Ids @('a') -TargetJson '{}'`)
  // A preview's stand-in is drawn as it reads.
  const preview = renderInvocation(SCRIPT, SPEC, [{ mode: 'Create', corrections: [] }], { name: '‹name›', ids: ['a'], 'target.json': '‹target›' }, new Set(), new Set(['name', 'target.json']))
  assert.ok('calls' in preview)
  assert.equal(preview.calls[0], `Invoke-IAMAIStep -Mode 'Create' -Name '‹name›' -Ids @('a') -TargetJson '‹target›'`)
})

const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)
const B = 'c0100000-0000-4000-8000-000000000002'

/** The drawn PowerShell call of the handed-over correction of an enabled staff-group MFA policy named `policyName`. */
function correctionCall(policyName: string): string {
  const base = curatedFixture('demo-week2')
  const f = { ...base, groups: new Map(base.groups) }
  const excl = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
  const staffGroup = [...f.groups.keys()].find((id) => id !== excl)!
  const ca = f.snapshot.config.caPolicies!
  const keep = (ca.rows as { displayName?: string }[]).filter((p) => !/MFA for all users|Admins phishing-resistant|Admin sign-in|session/i.test(String(p.displayName)))
  const row = { id: B, displayName: policyName, state: 'enabled', conditions: { users: { includeGroups: [staffGroup], excludeGroups: [excl] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [row, ...keep] } } }
  const scored = runFixture({ ...f, snapshot } as never, { snapshot } as never).viability
  const r = runFixture({ ...f, snapshot } as never, { snapshot, viability: scored.map((v) => ({ ...v, readiness: READY })) } as never)
  const step = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')!
  // Premise: the correction of that policy is handed over, not previewed.
  assert.deepEqual((step.action.resolution?.policies ?? []).map((o) => [o.mode, o.policyId]), [['update', B]])
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx = { snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } as never
  const body = stepBodyOf(step, ctx)
  assert.equal(body.previewNote, null)
  const ps = body.artifacts.find((a) => a.id === 'ps')
  assert.ok(ps && !ps.unavailable)
  const calls = ps.text().split('\n').filter((l) => l.startsWith('Invoke-IAMAIStep '))
  assert.equal(calls.length, 1, ps.text().slice(-800))
  return calls[0]
}

test('a handed-over correction whose tenant policy name holds a quote, or a letter whose UTF-8 bytes read as one in Windows-1252, keeps the whole target in -TargetPolicyJson', () => {
  const names = [
    'Finance’s MFA policy',
    `Policy B’; ${COMMAND} #`,
    `Policy B‚; ${COMMAND}; ‛`,
    `Policy B‘; ${COMMAND}; ’`,
    `Policy Ñ; ${COMMAND} #`,
    `Политика В; ${COMMAND} #`,
    'Contraseñas y ACCESO Ñ',
    `Policy €‑‒; ${COMMAND} #`,
    // Controls: an ASCII quote (already doubled before R7-1) and a plain name.
    `Policy B'; ${COMMAND}; '`,
    'Policy B',
  ]
  for (const name of names) {
    const call = correctionCall(name)
    assert.match(call, ASCII, JSON.stringify(name))
    const at = call.indexOf('-TargetPolicyJson ') + '-TargetPolicyJson '.length
    const { value, end } = readQuoted(call, at)
    const target = JSON.parse(value) as { displayName?: string }
    assert.equal(target.displayName, name, call)
    // The literal ends where the argument does: the policy id follows, and nothing runs in between.
    assert.equal(call.slice(end + 1), ` -PolicyId '${B}'`, JSON.stringify(name))
  }
})
