// A3: the committed per-step snapshots (docs/qa/step-snapshots) are what every
// fixture step reads on the Plan today. The set is regenerated in memory here
// and diffed file by file; a difference names the fixture, the step and the
// field, so a change that moves a step's reading is a named change and never a
// surprise on screen. scripts/step-snapshots.mjs writes the files;
// scripts/check-change-scope.mjs says which commits may change them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { SNAPSHOT_DIR, SNAPSHOT_FIELDS, SNAPSHOT_FIXTURES, snapshotPath, snapshotText, stepSnapshotsOf } from './stepSnapshots.ts'
import type { StepSnapshot } from './stepSnapshots.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

test('every fixture step reads on the Plan as its committed snapshot says, field by field', () => {
  const problems: string[] = []
  let checked = 0
  for (const name of SNAPSHOT_FIXTURES) {
    const dir = `${SNAPSHOT_DIR}/${name}`
    const committed = new Set(existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length)) : [])
    const live = stepSnapshotsOf(name)
    for (const id of committed) if (!(id in live)) problems.push(`${name}/${id}: a snapshot is committed but the step is not on the plan`)
    for (const [id, now] of Object.entries(live)) {
      if (!committed.has(id)) {
        problems.push(`${name}/${id}: the step is on the plan but no snapshot is committed`)
        continue
      }
      const text = read(snapshotPath(name, id))
      const saved = JSON.parse(text) as StepSnapshot
      let fields = 0
      for (const field of SNAPSHOT_FIELDS) {
        const was = JSON.stringify(saved[field])
        const is = JSON.stringify(now[field])
        if (was !== is) {
          problems.push(`${name}/${id}: ${field} — committed ${was}, now ${is}`)
          fields += 1
        }
      }
      // The same fields, but not the same file: a field added, dropped or reordered by hand.
      if (fields === 0 && text !== snapshotText(now)) problems.push(`${name}/${id}: the file is not the snapshot as scripts/step-snapshots.mjs writes it`)
      checked += 1
    }
  }
  assert.ok(checked > 150, `steps checked: ${checked}`)
  assert.equal(problems.length, 0, ['the step snapshots differ from the plan:', ...problems, 'regenerate with `node scripts/step-snapshots.mjs`; a commit that also changes src/ says [snapshots]'].join('\n'))
})

test('a snapshot set is the same on every run: nothing in it reads the clock or the machine', () => {
  const a = stepSnapshotsOf('demo-week2')
  const b = stepSnapshotsOf('demo-week2')
  assert.deepEqual(a, b)
  for (const [id, s] of Object.entries(a)) {
    // Every date the Plan shows is a day; a snapshot date is a fixed day, never a relative word.
    for (const text of [s.when, s.rail, s.bar, ...s.tiles.map((t) => t.state)]) assert.doesNotMatch(text, /\b(today|tomorrow|yesterday|in \d+ days|\d+ days ago)\b/i, `${id}: a relative date in the snapshot: "${text}"`)
  }
})
