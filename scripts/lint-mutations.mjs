// Mutation testing for the UI lint rules (prompt 37).
//
// A lint rule that passes proves nothing on its own: a rule with an over-broad
// waiver, a typo in its regex, or an empty input set also passes, and passes
// quietly forever. Prompt 36 verified each rule by hand once. Doing it once is
// how a rule rots, so this runs it every time.
//
// Each mutation appends a surface to a throwaway copy of the inventory with
// exactly one violation on it, then asserts that the rule which owns that
// violation fails. A rule that stays green against its own violation is a rule
// that is no longer checking anything, and this script exits non-zero.
//
// The probe surface is deliberately not named after any real page, so no
// waiver can match it: waivers are scoped to the surfaces that hold today's
// known violations, and a waiver broad enough to cover the probe is a waiver
// broad enough to hide the next real violation too. That is the second thing
// this script tests.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SOURCE = 'docs/qa/ui-inventory.json'
const CONTRACT_SOURCE = 'docs/qa/page-contracts.json'
const TEST = 'src/ui/inventory-lint.test.ts'

// A scratch contract with one built surface (prompt 46 Part 1 item 5). The real
// contract is never edited; every rule 12 check is proved against this one.
const probeContract = (over = {}) => ({
  version: 1,
  enforceAll: false,
  rules: { sentenceMaxWords: 25, rowMaxSentences: 2, rowMaxWords: 30, blockedReasonMaxWords: 12, stepTitleMaxWords: 9, tipMaxWords: 25 },
  repeaters: ['tr'],
  mockStates: ['scanned'],
  surfaces: [
    {
      id: 'mutation-probe',
      name: 'Mutation probe',
      status: 'built',
      reach: { route: '/probe', state: 'scanned' },
      allow: { headings: ['Allowed heading'], tabs: [], tiles: [], columns: [], chips: [], buttons: ['re:^Allowed .+$'], summaries: [], links: [] },
      budget: { sentences: 2, words: 20 },
      forbid: ['Forbidden phrase'],
    },
  ],
  ...over,
})

/** An inventory surface with every field present and nothing in any of them. */
const blankSurface = (name) => ({
  name,
  note: 'injected by scripts/lint-mutations.mjs',
  headings: [], tabs: [], buttons: [], options: [], links: [], chips: [],
  columns: [], tiles: [], empty: [], summaries: [], tips: [], sentences: [],
  nav: [], primary: [], tables: [], occurrences: {}, occurrencesAll: {},
  wordCounts: {}, titles: [], rows: [], forbidHits: [], pageProse: { sentences: 0, words: 0 },
})

/** A probe reached under the scratch contract, with nothing on it. */
const contractedSurface = (name) => ({ ...blankSurface(name), contract: 'mutation-probe', state: 'scanned', route: '/probe' })

// One violation each, in the shape the rule that owns it looks for.
const MUTATIONS = [
  {
    rule: 'rule 5:',
    what: 'two labels for one concept',
    // Both labels, so the mutation stands on its own if the build stops
    // shipping either of them.
    apply: (s) => { s.options.push('Looks right', 'This is correct') },
  },
  {
    rule: 'rule 6:',
    what: 'a second primary action on one surface',
    apply: (s) => { s.primary.push('Do the thing', 'Do the other thing') },
  },
  {
    rule: 'rule 7:',
    what: 'a row count on a table that does not paginate',
    apply: (s) => { s.tables.push({ label: '9 entries', paginated: false }) },
  },
  {
    rule: 'rule 8:',
    what: 'a sentence past the word limit',
    apply: (s) => {
      s.sentences.push(
        'This sentence exists only to run past the limit the rule sets, and it keeps ' +
        'going well beyond that limit so there is no argument about whether it counts.',
      )
    },
  },
  {
    rule: 'rule 9:',
    what: 'a whole id in user-facing text',
    apply: (s) => { s.sentences.push('Excluded: 3f2b9c14-7d85-4a61-b0e2-5c9a18d4f7e3.') },
  },
  {
    rule: 'rule 9:',
    what: 'a truncated id in user-facing text',
    apply: (s) => { s.sentences.push('Excluded: 6744cba6… and two others.') },
  },
  {
    rule: 'rule 10:',
    what: 'a filler phrase',
    apply: (s) => { s.sentences.push('Before anything else, the plan needs a way back.') },
  },
  {
    rule: 'rule 11:',
    what: 'one claim printed twice on a page',
    apply: (s) => { s.occurrences['This claim is stated twice on one page.'] = 2 },
  },
  // ---- rule 12: the surface contract (prompt 46 Part 1) ----
  {
    rule: 'rule 12: allow',
    what: 'a heading the contract does not list',
    contracted: true,
    apply: (s) => { s.headings.push('Allowed heading', 'A heading nobody agreed to') },
  },
  {
    rule: 'rule 12: allow',
    what: 'a button that misses the contract pattern',
    contracted: true,
    apply: (s) => { s.buttons.push('Allowed action', 'Forbidden action') },
  },
  {
    rule: 'rule 12: forbid',
    what: 'a forbidden string on a built surface',
    contracted: true,
    apply: (s) => { s.forbidHits.push('Forbidden phrase') },
  },
  {
    rule: 'rule 12: budget',
    what: 'page prose over the sentence budget',
    contracted: true,
    apply: (s) => { s.pageProse = { sentences: 3, words: 12 } },
  },
  {
    rule: 'rule 12: budget',
    what: 'page prose over the word budget',
    contracted: true,
    apply: (s) => { s.pageProse = { sentences: 1, words: 21 } },
  },
  {
    rule: 'rule 12: rows',
    what: 'a row over the row budget',
    contracted: true,
    apply: (s) => { s.rows.push({ selector: 'tr', text: 'A row that says too much. And keeps saying it. And again.', sentences: 3, words: 12 }) },
  },
  {
    rule: 'rule 12: titles',
    what: 'a step title over stepTitleMaxWords',
    contracted: true,
    apply: (s) => { s.titles.push('A step title that runs on for far more than nine words in total') },
  },
  {
    rule: 'rule 12: enforceAll',
    what: 'a surface with no contract while enforceAll is true',
    contract: () => probeContract({ enforceAll: true }),
    apply: () => {},
  },
]

