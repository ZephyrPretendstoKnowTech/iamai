// Review 7 R7-1: PowerShell ends a single-quoted string at U+2018, U+2019, U+201A and
// U+201B as well as at U+0027, and a correction's -TargetPolicyJson carries the tenant
// policy's own name. Doubling only U+0027 left "Finance’s MFA policy" unparseable, and a
// name ending "’; Remove-MgGroup … #" parsed cleanly with Remove-MgGroup as a command.
// Every PowerShell single-quote character is now doubled in an invocation literal.
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

/** A single-quoted PowerShell string read the way its tokenizer reads one: any two quote characters in a row are one character of the value. */
function readQuoted(line: string, start: number): { value: string; end: number } {
  assert.ok(QUOTES.includes(line[start]), `no literal at ${start}: ${line.slice(start, start + 20)}`)
  let value = ''
  for (let i = start + 1; i < line.length; i++) {
    if (!QUOTES.includes(line[i])) {
      value += line[i]
      continue
    }
    if (!QUOTES.includes(line[i + 1])) return { value, end: i }
    value += line[i + 1]
    i++
  }
  assert.fail(`unterminated literal: ${line.slice(start)}`)
}

const SPEC: InvocationSpec = {
  modeParameter: 'Mode',
  parameters: {
    Name: { binding: 'name', modes: ['Create'] },
    Ids: { binding: 'ids', modes: ['Create'] },
  },
}
const SCRIPT = 'param([Parameter(Mandatory)][string]$Mode, [string]$Name, [string[]]$Ids)'

test('each PowerShell single-quote character is doubled in an invocation literal, and nothing else changes', () => {
  for (const q of QUOTES) {
    const name = `Finance${q}s MFA${q}; ${COMMAND} #`
    const r = renderInvocation(SCRIPT, SPEC, [{ mode: 'Create', corrections: [] }], { name, ids: [`g${q}1`, 'g2'] }, new Set())
    assert.ok('calls' in r)
    assert.equal(r.calls[0], `Invoke-IAMAIStep -Mode 'Create' -Name 'Finance${q}${q}s MFA${q}${q}; ${COMMAND} #' -Ids @('g${q}${q}1', 'g2')`, `U+${q.codePointAt(0)!.toString(16)}`)
    const at = r.calls[0].indexOf("-Name '") + '-Name '.length
    const read = readQuoted(r.calls[0], at)
    assert.equal(read.value, name)
    assert.ok(r.calls[0].slice(read.end + 1).startsWith(" -Ids @('"))
  }
  // Control: double quotes (U+0022, U+201C–U+201E), $(…), backticks and other letters are left as they are.
  const other = 'Contoso “Staff” "MFA" „x” $(Get-Date) `n Équipe – ok'
  const r = renderInvocation(SCRIPT, SPEC, [{ mode: 'Create', corrections: [] }], { name: other, ids: ['a'] }, new Set())
  assert.ok('calls' in r)
  assert.equal(r.calls[0], `Invoke-IAMAIStep -Mode 'Create' -Name '${other}' -Ids @('a')`)
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

test('a handed-over correction whose tenant policy name holds a typographic quote keeps the whole target in -TargetPolicyJson', () => {
  const names = [
    'Finance’s MFA policy',
    `Policy B’; ${COMMAND} #`,
    `Policy B‚; ${COMMAND}; ‛`,
    `Policy B‘; ${COMMAND}; ’`,
    // Controls: an ASCII quote (already doubled before R7-1) and a plain name.
    `Policy B'; ${COMMAND}; '`,
    'Policy B',
  ]
  for (const name of names) {
    const call = correctionCall(name)
    const at = call.indexOf('-TargetPolicyJson ') + '-TargetPolicyJson '.length
    const { value, end } = readQuoted(call, at)
    const target = JSON.parse(value) as { displayName?: string }
    assert.equal(target.displayName, name, call)
    // The literal ends where the argument does: the policy id follows, and nothing runs in between.
    assert.equal(call.slice(end + 1), ` -PolicyId '${B}'`, JSON.stringify(name))
  }
})
