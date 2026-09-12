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

// The step surfaces' own forbidden vocabulary, checked on the file rather than
// on a rendered page. A step's words come from here, so a phrase the contract
// bans on plan.step or plan.step.more is a defect in the content: the surface
// check can only see the steps a fixture happens to draw, and a free-tier rung
// or a validation blocker is drawn by no fixture the walk visits. The reviewer's
// transcription of the portal (whatToDoReference) is never on screen, and the
// engine's own words (shared.engine) and the pages render outside a step.
test('no step string carries a phrase the step surfaces forbid', () => {
  const contract = JSON.parse(readFileSync('docs/qa/page-contracts.json', 'utf8')) as { surfaces: { id: string; forbid?: string[] }[] }
  const forbid = [...new Set(['plan.step', 'plan.step.more'].flatMap((id) => contract.surfaces.find((s) => s.id === id)?.forbid ?? []))]
  assert.ok(forbid.length > 0, 'the step surfaces name the vocabulary they forbid')
  const hits: string[] = []
  const scan = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      if (path.includes('whatToDoReference')) return
      for (const f of forbid) if (node.includes(f)) hits.push(`${path}: "${f}"`)
    } else if (Array.isArray(node)) {
      node.forEach((v, i) => scan(v, `${path}[${i}]`))
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) if (k !== 'example' && k !== '$comment') scan(v, path ? `${path}.${k}` : k)
    }
  }
  scan({ steps: content.steps, cleanup: content.cleanup, shared: { ...content.shared, engine: undefined } }, '')
  assert.deepEqual(hits, [], `content carries wording the step surfaces forbid: ${hits.join(', ')}`)
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
  // The two lines a change to an existing policy adds under portalOpen: the
  // "only these fields" note and the enable-and-save line. Every mapped policy
  // in the example is created new, so neither is emitted here.
  '.shared.changeUntouched',
  // What a message says about a date the roadmap projected but nothing has
  // earned (roadmap/forecast.ts): the paragraph the email and the prompt pack's
  // draft add under the day they name. It is composed at render time from the
  // step's lifecycle, and the review page has no lifecycle to read.
  '.shared.commsForecastNote',
  '.shared.enableLine',
  '.shared.syncRoleNote',
  // The two gates with today's numbers render only on a step whose policy the
  // scan found in report-only (doneWhen.ts); the review's example steps are all new.
  '.shared.policyDoneWhenTracked[0]',
  '.shared.policyDoneWhenTracked[1]',
  // The same reason once more, one stage further on: the completion of a policy
  // whose gates have closed, and the way back from an enforcement that only
  // turned an existing policy on. Both need a scan that found the policy in
  // report-only and ready (doneWhen.ts, stepExport.ts ifWrongLineFor).
  '.shared.policyDoneWhenEnforced[0]',
  // The completion of a User Action policy, whose readiness is its configuration
  // because Microsoft does not evaluate it in report-only (roadmap/evidenceStrategy.ts,
  // doneWhen.ts): the review page's example plans create no User Action policy.
  '.shared.policyDoneWhenConfiguration[0]',
  // Connect's note and MFA Readiness's headline for a scan that holds no sign-in
  // proof (scoring/fromSnapshot.ts signInProofRead): the review page's example
  // scan read its proof.
  '.pages.connect.scan.complete.degraded',
  '.pages.readiness.summaryUnmeasured',
  '.shared.enforceIfWrong',
  // The Dates line of a policy already in report-only with nothing left to
  // submit but the enforcement its window has not earned (stepExport.ts
  // datesLineFor, over roadmap/forecast.ts): the same reason again — the review
  // page has no scan, so no example step is in report-only.
  '.shared.datesObserve',
  // And the Dates line of a policy the scan found materially changed to
  // something the plan did not ask for, held until somebody has looked at it
  // (roadmap/lifecycle.ts heldForReview): a scan-to-scan condition, and the
  // review page compares no two scans.
  '.shared.datesReview',
  // The row's date column for that same step, for the same reason.
  '.pages.plan.heldForReview',
  // The Plan's length tip and Connect's sample tile for a plan that cannot finish
  // yet: the length is the rollout's estimate (derive/finish.ts planWeeks), a
  // state the review page's example plan is not in.
  '.pages.plan.lengthTipEstimate',
  // What holds a policy no step of the plan clears, on its row (roadmap/stateReason.ts
  // holdReasonFor): a state the review page's example plan is not in.
  '.pages.plan.blocked.unsettled',
  // The campaign email while the plan dates nothing (stepExport.ts commsFor): the
  // review page's example plan dates its enforcement, so it renders the dated body.
  '.steps[16].comms.bodyUndated',
  '.pages.plan.blocked.pairUnmatched',
  '.pages.plan.blocked.noOperation',
  // A4 (2026-09-12): the row reasons for a correction only a person can make and
  // for a group the scan could not read (copy/reasons.ts BLOCKED_REASON).
  '.pages.plan.blocked.manualCorrection',
  '.pages.plan.blocked.unverifiedExclusion',
  // The authentication methods policy the scan could not read (A5, copy/reasons.ts BLOCKED_REASON).
  '.pages.plan.blocked.methodsPolicyUnread',
  // The Plan usability pass (2026-09-11): words the Plan, its settings and its
  // decision layout read that the review body does not draw.
  '.pages.plan.blocked.devicePlan',
  '.pages.plan.howTo.items[0]',
  '.pages.plan.howTo.items[1]',
  '.pages.plan.howTo.items[2]',
  '.pages.plan.howTo.items[3]',
  '.pages.plan.howTo.items[4]',
  '.pages.plan.howTo.link',
  '.pages.plan.impact.configurationOnly',
  '.pages.plan.impact.noUserImpact',
  '.pages.plan.impact.notEstablished',
  '.pages.plan.settings.firstDeployment',
  '.pages.plan.settings.firstDeploymentNote',
  // The change freeze's two rejection messages (A2, R-SCHED §6): a from-only
  // freeze, or one ending before it starts, shown by Plan settings alone.
  '.pages.plan.settings.freezeNeedsTo',
  '.pages.plan.settings.freezeOrder',
  '.pages.plan.settings.workdays',
  '.pages.plan.settings.workdaysWeek',
  '.pages.plan.settings.workdaysWith',
  '.steps[12].decision.strict.heading',
  '.steps[12].decision.strict.text',
  '.steps[12].decision.text',
  '.pages.plan.blocked.emergency',
  '.pages.connect.plan.sample.weeksEstimate',
  // And the same column for a policy whose observation window closed on records
  // that have not cleared it (rowWhen.ts, derive/readyWhen.ts kind `since`):
  // also a reading of a scan, which the review page does not have.
  '.pages.plan.heldForEvidence',
  // And the same row's reason line for a goal the tenant already delivers:
  // which of its own policies satisfies the baseline (rowWhen.ts rowReason,
  // over the classifier's own `Step.satisfiedBy`). It is a reading of a scan's
  // classified coverage, and the review page's example steps are classified
  // against nothing. The second is its plural: the goal no one policy covers
  // alone.
  '.pages.plan.satisfiedBy',
  '.pages.plan.satisfiedTogether',
  '.pages.home.metaTitle',
  '.pages.plan.gapSuffix.guests-mfa',
  '.pages.export.unredactedWarning',
  '.pages.how.tip',
  // Connect's tile 1 in the demo (task 026): the sample tenant is loaded and
  // nobody is signed in, so the tile names the sample rather than an account.
  // The review page has one Connect, and it is the signed-in one.
  '.pages.connect.account.sampleTitle',
  '.pages.connect.account.sampleNote',
  // The exclusions group's not-in-use states (Foundation C): the review's
  // example has a group in use, so none of their lines render. The suggestion
  // line is not here — it shares its "members · excluded from" wording with the
  // in-use line, which does render.
  '.steps[1].who.unverified',
  '.steps[1].who.missing',
  '.steps[1].who.several',
  '.steps[1].who.cannotTell',
  '.steps[1].who.none',
  '.steps[3].decision.location.none',
  '.steps[5].who.none',
  '.steps[5].whatToDo.steps[3]',
  '.steps[6].who.none',
  '.steps[10].who.match',
  '.steps[16].who.groups.noMethod',
  // The campaign's readiness groups (Step 7): the example lists nobody needing setup with a method and nobody unknown.
  '.steps[16].who.groups.needsSetup',
  '.steps[16].who.groups.readinessUnknown',
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
  '.steps[19].who.evidence[1]',
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
  '.pages.plan.blocked.sourceMapping',
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
const isAppOnly = (p: string): boolean => p.startsWith('.pages.app.') || p.startsWith('.pages.plan.settings.mappings.') || p.startsWith('.shared.engine.') || p.startsWith('.shared.deviation.') || p.startsWith('.shared.devicePlan.') || p === '.pages.plan.footer.notLicensedDevices'
const isStructural = (p: string): boolean =>
  /\.id$/.test(p) || /\.href$/.test(p) || /\.applies$/.test(p) || /pickerSource$/.test(p) || /\.kind$/.test(p) || /\.multi$/.test(p) || /\.mergesGoals\b/.test(p) || /\.learn\.url$/.test(p) || /\.whatToDoReference\b/.test(p) || /\.placement$/.test(p)

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

// A placement note ("Shown on Connect only when…", a step's placement line) is
// a note to the author, never a sentence on a page: no rendered string starts
// with one, in the review body or among the content strings a renderer reads.
test('no rendered string starts with "Shown on"', () => {
  assert.equal(/(^|>)\s*Shown on\b/.test(reviewBody()), false, 'the review body renders a placement note')
  const hits: string[] = []
  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      if (!isStructural(path) && /^Shown on\b/.test(node)) hits.push(path)
    } else if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`))
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) if (k !== 'example' && k !== '$comment') walk(v, `${path}.${k}`)
    }
  }
  walk(content, '')
  assert.deepEqual(hits, [], 'a content string a renderer reads starts with "Shown on"')
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
