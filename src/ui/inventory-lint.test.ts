// Lint rules over the UI inventory (prompt 36 §2). Each rule is a test.
//
// The rules read `docs/qa/ui-inventory.json`, the machine copy written beside
// the markdown by `npm run inventory`. Three of them (one primary button per
// page, row-count labels, a claim printed twice on one page) are about how
// something is rendered, which no scan of the copy modules can see; the
// inventory is the only place that knowledge exists.
//
// A stale inventory would let every rule pass on copy nobody has looked at, so
// the fingerprint of the copy and UI source is checked first and a mismatch
// fails outright.
//
// Known violations are waived by review id, not silently. A waiver asserts the
// violation still exists, so the list cannot rot, and nothing new can be added
// without a finding to point at. New violations of any rule fail the build.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

type Table = { label: string; paginated: boolean }
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
  primary: string[]
  tables: Table[]
  occurrences: Record<string, number>
  occurrencesAll: Record<string, number>
}

// scripts/lint-mutations.mjs points this at a deliberately corrupted copy to
// prove each rule below still fails against a violation. Nothing else sets it.
const INVENTORY = process.env.INVENTORY_JSON ?? 'docs/qa/ui-inventory.json'
const raw = readFileSync(INVENTORY, 'utf8')
const inventory = JSON.parse(raw) as { fingerprint: string; surfaces: Surface[] }
const surfaces = inventory.surfaces

function sourceFingerprint(): string {
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p)
    }
  }
  walk('src/copy')
  walk('src/ui')
  files.sort()
  const h = createHash('sha256')
  for (const f of files) h.update(f.replace(/\\/g, '/')).update(readFileSync(f))
  return h.digest('hex').slice(0, 16)
}

test('the inventory matches the source it was generated from', () => {
  assert.equal(
    inventory.fingerprint,
    sourceFingerprint(),
    'the copy or UI source changed since the inventory was generated. Run `npm run inventory` and commit the result: every rule below reads it, and a stale inventory passes them all on copy nobody has seen.',
  )
})

// ---- the waivers ----
//
// Each entry names the review finding that will remove it. Prompts 37 to 39
// empty these lists; nothing is added without a finding id.
type Waiver = { id: string; match: string }
const waived = (list: Waiver[], text: string): boolean => list.some((w) => text.includes(w.match))

/** Every violation a rule finds, minus the ones a finding already covers. */
function unwaived(found: string[], list: Waiver[]): string[] {
  return found.filter((f) => !waived(list, f))
}

/** A waiver that no longer matches anything is a waiver that should be deleted. */
function stale(found: string[], list: Waiver[]): string[] {
  return list.filter((w) => !found.some((f) => f.includes(w.match))).map((w) => `${w.id}: ${w.match}`)
}

const allOptions = (): { surface: string; label: string }[] =>
  surfaces.flatMap((s) => s.options.map((label) => ({ surface: s.name, label })))

const userFacing = (s: Surface): string[] => [
  ...s.headings, ...s.tabs, ...s.buttons, ...s.options, ...s.links,
  ...s.chips, ...s.columns, ...s.tiles, ...s.empty, ...s.summaries, ...s.tips, ...s.sentences,
]

// ---- 5. two option labels that mean the same thing ----
//
// A curated map, because meaning is not derivable from the strings: "Looks
// right" and "This is correct" share no words. Seeded from review-07-findings
// C2, R1, R2 and R3; extend it whenever a review finds a new instance.
const SYNONYMS: { concept: string; labels: string[] }[] = [
  { concept: 'confirm what IAMAI already detected', labels: ['looks right', 'this is correct', 'detections look right'] },
  { concept: 'decline the question', labels: ['not applicable to us', 'nobody needs special care', 'not sure / none'] },
]
// C2 is closed: prompt 36 item 13 made "Looks right" the one confirm label, so
// the group above now has a single member and the rule passes on it unwaived.
// The retired labels stay in the group as a tripwire against their return.
const RULE5_WAIVED: Waiver[] = [{ id: 'R1/R2/R3', match: 'decline the question' }]

