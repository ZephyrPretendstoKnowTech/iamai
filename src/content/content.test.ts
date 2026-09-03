// Prompt 51 Part 1: the content loader and renderer. These tests prove no
// sentence is invented and no forbidden vocabulary leaks, and that every
// content string is consumed by a renderer.
//
// The full "every content key is used by a live surface" mapping completes as
// the surfaces are wired (Parts 4-6); here it is asserted against the review
// layer, which renders every step, cleanup entry and page from the file.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { content } from './content.ts'
import { reviewBody } from './render.ts'

test('no rendered sentence carries a forbidden word or a broken value', () => {
  const body = reviewBody()
  const contract = JSON.parse(readFileSync('docs/qa/page-contracts.json', 'utf8')) as { forbidEverywhere: string[] }
  const hits: string[] = []
  // The contract's forbidEverywhere already carries `undefined` and `**`. The
  // tokens are ordinary words, never HTML syntax, so a raw scan of the rendered
  // body is exact. The deliberate {orange} example-gap markers are `{key}`.
  for (const token of contract.forbidEverywhere) {
    if (body.includes(token)) hits.push(token)
  }
  assert.deepEqual(hits, [], `rendered text contains forbidden token(s): ${hits.join(', ')}`)
})

// Every content leaf string that is not surfaced by the review renderer, once
// the structural keys (ids, risk predicates, picker sources) are set aside.
// Each is a string the renderer HAS a code path for but this example's data does
// not trigger (a conditional who-line, a "none recognised" variant) or a page
// string the review page omits but the app surfaces render. A NEW entry here
// means a content string no renderer consumes — a genuine orphan — and fails.
const EXAMPLE_SUPPRESSED_OR_APP_ONLY = [
  '.shared.doesntApplyPrompt',
  '.shared.licenceRule',
  // Shared references the portal translator can emit but this example's mapped
  // policies do not trigger: portalOpen is the change-to-an-existing-policy
  // opener (every mapped policy here is created new), syncRoleNote is the
  // directory-sync caveat (no synced account in the example).
  '.shared.portalOpen',
  '.shared.syncRoleNote',
  // The two gates with today's numbers render only on a step whose policy the
  // scan found in report-only (doneWhen.ts); the review's example steps are all new.
  '.shared.policyDoneWhenTracked[0]',
  '.shared.policyDoneWhenTracked[1]',
  '.pages.home.metaTitle',
  '.pages.connectNoScan.baselineUpdatedNote',
  '.pages.plan.gapSuffix.guests-mfa',
  '.pages.today.activeTip',
  '.pages.today.columns[2]',
  '.pages.today.inventory',
  '.pages.export.unredactedWarning',
  '.pages.how.tip',
  '.steps[1].who.none',
  '.steps[3].decision.location.none',
  '.steps[5].who.none',
  '.steps[5].whatToDo.steps[3]',
  '.steps[6].who.none',
  '.steps[10].who.match',
  '.steps[16].who.groups.noMethod',
  '.steps[16].who.groups.insufficient',
  '.steps[16].who.groups.pushOnly',
  '.steps[16].who.groups.possiblyBroken',
  '.steps[16].who.groups.holdouts',
  '.steps[16].who.adminsNote',
  '.steps[17].who.evidence[1]',
  // Directory-role holders who use the same account for mail or Teams (E6), on the
  // three admin policies (15, 23, 33); the examples list none. The lockout lists
  // (E8) render through their count lines, so those are no longer suppressed.
  '.steps[18].who.evidence[3]',
  '.steps[26].who.evidence[2]',
  '.steps[36].who.evidence[2]',
  '.steps[19].who.evidence[0]',
  // Azure sign-ins by people with no directory role (step-audit item 16); the example lists none.
  '.steps[19].who.evidence[2]',
  '.steps[20].who.evidence[1]',
  '.steps[21].who.evidence[0]',
  '.steps[22].who.evidence[0]',
  // The countries block's usage line and its partner line (E9): the example lists nobody outside and no partner.
  '.steps[25].who.evidence[0]',
  '.steps[25].who.evidence[1]',
  // Eligible admins with no passkey or key yet (step-audit item 33); the example lists none.
  '.steps[36].who.evidence[0]',
  '.steps[37].who.evidence[0]',
  '.steps[38].who.evidence[1]',
  '.steps[39].who.evidence[0]',
  '.steps[40].who.evidence[1]',
  '.steps[41].who.evidence[1]',
  // The service-accounts block's none line (E9); the example has service accounts.
  '.steps[43].who.none',
]

