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
import { stepBodyOf } from './stepBody.ts'
import { app } from '../../content/content.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'

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

// R4-32 (Marcus D14). The screen offers each registration method behind a
// picker; the export, AI Info and the Entra artifact took the default alone,
// unlabelled and numbered on as mandatory, so a reader briefed from them was
// told to register a YubiKey on 33 ordinary accounts and the Authenticator
// procedures were gone. Every alternative is written out under its own label.
test('the flattened emergency tasks carry every alternative under its label, never the default alone', () => {
  const f = structuredClone(fixture('mid'))
  const run = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const LABELS = ['YubiKey security key', 'Microsoft Authenticator on iPhone/iPad', 'Microsoft Authenticator on Android']
  const lead = (app.plan as unknown as { emergencyTasks: { variantsLead: string } }).emergencyTasks.variantsLead
  const passkeys = run.steps.find(s => s.id === 's-prereq-passkey-settings')!
  assert.ok(emergencyPasskeyTasksOf(passkeys, ctx).tasks.some(task => task.id === 'prepare-affected-passkeys' && (task.variants?.length ?? 0) > 1), 'the premise: the passkey step offers alternatives')
  const accounts = run.steps.find(s => s.id === 's-prereq-break-glass')!
  const channels: [string, string][] = [
    ['passkey export', stepExportView(passkeys, ctx).whatToDo.join('\n')],
    ['passkey AI Info', stepBodyOf(passkeys, ctx).artifacts.find(a => a.id === 'ai')!.text()],
    ['accounts export', stepExportView(accounts, ctx).whatToDo.join('\n')],
    ['accounts Entra', stepBodyOf(accounts, ctx).artifacts.find(a => a.id === 'portal')!.text()],
  ]
  for (const [where, text] of channels) {
    assert.ok(text.includes(lead), `${where}: no alternatives`)
    for (const label of LABELS) assert.ok(text.includes(label), `${where}: ${label} is missing`)
    // The YubiKey steps appear only inside their labelled alternative.
    for (const chunk of text.split(lead)) {
      const at = chunk.indexOf('Connect the approved YubiKey')
      if (at < 0) continue
      const labelAt = chunk.indexOf(LABELS[0])
      assert.ok(labelAt >= 0 && labelAt < at && chunk.indexOf(LABELS[1]) > at, `${where}: a YubiKey step outside its label`)
    }
    assert.ok(!text.split(lead)[0].includes('Connect the approved YubiKey'), `${where}: a YubiKey step before the alternatives`)
  }
})

// R4-45 (Jordan D12). A Completed step's lines are cleared, and the three
// Emergency Access preparation steps then refilled them with every procedure,
// so the export and AI Info of a finished Prepare Emergency Access Accounts read
// thirty-one numbered imperative lines as its What to do while the screen folded
// the same words under "Reference: how each of these changes is made". The
// export carries the same label, by the same rule, before the same words.
test('a finished emergency step exports its procedures under the reference label, and an open one does not', () => {
  const reference = (app.plan as unknown as { stepContract: { implementation: { reference: string } } }).stepContract.implementation.reference
  const exported = (name: 'demo' | 'demo-week2') => {
    const f = structuredClone(fixture(name))
    const run = runFixture(f)
    const step = run.steps.find(s => s.id === 's-prereq-break-glass')!
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
    const lane = laneViewOf(laneReadings(run.steps).get(step.id)!, (x: string) => run.steps.find(s => s.id === x)?.title ?? null)
    return { lane, whatToDo: stepExportView(step, ctx, lane).whatToDo }
  }
  const done = exported('demo-week2')
  assert.equal(done.lane.lane, 'Completed', 'the premise: the board reads this step finished')
  const at = done.whatToDo.indexOf(reference)
  const firstTask = done.whatToDo.indexOf('Create an emergency account')
  assert.ok(at >= 0, `no reference label: ${JSON.stringify(done.whatToDo.slice(0, 4))}`)
  assert.ok(firstTask > at, 'a procedure comes before the reference label')
  // Every word is still there.
  assert.ok(done.whatToDo.some(line => /New user → Create new user/.test(line)))

  const open = exported('demo')
  assert.notEqual(open.lane.lane, 'Completed', 'the premise: this one is not finished')
  assert.ok(!open.whatToDo.includes(reference), 'an open step labelled its own instructions reference')
})
