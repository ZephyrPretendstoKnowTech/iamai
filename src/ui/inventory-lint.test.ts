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
import { sourceFingerprint } from '../fingerprint.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
  /** Controls a screen reader would announce as nameless (prompt 40 §23). */
  unnamedControls: string[]
  // ---- contract captures (prompt 46 Part 1) ----
  /** The contract id this capture was reached under; absent on legacy captures. */
  contract?: string
  state?: string
  route?: string
  /** Elements matching .step-title, measured against stepTitleMaxWords, never as headings. */
  titles?: string[]
  /** One entry per element matching a contract repeater, measured on its own text. */
  rows?: { selector: string; text: string; sentences: number; words: number }[]
  /** Contract forbid strings found in the surface's text. */
  forbidHits?: string[]
  /** Prose outside every repeater, which is what the surface budget bounds. */
  pageProse?: { sentences: number; words: number }
}

type Contract = {
  id: string
  name: string
  status: 'built' | 'planned'
  allow: Record<string, string[]>
  budget: { sentences: number; words: number }
  rowBudget?: { sentences: number; words: number }
  forbid?: string[]
}
type Contracts = {
  enforceAll: boolean
  rules: { sentenceMaxWords: number; rowMaxSentences: number; rowMaxWords: number; blockedReasonMaxWords: number; stepTitleMaxWords: number; tipMaxWords: number }
  repeaters: string[]
  surfaces: Contract[]
}

// scripts/lint-mutations.mjs points this at a deliberately corrupted copy to
// prove each rule below still fails against a violation. Nothing else sets it.
const INVENTORY = process.env.INVENTORY_JSON ?? 'docs/qa/ui-inventory.json'
const raw = readFileSync(INVENTORY, 'utf8')
const inventory = JSON.parse(raw) as { fingerprint: string; surfaces: Surface[] }
const surfaces = inventory.surfaces

// The surface contract (docs/design/target-state.md). Rule 12 holds every
// built surface to it. Claude Code never edits it: a violation is fixed by
// removing what violates, or reported with the measured count. The env
// override exists for lint-mutations, which points the rules at a scratch
// contract to prove each check fires.
const CONTRACTS = process.env.CONTRACTS_JSON ?? 'docs/qa/page-contracts.json'
const contracts = JSON.parse(readFileSync(CONTRACTS, 'utf8')) as Contracts
const contractOf = (s: Surface): Contract | null => (s.contract ? (contracts.surfaces.find((c) => c.id === s.contract) ?? null) : null)
/** Every capture that was reached under a contract, paired with it. */
const contracted = (): { s: Surface; c: Contract }[] =>
  surfaces.flatMap((s) => {
    const c = contractOf(s)
    return c ? [{ s, c }] : []
  })
/** Exact string, or a regular expression when the allow entry is prefixed re:. */
const matchesAllow = (item: string, allow: string[]): boolean =>
  allow.some((a) => (a.startsWith('re:') ? new RegExp(a.slice(3)).test(item) : a === item))
