// The test prompt 37 should have written.
//
// `src/derive/agreement.test.ts` asserts that planSummary, goalCounts and
// doThisNext agree with each other. They always did. What it never checked is
// whether any page calls them — its own helper is named `surfaces()` and
// documented as "everything the four surfaces put on screen", and it does not
// read a surface. So `peopleCounts` sat as a dead import in RoadmapPage.tsx,
// `denyingSteps` had no callers at all, and five separate inline filters went
// on printing three different numbers for the same thing, with every assertion
// green (prompt 40 §3).
//
// This reads what the pages actually rendered. `npm run inventory` drives
// headless Chrome over every surface against the mock tenant and writes
// docs/qa/ui-inventory.json; the fingerprint test beside this one fails if that
// file is stale, so what is asserted here is always current with the source.
//
// The assertions are deliberately about numbers that appear on MORE THAN ONE
// surface. A number rendered once cannot contradict anything; every defect in
// review-08 section A was two surfaces disagreeing.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

type Surface = {
  name: string
  headings: string[]
  tabs: string[]
  buttons: string[]
  options: string[]
  links: string[]
  chips: string[]
  columns: string[]
  tiles: string[]
  empty: string[]
  summaries: string[]
  tips: string[]
  sentences: string[]
}

const inventory = JSON.parse(readFileSync('docs/qa/ui-inventory.json', 'utf8')) as { surfaces: Surface[] }

/** Every string a person can read on a surface. */
const textOf = (s: Surface): string[] => [
  ...s.headings, ...s.tabs, ...s.buttons, ...s.options, ...s.links,
  ...s.chips, ...s.columns, ...s.tiles, ...s.empty, ...s.summaries, ...s.tips, ...s.sentences,
]

/** Every rendered line anywhere, with the surface it came from. */
const allLines: { surface: string; text: string }[] = inventory.surfaces.flatMap((s) =>
  textOf(s).map((text) => ({ surface: s.name, text })),
)

/** Distinct numbers captured by a pattern, across every surface. */
function captured(pattern: RegExp): { value: number; surface: string; text: string }[] {
  const out: { value: number; surface: string; text: string }[] = []
  for (const { surface, text } of allLines) {
    for (const m of text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))) {
      const n = Number(m[1])
      if (Number.isFinite(n)) out.push({ value: n, surface, text })
    }
  }
  return out
}

const distinct = (rows: { value: number }[]): number[] => [...new Set(rows.map((r) => r.value))].sort((a, b) => a - b)
const show = (rows: { surface: string; text: string }[]): string =>
  rows.map((r) => `\n    ${r.surface}: ${r.text.slice(0, 110)}`).join('')

test('the inventory has surfaces to read', () => {
  // A silently empty inventory would make every assertion below vacuous, which
  // is the failure mode this whole file exists to avoid.
  assert.ok(inventory.surfaces.length > 10, `only ${inventory.surfaces.length} surfaces`)
  assert.ok(allLines.length > 300, `only ${allLines.length} rendered lines`)
})

test('one number for blocked steps, across every surface that names one', () => {
  // review-08 A9: "20 steps that can deny access are held", "15 blocked", and
  // "18 steps waiting on Setup question 2" — three counts of overlapping sets,
  // each phrased as though it were the whole.
  const held = captured(/(\d+) steps that can deny access are held/i)
  const blocked = captured(/(\d+) steps blocked/i)
  const rows = [...held, ...blocked]
  if (rows.length === 0) return // the mock has none blocked; nothing to contradict
  assert.equal(
    distinct(rows).length,
    1,
    `blocked steps are reported as ${distinct(rows).join(' and ')} on different surfaces:${show(rows)}`,
  )
})

test('one directory total, and enabled never exceeds it', () => {
  // review-08 A3/A4: "13 users in the directory... 3 of 12 enabled users" in one
  // paragraph, the gap being a shared mailbox counted as a person by one of the
  // two and not the other.
  const directory = captured(/(\d+) users? in the directory/i)
  const enabled = captured(/of (\d+) enabled users/i)
  if (directory.length === 0) return
  assert.equal(distinct(directory).length, 1, `the directory total differs by surface:${show(directory)}`)
  const total = directory[0].value
  for (const e of enabled) {
    assert.ok(e.value <= total, `${e.value} enabled users but only ${total} in the directory:${show([e])}`)
  }
})

test('one applicable-goal denominator wherever goals are counted', () => {
  // review-08 A5/D2: "32 goals considered, 27 apply", "6 of 27", and a "% of
  // scored goals" tile computed over a fourth filter inside the coverage engine.
  const applies = captured(/(\d+) apply to this tenant/i)
  const ofGoals = captured(/of (\d+) security goals/i)
  const rows = [...applies, ...ofGoals]
  if (rows.length === 0) return
  assert.equal(
    distinct(rows).length,
    1,
    `the applicable-goal denominator differs by surface:${show(rows)}`,
  )
})

test('the trackable-step denominator agrees wherever it appears', () => {
  // The plan-level denominator only. Per-wave counts ("0 of 10 steps done" on
  // a wave card) are a different, legitimate denominator — the first version of
  // this test matched those too and failed on correct code.
  const rows = captured(/of (\d+) steps? in place/i)
  if (rows.length === 0) return
  assert.equal(distinct(rows).length, 1, `the step denominator differs by surface:${show(rows)}`)
})

test('no surface prints a placeholder where a name belongs', () => {
  // review-08 A8: the GUID went, and a phrase took its place in a list of
  // people — "Lachlan Robinette, an account IAMAI could not name, Dalinar
  // Kholin". A placeholder in a name list is still a failure to resolve.
  const offenders = allLines.filter(({ text }) => /could not name/i.test(text))
  assert.deepEqual(offenders.map((o) => `${o.surface}: ${o.text.slice(0, 90)}`), [], 'a placeholder is rendered where a name belongs')
})

test('no rendered sentence splices two blocked constructions', () => {
  // review-08 B5: "Blocked until Setup question 2 is still unanswered" — two
  // constructions joined, and ungrammatical as a result.
  const offenders = allLines.filter(({ text }) => /Blocked until .* is still unanswered/i.test(text))
  assert.deepEqual(offenders.map((o) => `${o.surface}: ${o.text.slice(0, 100)}`), [], 'a blocked reason splices two constructions')
})
