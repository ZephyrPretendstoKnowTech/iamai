// Prompt 52, walk-51 item 14: the emergency-access and exclusions-group steps
// render their failing checks from the validation engine through the content
// checkFixes templates. For every failing check on the demo and GetIAMAI
// snapshots the rendered fix line names its values with none left empty; the
// count line equals the number of fail results; a passing check renders nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from '../../roadmap/fixtures/index.ts'
import { buildContext, reportFor } from '../../validation/report.ts'
import { stepChecks } from '../../validation/checkFixes.ts'
import type { GroupFacts } from '../../validation/rules.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { fillText } from '../../content/render.ts'
import { stepById } from '../../content/content.ts'

const CONTENT_ID: Record<string, string> = {
  'validation-breakGlass': 's-prereq-break-glass',
  'validation-exclusionGroup': 's-prereq-exclusion-group',
  'prereq-exclusion-group': 's-prereq-exclusion-group',
  'prereq-break-glass': 's-prereq-break-glass',
}
// Variables the fill engine resolves from shared references, not from the step.
const SHARED_REFS = new Set(['portalRoot', 'reportOnlyLine', 'exclusionsLine', 'signature', 'policyIfWrong', 'changeIfWrong', 'datesNew', 'datesChange', 'portalOpen', 'existingCoverage', 'syncRoleNote', 'strengthName'])

test('every failing check renders a complete fix line on the demo and GetIAMAI snapshots (walk-51 item 14)', () => {
  const fixtures = allFixtures().filter((f) => f.name === 'demo' || f.name === 'getiamai')
  assert.equal(fixtures.length, 2, 'both the demo and GetIAMAI fixtures are present')
  let failsSeen = 0
  let passesSeen = 0
  for (const f of fixtures) {
    const run = runFixture(f)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names?.label(id) ?? id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf }
    for (const step of run.steps) {
      if (!step.checks) continue
      const cs = stepById[CONTENT_ID[step.goalId]] as unknown as { whatToDo: { checkFixes: Record<string, string> } } | undefined
      assert.ok(cs, `${f.name}: content step for ${step.goalId}`)
      const checkFixes = cs!.whatToDo.checkFixes
      const ex = stepVars(step, ctx) as Record<string, unknown>
      // A fix line per failing check: the minimum under Fix before continuing, and
      // emergency-access hardening in its own section (owner, 2026-09-11).
      const fails = [...((ex.failingChecks as [string, Record<string, unknown>][]) ?? []), ...((ex.hardeningChecks as [string, Record<string, unknown>][]) ?? [])]
      // The count line equals the number of fail results, one fix line each.
      assert.equal(ex.failing, step.checks.failing, `${f.name} ${step.id}: {failing} matches the fail count`)
      assert.equal(fails.length, step.checks.failing, `${f.name} ${step.id}: one fix line per failing check`)
      assert.ok((ex.total as number) >= (ex.failing as number), `${f.name} ${step.id}: total is at least failing`)
      passesSeen += (ex.total as number) - (ex.failing as number)
      for (const [key, vals] of fails) {
        failsSeen++
        const tmpl = checkFixes[key]
        assert.ok(tmpl, `${f.name}: a checkFixes template for ${key}`)
        const merged = { ...ex, ...vals }
        // Every variable the template names resolves to a non-empty value.
        for (const m of tmpl.matchAll(/\{(?:list:)?([a-zA-Z0-9_]+)\}/g)) {
          const name = m[1]
          if (SHARED_REFS.has(name)) continue
          const val = merged[name]
          const nonEmpty = Array.isArray(val) ? val.length > 0 : val !== undefined && val !== null && String(val).length > 0
          assert.ok(nonEmpty, `${f.name} ${key}: {${name}} is empty`)
        }
        // The rendered line carries no leftover brace.
        assert.doesNotMatch(fillText(tmpl, merged), /\{[a-zA-Z]/, `${f.name} ${key}: a brace survived the fill`)
      }
    }
  }
  assert.ok(failsSeen > 0, `some checks fail across the two snapshots (saw ${failsSeen})`)
  assert.ok(passesSeen > 0, 'a passing check is counted in total and renders no fix line')
})

// xg.notDynamic fails for three facts: a group that is not security-enabled, a
// dynamic rule, and an assigned licence. Every failure rendered the one
// "not-dynamic" line, so an assigned group whose only fault was a licence was
// told "The group is dynamic; recreate it with assigned membership." (Phase 2
// audit, How and Configure Emergency Exclusions).
test('the exclusions-group fix line names the fact the group check found', () => {
  const f = fixture('mid')
  const run = runFixture(f)
  const bg = run.input.mapping.breakGlassUserIds
  const templates = (stepById['s-prereq-exclusion-group'] as unknown as { whatToDo: { checkFixes: Record<string, string> } }).whatToDo.checkFixes
  const linesFor = (edit: Partial<GroupFacts>): string[] => {
    const entry: GroupFacts = { groupId: 'g-excl', displayName: 'Emergency Exclusions', membershipRule: null, mailEnabled: false, securityEnabled: true, groupTypes: [], assignedLicenseSkuIds: [], memberIds: [...bg], memberCount: bg.length, sampled: false, directMembers: 'complete', directMemberIds: [...bg], ...edit }
    const report = reportFor('exclusionGroup', [entry], buildContext({ snapshot: f.snapshot, state: run.input.mapping, groupMembers: [entry] }))
    return stepChecks(report).items.filter((i) => i.fix !== 'excluded-from-every-policy').map((i) => fillText(templates[i.fix] ?? `(no template for ${i.fix})`, i.values))
  }
  const licensed = linesFor({ assignedLicenseSkuIds: ['c7df2760-2c81-4ef7-b578-5b5392b571df'] })
  assert.equal(licensed.length, 1, licensed.join(' | '))
  assert.doesNotMatch(licensed[0], /dynamic/i, 'a licensed assigned group is told it is dynamic')
  assert.match(licensed[0], /licen/i)
  const dynamic = linesFor({ membershipRule: 'user.department -eq "IT"', groupTypes: ['DynamicMembership'] })
  assert.match(dynamic.join(' '), /dynamic/i)
  const notSecurity = linesFor({ securityEnabled: false })
  assert.equal(notSecurity.length, 1, notSecurity.join(' | '))
  assert.doesNotMatch(notSecurity[0], /dynamic/i, 'a group that is not security-enabled is told it is dynamic')
  assert.match(notSecurity[0], /security-enabled/)
  const mail = linesFor({ mailEnabled: true })
  assert.doesNotMatch(mail.join(' '), /licen/i, 'a mail-enabled group is told it is licensed')
})