// whatToDoReference is a policy step's reviewer-only reference block (prompt 52
// Part 2): the product renders the translator's output from the baseline, never
// these lines, and the review page swaps them for the translation wherever the
// goal is mapped. It is documentation, not rendered content, so it is set aside
// like the structural keys; a separate test proves no product renderer reads it.
// pages.app holds the words the app chrome and the surfaces show (the header, the scan
// progress, the print cover, the export alerts): read by the product, never by the review page.
// shared.deviation and shared.devicePlan are words the engine writes into a
// step's facts from a stored answer (stepPortal.ts, stepVars.ts), and the
// footer's shared device line is the Not licensed group's (derive/notLicensed.ts):
// read by the product, never by the review page.
const isAppOnly = (p: string): boolean => p.startsWith('.pages.app.') || p.startsWith('.shared.engine.') || p.startsWith('.shared.deviation.') || p.startsWith('.shared.devicePlan.') || p === '.pages.plan.footer.notLicensedDevices'
const isStructural = (p: string): boolean =>
  /\.id$/.test(p) || /\.href$/.test(p) || /\.applies$/.test(p) || /pickerSource$/.test(p) || /\.kind$/.test(p) || /\.multi$/.test(p) || /\.mergesGoals\b/.test(p) || /\.learn\.url$/.test(p) || /\.whatToDoReference\b/.test(p)

test('no orphan content string: every non-structural key renders, or is a known example-suppressed / app-only variant', () => {
  const body = reviewBody()
  const escHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
  const leaves: [string, string][] = []
  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      leaves.push([path, node])
      return
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`))
      return
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'example' || k === '$comment' || k === 'version') continue
        walk(v, `${path}.${k}`)
      }
    }
  }
  walk(content, '')
  const miss: string[] = []
  for (const [path, s] of leaves) {
    if (isStructural(path) || isAppOnly(path)) continue
    const frags = s.split(/\{[^}]*\}/).map((f) => f.replace(/\s+/g, ' ').trim()).filter((f) => f.length >= 12)
    if (frags.length === 0) continue // a string that is entirely variables
    if (frags.some((f) => body.includes(f) || body.includes(escHtml(f)))) continue
    miss.push(path)
  }
  assert.deepEqual(miss.sort(), [...EXAMPLE_SUPPRESSED_OR_APP_ONLY].sort(), 'the set of non-rendered content strings changed; a new entry is a content key no renderer consumes')
})

// Prompt 52 Part 2: a policy step's whatToDoReference is the reviewer's reference
// portal lines; the product generates What-to-do from the baseline policy
// (src/ui/surfaces/stepPortal.ts) and must never read the reference. Only the
// review renderer (render.ts) and the translator dump (scripts/translator-dump.ts)
// may name it. This walks the source and fails if a product renderer references
// whatToDoReference, whichever surface it is written on.
test('no product renderer reads whatToDoReference (prompt 52 Part 2)', () => {
  const ALLOWED = new Set(['src/content/render.ts', 'src/content/content.test.ts'])
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name).split('\\').join('/')
      if (e.isDirectory()) {
        walk(p)
      } else if (/\.(ts|tsx)$/.test(e.name) && !ALLOWED.has(p)) {
        if (readFileSync(p, 'utf8').includes('whatToDoReference')) offenders.push(p)
      }
    }
  }
  walk('src')
  assert.deepEqual(offenders, [], 'a product renderer references whatToDoReference; it must render the baseline translation instead')
})
