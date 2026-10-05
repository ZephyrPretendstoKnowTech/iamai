// A baseline's own facts live with the baseline (v2.0 prep, Phase A item 5): the
// lockdown switches, the author's corrections, the footer reasons, the hidden
// policies and the companion goals are Jon's annotations, and the generic modules
// that read them hold no id or name of his.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_BASELINE } from './registry.ts'
import { JHOPE188_ANNOTATIONS } from './annotations/jhope188.ts'
import { AUTHOR_CORRECTIONS } from './authorCorrections.ts'
import { LOCKDOWN_SWITCHES } from '../roadmap/lockdownKit.ts'
import { COMPANION_GOALS } from '../coverage/companions.ts'
import { EMERGENCY_ACCESS_GROUP } from '../roadmap/stepGroups.ts'

const GENERIC = ['src/roadmap/lockdownKit.ts', 'src/baseline/authorCorrections.ts', 'src/derive/notInPlan.ts', 'src/roadmap/workflows.ts', 'src/coverage/companions.ts']

test("Jon's baseline carries its own annotations, and the modules that read them carry none of his ids or names", () => {
  assert.equal(DEFAULT_BASELINE.annotations, JHOPE188_ANNOTATIONS)
  assert.equal(LOCKDOWN_SWITCHES, JHOPE188_ANNOTATIONS.lockdownSwitches)
  assert.equal(AUTHOR_CORRECTIONS, JHOPE188_ANNOTATIONS.corrections)
  assert.deepEqual([...COMPANION_GOALS], JHOPE188_ANNOTATIONS.companionGoals)
  const ids = [...JHOPE188_ANNOTATIONS.lockdownSwitches.map((s) => s.key), ...JHOPE188_ANNOTATIONS.footerReasons.flatMap((r) => r.ids)]
  for (const file of GENERIC) {
    const src = readFileSync(file, 'utf8')
    for (const id of ids) assert.ok(!src.includes(id), `${file} still holds ${id}`)
    assert.ok(!/['"`]IAC\s*-/.test(src), `${file} still names one of Jon's policies`)
  }
})

test("the footer reasons name step groups and goals that exist", () => {
  const steps = JHOPE188_ANNOTATIONS.footerReasons.flatMap((r) => (r.step ? [r.step] : []))
  assert.ok(steps.includes(EMERGENCY_ACCESS_GROUP), 'the emergency reason names the Emergency Access group by its key')
})