const wordsIn = (t: string): number => t.split(/\s+/).filter(Boolean).length


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
// R1 to R3 are closed: "Not applicable to us", "Nobody needs special care"
// and "Not sure / none" are gone, leaving one way to say a thing does not
// exist yet.
const RULE5_WAIVED: Waiver[] = []

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
// L4 is closed: one continue, at the bottom, and the page's own action is
// secondary wherever there is something to continue to.
const RULE6_WAIVED: Waiver[] = [
  { id: 'R11', match: 'Roadmap: 3 primary' },
  { id: 'C18', match: 'Prompt pack: 4 primary' },
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
// R6 is closed: a row count now renders only on a table that pages.
const RULE7_WAIVED: Waiver[] = []

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
  { id: 'T7/T8', match: 'Roadmap / Plan tab:' },
  { id: 'C11', match: 'Findings / Summary tab:' },
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
// a waiver on the phrase alone waives every future occurrence too. The Scan
// subtitle and the two Roadmap tab-level surfaces closed with R8, R12 and R13.
const RULE10_WAIVED: Waiver[] = [
  { id: 'R-new', match: 'Roadmap / Plan tab: [Before anything else]' },
  { id: 'R-new', match: 'Roadmap / Plan / one step opened: [Before anything else]' },
  { id: 'R-new', match: 'Roadmap / Schedule tab: [Before anything else]' },
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

// ---- 12. the surface contract (prompt 46 Part 1) ----
//
// One test per check, and no waivers: the contract is the maximum, and a waiver
// is a way to exceed it that nobody reviewed. When a built surface renders
// something its contract does not list, the fix is to remove it, or to report
// the case with the measured count so the reviewer can change the contract.
const CONTRACT_KINDS = ['headings', 'tabs', 'tiles', 'columns', 'chips', 'buttons', 'summaries', 'links'] as const

test('rule 12: allow list — every heading, tab, tile, column, chip, button, summary and link on a built surface is in its contract', () => {
  const found = contracted().flatMap(({ s, c }) =>
    CONTRACT_KINDS.flatMap((k) => (s[k] ?? []).filter((item) => !matchesAllow(item, c.allow[k] ?? [])).map((item) => `${s.name}: ${k} "${item}" is not in contract ${c.id}`)),
  )
  assert.deepEqual(found, [], 'rendered items the contract does not list')
})

test('rule 12: forbid — no forbidden string appears on a built surface', () => {
  const found = contracted().flatMap(({ s, c }) => (s.forbidHits ?? []).map((f) => `${s.name}: "${f}" (forbidden by contract ${c.id})`))
  assert.deepEqual(found, [], 'forbidden strings on built surfaces')
})

test('rule 12: budget — page-level prose on a built surface is within its sentence and word budget', () => {
  const found = contracted().flatMap(({ s, c }) => {
    const prose = s.pageProse ?? { sentences: 0, words: 0 }
    const out: string[] = []
    if (prose.sentences > c.budget.sentences) out.push(`${s.name}: ${prose.sentences} sentences, budget ${c.budget.sentences}`)
    if (prose.words > c.budget.words) out.push(`${s.name}: ${prose.words} words, budget ${c.budget.words}`)
    return out
  })
  assert.deepEqual(found, [], 'built surfaces over their prose budget')
})

test('rule 12: rows — every repeater row on a built surface is within the row budget', () => {
  const found = contracted().flatMap(({ s, c }) => {
    const rb = c.rowBudget ?? { sentences: contracts.rules.rowMaxSentences, words: contracts.rules.rowMaxWords }
    return (s.rows ?? [])
      .filter((r) => r.sentences > rb.sentences || r.words > rb.words)
      .map((r) => `${s.name}: ${r.selector} ${r.sentences} sentences / ${r.words} words (budget ${rb.sentences} / ${rb.words}) — ${r.text.slice(0, 60)}`)
  })
  assert.deepEqual(found, [], 'rows over the row budget')
})

test('rule 12: titles — every step title on a built surface is within stepTitleMaxWords', () => {
  const max = contracts.rules.stepTitleMaxWords
  const found = contracted().flatMap(({ s }) => (s.titles ?? []).filter((t) => wordsIn(t) > max).map((t) => `${s.name}: ${wordsIn(t)} words — ${t}`))
  assert.deepEqual(found, [], `step titles over ${max} words`)
})

test('rule 12: enforceAll — when the contract file says so, every inventory surface has a contract', () => {
  if (!contracts.enforceAll) return
  const found = surfaces.filter((s) => !contractOf(s)).map((s) => `${s.name}: no contract`)
  assert.deepEqual(found, [], 'surfaces without a contract while enforceAll is true')
})

test('rule 13: every control on every surface has an accessible name (prompt 40 §23)', () => {
  // Read from the rendered DOM, not the source. The sidebar chevron was carried
  // forward through two reviews as unlabelled; it is labelled, and what was
  // actually nameless was a country search input with only a placeholder. Only
  // the DOM can tell those two apart.
  const bad = surfaces.flatMap((s) => (s.unnamedControls ?? []).map((html) => `${s.name}: ${html}`))
  assert.deepEqual(bad, [], `${bad.length} control(s) a screen reader would announce as nameless:\n${bad.join('\n')}`)
})
