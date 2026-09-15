// S3 (C05): a package channel with no content is never drawn as a blank tab.
//
// Block Authentication Transfer's AI Info is one warning line and one line naming
// values IAMAI never binds (`evidence.reportOnly`, `dependencies.blockers`); the
// value's line drops, the viewer strips the shared warning, and the AI Info tab
// used to open to nothing. It is the unavailable tab instead, like any channel
// without content, and every other tab is unchanged.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepVarContext } from './stepVars.ts'
import { CONTRACT } from './stepContract.ts'
import { artifactText, implementationPackageFor, packageBindings, packageRuntime, packageStateOf, planningPreview } from './stepPackage.ts'
import { projectSafely } from '../../content/implementation/project.ts'

test('a package channel left with no text after its unbound lines drop draws as unavailable, never blank', () => {
  let premise = 0
  for (const f of allFixtures().filter((x) => x.name !== 'huge')) {
    const r = runFixture(f)
    for (const step of r.steps) {
      const pkg = implementationPackageFor(step)
      if (!pkg) continue
      const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } as StepVarContext
      const b = stepBodyOf(step, ctx)
      for (const a of b.artifacts) if (a.unavailable !== true) assert.notEqual(a.text().trim(), '', `${f.name}/${step.id}: the ${a.id} tab is drawn with no content`)
      // The premise: a projected channel whose text is empty once the viewer reads it.
      const state = packageStateOf(step, b.contract, f.snapshot)
      if (!state || !b.packaged) continue
      const bindings = packageBindings(step, ctx, b.contract)
      const runtime = packageRuntime(pkg, state, bindings, {}).runtime
      const executed = projectSafely(pkg, state, bindings, runtime, () => {})
      const shown = planningPreview(pkg, step, b.contract, f.snapshot, bindings, runtime, executed) ?? executed
      const blank = shown.channels.filter((c) => artifactText(c, CONTRACT.implementation.aiWarning).trim() === '')
      if (blank.length === 0) continue
      premise++
      for (const c of blank) assert.equal(b.artifacts.find((a) => a.id === (c.channel === 'aiInfo' ? 'ai' : c.channel === 'entra' ? 'portal' : c.channel === 'powershell' ? 'ps' : c.channel))?.unavailable, true, `${f.name}/${step.id}: ${c.channel}`)
    }
  }
  assert.ok(premise > 0, 'the premise: some fixture step projects a channel with no content')
})
