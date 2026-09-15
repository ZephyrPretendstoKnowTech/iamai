// B8 — the per-step content pass (docs/product/actionability/step-findings),
// each change read where the Plan reads it: the Source checked date from a
// package's verifiedSources, the Impact and milestone words from its META, a
// held policy's end state from its content entry, the separate-accounts
// checklist as that step's Entra channel, and a Cleanup row's instructions
// under Implementation in its one column.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from '../../content/implementation/protocol.ts'
import { content } from '../../content/content.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { CONTRACT, stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { packageSourceLine } from './stepPackage.ts'
import { headingsOf, stepBodyOf } from './stepBody.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
const FIXTURES: readonly FixtureName[] = ['mid', 'large', 'small', 'messy', 'hostile', 'demo', 'demo-week2']

const planOf = (name: FixtureName) => {
  const f = fixture(name)
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  return { r, ctx }
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test('every package a step doc asks to date shows Source checked for the 2026-09-12 check', () => {
  const dated = [
    's-prereq-break-glass', 's-prereq-exclusion-group', 's-verify-mfa', 's-goal-block-legacy-auth', 's-goal-admins-phishing-resistant',
    's-prereq-auth-strength', 's-prereq-trusted-location', 's-prereq-allowed-countries', 's-check-separate-admin-accounts', 's-goal-admin-session',
    's-goal-block-auth-transfer', 's-goal-block-device-code', 's-goal-guests-mfa', 's-goal-mfa-all-users', 's-goal-register-info-protected',
    's-goal-admin-portals-protected', 's-goal-block-unsupported-platforms', 's-goal-geo-restriction', 's-goal-require-managed-device',
  ]
  for (const id of dated) {
    const pkg = PACKAGES[id]
    assert.ok(pkg, `${id}: not registered`)
    const sources = (pkg.meta.verifiedSources ?? []) as { checkedOn?: string; userFacing?: boolean; url?: string }[]
    assert.ok(sources.some((v) => v.checkedOn === '2026-09-12' && v.userFacing === true && /^https:\/\/learn\.microsoft\.com\//.test(v.url ?? '')), `${id}: no Microsoft Learn source checked 2026-09-12`)
    assert.ok(packageSourceLine(pkg, CONTRACT.implementation), `${id}: no Source checked line`)
  }
})

test('the Impact and milestone words the step docs name are what the Plan reads from each package', () => {
  const impact: Record<string, string> = {
    's-prereq-passkey-settings': 'Passkey settings',
    's-prereq-auth-strength': 'Authentication strength',
    's-prereq-trusted-location': 'Trusted network',
    's-prereq-allowed-countries': 'Country restrictions',
    's-prereq-device-plan': 'Device policies',
  }
  // Editorial batch C: the milestone words are the copy register's.
  const milestone: Record<string, string> = {
    's-prereq-break-glass': 'Complete the remaining emergency access checks.',
    's-prereq-device-plan': 'Save the phone and computer choices.',
    's-check-separate-admin-accounts': 'Test the new admin account, then move the role.',
  }
  for (const [id, label] of Object.entries(impact)) assert.equal(PACKAGES[id]?.meta.impact?.fallbackLabel, label, id)
  for (const [id, text] of Object.entries(milestone)) assert.equal(PACKAGES[id]?.meta.milestone?.actionText, text, id)
})

test('a held policy finishes on its own end state where its content entry states one, never the shared sentence', () => {
  let own = 0
  for (const name of FIXTURES) {
    const { r, ctx } = planOf(name)
    for (const step of r.steps) {
      const end = contentStepFor(step)?.doneEnd
      if (typeof end !== 'string') continue
      const ownLine = new RegExp(`^${escape(end).replace(escape('{tenant}'), '.+')}$`)
      for (const line of stepContract(step, ctx).doneWhen) {
        if (ownLine.test(line)) {
          own += 1
          continue
        }
        assert.doesNotMatch(line, /^The policy is enforced in .+\.$/, `${name}/${step.id}: the shared end state`)
      }
    }
  }
  assert.ok(own > 0, 'no held policy read its own end state')
})

test('the campaign and the exclusions group finish on what their step docs say', () => {
  const byId = (id: string) => content.steps.find((s) => s.id === id)
  // Editorial batch C: the campaign's own settings check is a human check; the admin readiness gate stays.
  assert.ok(byId('s-verify-mfa')?.doneWhen?.includes('Every admin is Ready for phishing-resistant MFA.'))
  const target = 'The exclusions group is confirmed and contains only the selected emergency access accounts.'
  assert.equal(byId('s-prereq-exclusion-group')?.doneWhen?.[0], target)
  let read = 0
  for (const name of FIXTURES) {
    const { r, ctx } = planOf(name)
    const step = r.steps.find((s) => s.id === 's-prereq-exclusion-group')
    if (!step) continue
    const c = stepContract(step, ctx)
    if (c.state.satisfied) continue
    assert.ok(c.doneWhen.includes(target), `${name}: ${c.doneWhen.join(' | ')}`)
    read += 1
  }
  assert.ok(read > 0, 'no open exclusions group step was read')
})

test('Use Separate Accounts for Admin Work draws its per-person checklist as one Entra channel under Implementation', () => {
  const { r, ctx } = planOf('mid')
  const step = r.steps.find((s) => s.id === 's-check-separate-admin-accounts')
  assert.ok(step, 'the step is on the mid plan')
  const b = stepBodyOf(step, ctx)
  assert.ok(headingsOf(b).includes(CONTRACT.implementation.heading), headingsOf(b).join(' · '))
  // Entra carries the checklist; AI Info describes it (B10 P1-4).
  assert.deepEqual(b.artifacts.filter((a) => !a.unavailable).map((a) => a.id), ['portal', 'ai'])
  const text = b.artifacts[0].text()
  for (const line of ['cloud-only account', 'Roles and administrators', 'https://aka.ms/mysecurityinfo', 'Keep mail, Teams and files on the everyday account']) assert.ok(text.includes(line), `missing: ${line}`)
})

test("a Cleanup row's instructions sit under Implementation, with the not-assessed notes in its one column", () => {
  const src = readFileSync('src/ui/surfaces/CleanupStep.tsx', 'utf8')
  assert.match(src, /<StepSection heading=\{CONTRACT\.implementation\.heading\}>/)
  assert.doesNotMatch(src, /HEAD\.whatToDo/)
  assert.doesNotMatch(src, /has-rail/, 'a Cleanup row draws no action column')
  const main = src.indexOf('<div className="step-main">')
  assert.ok(main > 0 && src.indexOf('entry.whatToDo', main) > main && src.indexOf('A.notAssessedLabel', main) > main, 'the rename list and the notes are in the main column')
})
