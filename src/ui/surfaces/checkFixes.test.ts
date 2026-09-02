// Prompt 52, walk-51 item 14: the emergency-access and exclusions-group steps
// render their failing checks from the validation engine through the content
// checkFixes templates. For every failing check on the demo and GetIAMAI
// snapshots the rendered fix line names its values with none left empty; the
// count line equals the number of fail results; a passing check renders nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { fillText } from '../../content/render.ts'
import { stepById } from '../../content/content.ts'

const CONTENT_ID: Record<string, string> = {
  'validation-breakGlass': 's-prereq-break-glass',
  'validation-exclusionGroup': 's-prereq-exclusion-group',
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
      const fails = (ex.failingChecks as [string, Record<string, unknown>][]) ?? []
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