test('rule 5: no concept is expressed by more than one option label', () => {
  const options = allOptions()
  const found = SYNONYMS.flatMap((group) => {
    const present = group.labels.filter((l) => options.some((o) => o.label.toLowerCase().trim() === l))
    return present.length > 1 ? [`${group.concept}: ${present.length} labels (${present.join(' / ')})`] : []
  })
  assert.deepEqual(stale(found, RULE5_WAIVED), [], 'waivers that no longer match anything')
  assert.deepEqual(unwaived(found, RULE5_WAIVED), [], 'a concept with more than one label')
})

// ---- 6. one primary button per surface ----
const RULE6_WAIVED: Waiver[] = [
  { id: 'L4', match: 'Start: 2 primary' },
  { id: 'L4', match: 'Baseline: 2 primary' },
  { id: 'L4', match: 'Scan: 2 primary' },
  { id: 'C18', match: 'Prompt pack: 4 primary' },
  { id: 'R11', match: 'Roadmap: 3 primary' },
  { id: 'R21', match: 'Q3 — Which countries do your people sign in from?: 3 primary' },
]

test('rule 6: a surface offers one primary action', () => {
  const found = surfaces
    .filter((s) => s.primary.length > 1)
    .map((s) => `${s.name}: ${s.primary.length} primary (${[...new Set(s.primary)].join(' / ')})`)
  assert.deepEqual(stale(found, RULE6_WAIVED), [], 'waivers that no longer match anything')
  assert.deepEqual(unwaived(found, RULE6_WAIVED), [], 'surfaces with more than one primary action')
})

// ---- 7. no row count on a table that does not paginate ----
// Scoped to the surfaces that have them today. Waiving on the word "entries"
// alone would waive every future violation too, which is how a waiver quietly
// turns a rule off.
const RULE7_WAIVED: Waiver[] = [
  { id: 'R6', match: 'Every check IAMAI runs:' },
  { id: 'R6', match: 'What IAMAI reads:' },
  { id: 'R6', match: 'Connect / permissions disclosure:' },
  { id: 'R6', match: 'Scan / Readiness tab:' },
  { id: 'R6', match: 'Scan / Inventory tab:' },
  { id: 'R6', match: 'Licensing guide:' },
]

test('rule 7: a row-count label appears only on a table that paginates', () => {
  const found = surfaces.flatMap((s) =>
    s.tables.filter((t) => !t.paginated && /\d+\s+(entry|entries)/i.test(t.label)).map((t) => `${s.name}: "${t.label}"`),
  )
  assert.deepEqual(stale(found, RULE7_WAIVED), [], 'waivers that no longer match anything')
  assert.deepEqual(unwaived(found, RULE7_WAIVED), [], 'row-count labels on tables that do not paginate')
})

// ---- 8. no sentence over 25 words ----
const MAX_WORDS = 25
// Twenty sentences across nine surfaces, all of them generated plan prose
// rather than authored copy: blocked reasons that concatenate every cause,
// bulletin bodies that list every step, a step's Why section carrying Microsoft
// product text. 37 rewrites the blocked reasons (T7, T8) and the bulletins
// (S1); 38 rewrites the Start page (C1) and the step Why (C12).
const RULE8_WAIVED: Waiver[] = [
  { id: 'S1', match: 'Roadmap / Schedule tab:' },
  { id: 'C12', match: 'Roadmap / Plan / one step opened:' },
  { id: 'P1', match: 'Connect / permissions disclosure:' },
  { id: 'T7/T8', match: 'Roadmap / Plan tab:' },
  { id: 'P1', match: 'What IAMAI reads:' },
  { id: 'C1', match: 'Start:' },
  { id: 'C11', match: 'Findings / Summary tab:' },
  { id: 'T3', match: 'Roadmap / Progress tab:' },
  { id: 'C16', match: 'Every check IAMAI runs:' },
]
test(`rule 8: no user-facing sentence runs past ${MAX_WORDS} words`, () => {
  const found = surfaces.flatMap((s) =>
    s.sentences
      .filter((t) => t.split(/\s+/).filter(Boolean).length > MAX_WORDS)
      .map((t) => `${s.name}: ${t.split(/\s+/).length} words — ${t.slice(0, 70)}`),
  )
  assert.deepEqual(stale(found, RULE8_WAIVED), [], 'waivers that no longer match anything')
  assert.deepEqual(unwaived(found, RULE8_WAIVED), [], 'sentences over the limit')
})