const base = JSON.parse(readFileSync(SOURCE, 'utf8'))
const dir = mkdtempSync(join(tmpdir(), 'iamai-lint-'))

/** Which rule tests failed against this inventory. */
function failingRules(path, contractPath = CONTRACT_SOURCE) {
  let out = ''
  try {
    out = execFileSync(process.execPath, ['--test', '--test-reporter=tap', TEST], {
      encoding: 'utf8', env: { ...process.env, INVENTORY_JSON: path, CONTRACTS_JSON: contractPath }, stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    // A failing test run exits non-zero; the TAP output is what we came for.
    out = `${err.stdout ?? ''}${err.stderr ?? ''}`
  }
  return [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1].trim())
}

// The unmutated inventory must be green, or every result below is meaningless.
const baselineFailures = failingRules(SOURCE)
if (baselineFailures.length > 0) {
  console.error('lint-mutations: the lint rules already fail before any mutation:')
  for (const f of baselineFailures) console.error(`  ${f}`)
  console.error('\nFix those first. Mutation testing cannot say anything while the baseline is red.')
  process.exit(1)
}

const results = []
for (const [i, m] of MUTATIONS.entries()) {
  const copy = JSON.parse(JSON.stringify(base))
  const probe = m.contracted ? contractedSurface(`Mutation probe ${i + 1}`) : blankSurface(`Mutation probe ${i + 1}`)
  m.apply(probe)
  copy.surfaces.push(probe)
  const path = join(dir, `inventory-${i}.json`)
  writeFileSync(path, JSON.stringify(copy))
  // A contract mutation runs against the scratch contract; everything else
  // against the real one, so a rule that only fires under the scratch contract
  // is still proved to leave the shipped inventory alone.
  let contractPath = CONTRACT_SOURCE
  if (m.contracted || m.contract) {
    contractPath = join(dir, `contract-${i}.json`)
    writeFileSync(contractPath, JSON.stringify(m.contract ? m.contract() : probeContract()))
  }
  const failed = failingRules(path, contractPath)
  const caught = failed.some((name) => name.startsWith(m.rule))
  results.push({ ...m, caught, alsoFailed: failed.filter((n) => !n.startsWith(m.rule)) })
}

const width = Math.max(...results.map((r) => r.what.length))
for (const r of results) {
  console.log(`${r.caught ? 'caught ' : 'MISSED '} ${r.rule.padEnd(20)} ${r.what.padEnd(width)}`)
  for (const other of r.alsoFailed) console.log(`         also failed: ${other}`)
}

const missed = results.filter((r) => !r.caught)
if (missed.length > 0) {
  console.error(`\nlint-mutations: ${missed.length} of ${results.length} violations went undetected.`)
  console.error('A rule that passes against its own violation is not checking anything. The usual')
  console.error('cause is a waiver matching on text broad enough to cover violations nobody has')
  console.error('seen yet; scope the waiver to the surfaces that hold the known ones.')
  process.exit(1)
}
console.log(`\nlint-mutations: all ${results.length} injected violations were caught.`)
