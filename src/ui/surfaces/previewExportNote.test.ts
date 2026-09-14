// Review 7 queue 2: a step whose Implementation region is a package preview ("cannot be
// copied yet", with the values still to resolve) exported the portal walk-through under
// "Ready · Create" with nothing saying it could not run yet. Where the preview waits on
// values IAMAI does not hold, the export now carries the screen's own note after the
// lines; where the screen draws no preview, the export carries no such note.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, curatedFixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { implementationIsCurrent } from '../../roadmap/nextSafeAction.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { stepExportView } from './stepExport.ts'
import { CONTRACT } from './stepContract.ts'

const W = CONTRACT.implementation.preview as unknown as { text: string; textValues: string; values: string }
const VALUES_LEAD = W.values.slice(0, W.values.indexOf('{'))
const isNote = (l: string): boolean => l === W.text || l === W.textValues || l.startsWith(VALUES_LEAD)

test('an exported walk-through of work the screen previews says what the screen says about copying it; an executable one says nothing of the kind', () => {
  const seen: string[] = []
  let executable = 0
  const runs: [string, unknown][] = [['demo-week2+curated', curatedFixture('demo-week2')], ['small', fixture('small')], ['mid', fixture('mid')]]
  for (const [name, made] of runs) {
    const f = made as ReturnType<typeof fixture>
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    for (const step of r.steps) {
      if (!step.action?.resolution?.policies?.length) continue
      const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming } as StepVarContext
      const body = stepBodyOf(step, ctx)
      const exported = stepExportView(step, ctx).whatToDo
      const note = body.previewNote?.lines ?? []
      const valuesHeld = note.some((l) => l.startsWith(VALUES_LEAD))
      if (valuesHeld && implementationIsCurrent(step)) {
        for (const l of note) assert.ok(exported.includes(l), `${name} ${step.id}: ${JSON.stringify(l)} missing from ${JSON.stringify(exported)}`)
        // After the walk-through it qualifies, never above the action.
        assert.ok(exported.indexOf(note[0]) > 0, `${name} ${step.id}`)
        seen.push(`${name} ${step.id}`)
      }
      if (note.length === 0) {
        assert.deepEqual(exported.filter(isNote), [], `${name} ${step.id}: an export note beside work the screen hands over`)
        if (body.artifacts.some((a) => a.id === 'ps' && !a.unavailable)) executable++
      }
    }
  }
  // Premises: previewed and handed-over work were both read. The curated session-lifetime create used to
  // preview on excluded people though its target excludes nobody; a resolved empty list is now the
  // target's own value (consolidated batch), so it is handed over and its export carries no note.
  assert.ok(!seen.includes('demo-week2+curated s-goal-all-users-no-persistence'), JSON.stringify(seen))
  assert.ok(seen.length >= 3, JSON.stringify(seen))
  assert.ok(executable > 0)
})
