// Overnight review B5: Step 2 and Step 3's exports print the task text the
// screen shows, as Step 1's export does, never the content's older What to do
// lines ("Without key restrictions, leave them off").
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepExportView } from './stepExport.ts'
import { emergencyAccountTasksText } from './emergencyAccountTasks.ts'
import { emergencyGroupTasksOf } from './emergencyGroupTasks.ts'
import { emergencyPasskeyTasksOf } from './emergencyPasskeyTasks.ts'

const flat = (text: string): string[] => text.replace(/\*\*/g, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)

for (const [stepId, tasksOf] of [['s-prereq-exclusion-group', emergencyGroupTasksOf], ['s-prereq-passkey-settings', emergencyPasskeyTasksOf]] as const) {
  test(`${stepId}: the export's What to do is the screen's task text`, () => {
    const f = structuredClone(fixture('demo'))
    const run = runFixture(f)
    const step = run.steps.find(s => s.id === stepId)!
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
    const exported = stepExportView(step, ctx).whatToDo
    const screen = flat(emergencyAccountTasksText(tasksOf(step, ctx)))
    assert.ok(screen.length > 0)
    for (const line of screen) assert.ok(exported.includes(line), `exported: ${line}`)
    // Nothing from the content's older instructions.
    const old = ((contentStepFor(step) as { whatToDo?: { steps?: string[] } } | undefined)?.whatToDo?.steps ?? []).map(line => line.split('{')[0].trim()).filter(line => line.length > 20)
    if (stepId === 's-prereq-passkey-settings') assert.ok(old.length > 0, 'the content still carries the older lines this guards against')
    for (const line of old) assert.ok(!exported.some(e => e.startsWith(line)), `not exported: ${line}`)
    assert.doesNotMatch(exported.join('\n'), /leave them off/)
  })
}
