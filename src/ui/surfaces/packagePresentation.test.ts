// What a package-backed step shows beside its implementation (correction batch 2):
// a source conflict with its package set aside for review still says so, keeps
// its source-checked date, and says why nothing is implemented; the AI warning
// every package repeated is said once, by the runtime.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from '../../content/implementation/protocol.ts'
import { NO_RUNTIME, projectImplementation, sourceUpdatedOn } from '../../content/implementation/project.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { baselineConflictWords } from '../../roadmap/baselineConflict.ts'
import { CONTRACT, implementationEmptyOf, stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { BASELINE_COMMIT, artifactText, implementationPackageFor, packageReviewFor, packageSourceLine, packageStateOf, reviewedPackageFor } from './stepPackage.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

test('the Admin Portal source conflict shows its review, its source date, the conflict and why nothing is implemented, and resolves nothing', () => {
  for (const name of ['demo', 'demo-week2'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const step = r.steps.find((s) => s.goalId === 'admin-portals-protected')!
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    const c = stepContract(step, ctx)
    // The conflict, with the reviewed source's own words.
    assert.equal(c.state.condition, 'baseline-conflict', name)
    assert.ok(baselineConflictWords(step), `${name}: the conflict carries no explanation`)
    // Why nothing is implemented: no operation, the conflict's own empty box, no package projection.
    assert.equal(c.implementation.offered, false)
    assert.equal(c.implementation.offered === false && c.implementation.reason, 'baseline-conflict')
    assert.equal(implementationEmptyOf(c).key, 'conflict')
    assert.equal(packageStateOf(step, c, f.snapshot), 'sourceConflict')
    // Review needed against the current pin, with its provenance.
    assert.equal(implementationPackageFor(step), null, 'guidance reviewed for a changed member was applied')
    const review = packageReviewFor(step)!
    assert.equal(review.status, 'reviewNeeded')
    assert.equal(review.pinned, BASELINE_COMMIT)
    assert.deepEqual(review.changed, ['fafaa50c-0b61-4ac6-a589-f9a1120b2f9e'])
    const reviewed = reviewedPackageFor(step)!
    assert.equal(reviewed.meta.stepId, 's-goal-admin-portals-protected')
    // Its source line is the checked date alone, or nothing: the pins it was reviewed between are the review's, not a line on the step (S6).
    const line = packageSourceLine(reviewed, CONTRACT.implementation)
    assert.equal(line === null, sourceUpdatedOn(reviewed) === null, 'the source line and the checked date disagree')
    if (line !== null) assert.match(line, /^Source checked /, line)
    assert.equal(line?.includes(String(reviewed.meta.baselineAuthority?.pinCommit).slice(0, 8)) ?? false, false, 'the step names a pin')
  }
  // The page draws the review note and the source line even where there is nothing to implement.
  // The opened step's body spans the component and stepBody.ts (A3): the decisions read there.
  const src = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8') + readFileSync('src/ui/surfaces/stepBody.ts', 'utf8')
  const empty = src.slice(src.indexOf('<ImplementationEmptyBox empty={empty} />'), src.indexOf(') : (', src.indexOf('<ImplementationEmptyBox empty={empty} />')))
  assert.match(empty, /notes\.map/, 'the review note is drawn only beside artifacts')
  assert.match(src, /reviewedPackageFor\(step\)/, 'a set-aside package lost its source line')
})

test('the shared AI warning is said once, by the runtime, and a package warning worded otherwise stays', () => {
  const warning = CONTRACT.implementation.aiWarning
  let stripped = 0
  for (const pkg of Object.values(PACKAGES)) {
    const ai = Object.values(pkg.blocks).filter((b) => b.meta.channel === 'aiInfo')
    for (const b of ai) {
      if (!b.text.includes(warning)) continue
      const text = artifactText({ channel: 'aiInfo', text: b.text }, warning)
      assert.equal(text.includes(warning), false, `${pkg.meta.stepId}: ${b.meta.id} still repeats the warning`)
      assert.ok(text.trim().length > 0, `${pkg.meta.stepId}: ${b.meta.id} lost its content`)
      stripped++
    }
  }
  assert.ok(stripped >= 40, `only ${stripped} AI Info blocks carried the shared warning`)
  assert.equal(artifactText({ channel: 'aiInfo', text: 'Line one.\n**Do not paste the client secret.**' }, warning), 'Line one.\n**Do not paste the client secret.**', 'a warning of the package’s own was removed')
  assert.equal(artifactText({ channel: 'json', text: warning }, warning), warning, 'only AI Info carries the shared warning')
  // A projected AI Info artifact keeps its tenant content after the warning goes.
  const projected = projectImplementation(PACKAGES['s-goal-block-legacy-auth'], 'missing', { 'policy.target.displayName': 'Block legacy authentication', 'tenant.displayName': 'Contoso' }, NO_RUNTIME).channels.find((x) => x.channel === 'aiInfo')
  if (projected) assert.equal(artifactText(projected, warning).includes(warning), false)
})
