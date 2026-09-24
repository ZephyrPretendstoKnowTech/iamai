// One definition of enough (E7; Step 7): admin readiness is the share of admins
// who are Ready for phishing-resistant MFA (scoring/phishingResistant.ts, the
// state the admin lists read), and the campaign and step 12 say "or".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { isReady } from '../../scoring/phishingResistant.ts'
import { adminUserIds } from '../../roles.ts'
import { readinessPercent } from '../../roadmap/readiness.ts'

const setUp = () => {
  const f = fixture('demo-week2')
  return { f, r: runFixture(f) }
}

test('admin readiness is the share of admins who are Ready for phishing-resistant MFA', () => {
  const { f, r } = setUp()
  const admins = [...adminUserIds(f.snapshot.roles)]
  const rows = r.viability.filter((v) => admins.includes(v.userId))
  // Ready and Seamless are both Ready (79b66fd8).
  const ready = rows.filter((v) => isReady(v.readiness.state)).length
  const step = r.steps.find((s) => s.goalId === 'admins-phishing-resistant')!
  assert.equal(step.readiness.family, 'admin')
  // Rounded down, the one rounding a readiness percentage has (R4-14,
  // roadmap/readiness.ts readinessPercent): two of three admins is 66%, not 67%.
  assert.equal(step.readiness.percent, readinessPercent(ready, rows.length))
})