// ---- 9. no id in anything a person reads ----
const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
// The truncated form the review caught: eight hex characters then an ellipsis.
const TRUNCATED_ID = /\b[0-9a-f]{8}[…]|\b[0-9a-f]{8}\.\.\./i
// The tenant id is printed in the header's tooltip. Not the instance T9 caught
// (that one needs a real directory), but the same defect: an id where a person
// reads. 37 §9 removes it.
const RULE9_WAIVED: Waiver[] = [{ id: 'T9', match: 'Tenant ID' }]

test('rule 9: no user-facing string carries an id, whole or truncated', () => {
  const found = surfaces.flatMap((s) =>
    userFacing(s).filter((t) => GUID.test(t) || TRUNCATED_ID.test(t)).map((t) => `${s.name}: ${t.slice(0, 80)}`),
  )
  assert.deepEqual(stale(found, RULE9_WAIVED), [], 'waivers that no longer match anything')
  assert.deepEqual(unwaived(found, RULE9_WAIVED), [], 'ids shown to a person')
})

// ---- 10. filler ----
//
// Seeded from the review. "nothing leaves the browser" is allowed once, in the
// footer; the inventory reads only main.page, so any occurrence here is a
// second one.
const FILLER: { phrase: RegExp; why: string }[] = [
  { phrase: /before anything else/i, why: 'Before anything else' },
  { phrase: /it'?s worth noting/i, why: "It's worth noting" },
  { phrase: /in the evidence window/i, why: 'in the evidence window' },
  { phrase: /inside the \d+[- ]day drill window/i, why: 'inside the N-day drill window' },
  { phrase: /nothing leaves (your|the) browser/i, why: 'nothing leaves the browser, outside the footer' },
]
// "before anything else" is the blocker step's own plain title, added in
// prompt 32 and caught here by the review's own seed list. 38 rewrites it.
// Scoped to the surfaces that hold them today, for the reason given on rule 7:
// a waiver on the phrase alone waives every future occurrence too.
const RULE10_WAIVED: Waiver[] = [
  { id: 'R8', match: 'Start: [nothing leaves the browser' },
  { id: 'R8', match: 'Scan: [nothing leaves the browser' },
  { id: 'R-new', match: 'Roadmap: [Before anything else]' },
  { id: 'R-new', match: 'Roadmap / Plan tab: [Before anything else]' },
  { id: 'R-new', match: 'Roadmap / Plan / one step opened: [Before anything else]' },
  { id: 'R-new', match: 'Roadmap / Schedule tab: [Before anything else]' },
  { id: 'R-new', match: 'Prompt pack: [Before anything else]' },
]

test('rule 10: no filler phrases', () => {
  const found = surfaces.flatMap((s) =>
    userFacing(s).flatMap((t) =>
      FILLER.filter((f) => f.phrase.test(t)).map((f) => `${s.name}: [${f.why}] ${t.slice(0, 70)}`),
    ),
  )
  assert.deepEqual(stale(found, RULE10_WAIVED), [], 'waivers that no longer match anything')
  assert.deepEqual(unwaived(found, RULE10_WAIVED), [], 'filler phrases')
})

// ---- 11. one claim, printed once ----
//
// Counted over page-level prose only. A list of eight steps that each state
// their own blocked reason repeats that sentence eight times and is not a
// defect; the inventory records those separately (`occurrencesAll`) and this
// rule ignores them, because a rule that fires on every list is a rule nobody
// can act on.
// Both from the blocker step built in prompt 32, which uses one string for
// both `whatChanges` and `rollback`, so an opened step prints it twice.
const RULE11_WAIVED: Waiver[] = [
  { id: 'R-new', match: 'Nothing changes for anyone.' },
  { id: 'R-new', match: 'This is groundwork so a mistake later can be undone.' },
]

test('rule 11: no surface states the same claim twice', () => {
  const found = surfaces.flatMap((s) =>
    Object.entries(s.occurrences)
      .filter(([, n]) => n > 1)
      .map(([claim, n]) => `${s.name}: ${n}× — ${claim.slice(0, 70)}`),
  )
  assert.deepEqual(stale(found, RULE11_WAIVED), [], 'waivers that no longer match anything')
  assert.deepEqual(unwaived(found, RULE11_WAIVED), [], 'claims printed more than once on one surface')
})
