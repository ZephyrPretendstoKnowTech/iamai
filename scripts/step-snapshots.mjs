// Writes the per-step snapshots (A3): for every fixture in
// src/testing/stepSnapshots.ts SNAPSHOT_FIXTURES and every step of its plan,
// docs/qa/step-snapshots/<fixture>/<stepId>.json — the step's lane, substatus,
// reason, fact, badge, bar, rail, headings, tiles, channels and When, as the
// Plan draws them.
//
//   node scripts/step-snapshots.mjs
//
// Deterministic (the module formats every date from the fixture's own clock, in
// UTC), so running it twice on one tree writes the same bytes. A fixture's
// folder is emptied first, so a step that leaves a plan leaves the record too.
// src/testing/stepSnapshots.test.ts regenerates the same set in memory and diffs
// it against these files; scripts/check-change-scope.mjs says which commits may
// change them.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { SNAPSHOT_DIR, SNAPSHOT_FIXTURES, snapshotPath, snapshotText, stepSnapshotsOf } from '../src/testing/stepSnapshots.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let files = 0
for (const name of SNAPSHOT_FIXTURES) {
  const dir = path.join(root, SNAPSHOT_DIR, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const snapshots = stepSnapshotsOf(name)
  for (const [stepId, s] of Object.entries(snapshots)) {
    fs.writeFileSync(path.join(root, snapshotPath(name, stepId)), snapshotText(s))
    files += 1
  }
  console.log(`${name}: ${Object.keys(snapshots).length} steps`)
}
console.log(`${files} snapshots -> ${SNAPSHOT_DIR}`)
process.exit(0)
