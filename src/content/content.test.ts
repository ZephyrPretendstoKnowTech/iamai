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
      for (const [k, v] of Object.entries(node)) if (k !== 'example' && !k.startsWith('$comment')) scan(v, path ? `${path}.${k}` : k)
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
  '.shared.sessionLoopHold', // Runtime-only next action for the same guard.
  '.shared.sessionLoopReview', // Runtime-only configuration guard; exercised by usability100.test.ts.
  '.shared.noTemporaryAccessPass', // Runtime-only: drawn only where the registration step waits on a pass that no step creates.
  // The two lines a change to an existing policy adds under portalOpen: the
  // "only these fields" note and the enable-and-save line. Every mapped policy
  // in the example is created new, so neither is emitted here.
  '.shared.changeUntouched',
  '.shared.changeDoneWhen[0]', // Used for dynamic correction variants, not the static example.
  '.shared.changeDoneWhen[1]',
  // What a message says about a date the roadmap projected but nothing has
  // earned (roadmap/forecast.ts): the paragraph the email and the prompt pack's
  // draft add under the day they name. It is composed at render time from the
  // step's lifecycle, and the review page has no lifecycle to read.
  '.shared.commsForecastNote',
  '.shared.enableLine',
  '.shared.syncRoleNote',
  // What a claim leaves behind when the tenant's values cannot complete it (R4,
  // stepExport.ts WHO_UNRESOLVED). Every example fills its own step's
  // variables, so no example line is ever left unfinished here.
  '.shared.whoUnresolved',
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
  // Connect's note for a scan that holds no sign-in proof (scoring/fromSnapshot.ts
  // signInProofRead): the review page's example scan read its proof. (MFA
  // Readiness's unmeasured headline renders now: the review page draws every
  // pages.readiness leaf, prompt 62.)
  '.pages.connect.scan.complete.degraded',
  // And the lead a complete scan adds when some section was refused, errored or
  // read only in part (coreSections.ts unreadSources): the same reason again —
  // the review page's example scan read every section it asked for.
  '.pages.connect.scan.complete.unread',
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
  '.steps[13].comms.bodyUndated',
  '.pages.plan.blocked.pairUnmatched',
  '.pages.plan.blocked.targetAmbiguous',
  '.pages.plan.blocked.noOperation',
  // The row reason for an update the tenant's policy already holds in full
  // (roadmap/stateReason.ts, types.ts Action.nothingOwed): a later scan's state,
  // which the review page's example plan is not in.
  '.pages.plan.blocked.noOperationHeld',
  // A4 (2026-09-12): the row reasons for a correction only a person can make and
  // for a group the scan could not read (copy/reasons.ts BLOCKED_REASON).
  '.pages.plan.blocked.manualCorrection',
  '.pages.plan.blocked.unverifiedExclusion',
  // The authentication methods policy the scan could not read (A5, copy/reasons.ts BLOCKED_REASON).
  '.pages.plan.blocked.methodsPolicyUnread',
  // The Plan usability pass (2026-09-11): words the Plan, its settings and its
  // decision layout read that the review body does not draw.
  '.pages.plan.blocked.devicePlan',
  // A Direction step with an answer nobody has approved (roadmap/direction.ts): its row reason.
  '.pages.plan.blocked.direction',
  '.pages.plan.howTo.items[0]',
  '.pages.plan.howTo.items[1]',
  '.pages.plan.howTo.items[2]',
  '.pages.plan.howTo.items[3]',
  '.pages.plan.howTo.items[4]',
  '.pages.plan.howTo.items[5]',
  '.pages.plan.settings.cancelFreeze',
  '.pages.plan.settings.communications',
  '.pages.plan.settings.freezeSaved',
  '.pages.plan.settings.removeFreeze',
  '.pages.plan.settings.scheduling',
  '.pages.plan.howTo.link',
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
  '.steps[5].whatToDo.steps[4]',
  '.steps[6].who.none',
  // The lead for a tenant whose security defaults the scan read as already off
  // (who.leadWhen, R4): the example's tenant has them on, so only that sentence
  // renders. The review page draws the one the example's facts earn, as the
  // product does.
  '.steps[7].who.leadWhen.securityDefaultsOff',
  // Its Done-when for the same read state (doneWhenWhen, R4-38): the step is
  // complete there and claims only that. The example's security defaults are
  // on, so the review page draws the cutover's own lines, as the product does.
  '.steps[7].doneWhenWhen.securityDefaultsOff[0]',
  // Its procedure for the same read state (whatToDoWhen): nothing to turn off,
  // each replacement from its own step. The example's are on, so the review
  // page draws the cutover's procedure, as the product does.
  '.steps[7].whatToDoWhen.securityDefaultsOff.steps[0]',
  '.steps[7].whatToDoWhen.securityDefaultsOff.steps[1]',
  '.steps[10].who.match',
  '.steps[13].who.groups.noMethod',
  // The campaign's readiness groups (Step 7): the example lists nobody needing setup with a method and nobody unknown.
  '.steps[13].who.groups.needsSetup',
  '.steps[13].who.groups.readinessUnknown',
  '.steps[13].who.groups.holdouts',
  // The admins the campaign waits on outside its active people (R4-52): the
  // example's tenant has none, dormant or with sign-in activity unread.
  '.steps[13].who.dormantAdmins',
  '.steps[13].who.unreadAdmins',
  '.steps[14].who.evidence[1]',
  // Directory-role holders who use the same account for mail or Teams (E6), on the
  // three admin policies (15, 23, 33); the examples list none. The lockout lists
  // (E8) render through their count lines, so those are no longer suppressed.
  '.steps[15].who.evidence[3]',
  '.steps[23].who.evidence[2]',
  '.steps[33].who.evidence[2]',
  '.steps[16].who.evidence[0]',
  // Azure sign-ins by people with no directory role (step-audit item 16); the example lists none.
  '.steps[16].who.evidence[1]',
  '.steps[17].who.evidence[1]',
  '.steps[18].who.evidence[0]',
  '.steps[19].who.evidence[0]',
  // The countries block's usage line and its partner line (E9): the example lists nobody outside and no partner.
  '.steps[22].who.evidence[0]',
  '.steps[22].who.evidence[1]',
  // The negation branches of the legacy-authentication and token-protection
  // blocks (R4: each was an ungated evidence line and is now the block's none).
  // Both examples name the accounts the claim is about, so the negation is
  // suppressed — which is the whole of the rule.
  '.steps[30].who.none',
  '.steps[35].who.none',
  // Eligible admins with no passkey or key yet (step-audit item 33); the example lists none.
  '.steps[33].who.evidence[0]',
  '.steps[34].who.evidence[0]',
  '.steps[35].who.evidence[1]',
  '.steps[36].who.evidence[0]',
  '.steps[37].who.evidence[1]',
  '.steps[38].who.evidence[1]',
  // The service-accounts block's none line (E9); the example has service accounts.
  '.steps[40].who.none',
  '.pages.plan.blocked.sourceMapping',
  // The passkey settings holds (roadmap/passkeySettings.ts, owner approval 2026-09-14):
  // a profile-based policy, a block list that blocks Authenticator, a partial read.
  // The example's methods policy is a complete read with key restrictions off.
  // The configuration gate's human check (editorial batch C): the example's steps are
  // evaluated from sign-in records, so no step renders the configuration gate.
  '.shared.policyDoneWhenConfiguration[1]',
  // The device-code and authentication-transfer usage lines (editorial batch C): the
  // example lists nobody. They only read as rendered before because a fragment matched
  // the old none line, which now says the records are not proof of no use.
  '.steps[20].who.evidence[0]',
  '.steps[21].who.evidence[0]',
  '.pages.plan.blocked.passkeyBlockConflict',
  '.pages.plan.blocked.passkeyPartialRead',
  '.pages.plan.blocked.passkeyProfiles',
  // The workload step's hold (roadmap/workloadIdentity.ts): the example tenant plans no
  // workload step, and a step that is planned holds on the unknown identity.
  '.pages.plan.blocked.workloadIdentityUnknown',
  '.pages.plan.blocked.workloadIdentityUnsupported',
  // The line an update draws when it takes a tenant exclusion off the policy (review 3
  // queue 3, stepPortal.ts): the example corrects no policy that has one.
  '.shared.changeRemoves',
  '.shared.changeRemovesGuests',
  // The other half of the proposed-name line (stepVars.ts proposedNameNote): the
  // example tenant's own policy names agree on a convention, so the name follows
  // it and the documented-pattern sentence does not render here.
  '.shared.proposedNameDocumented',
  // The third of them (stepVars.ts proposedNameNote): the example tenant has
  // policies, so the no-policies case cannot render here either.
  '.shared.proposedNameNoPolicies',
  // The board row's line for a conditional input nobody has saved
  // (planBoard.ts waitingForOf): a runtime reading of the plan's own state,
  // and the review page draws rows from the file with no state to read.
  '.pages.plan.unsavedAnswer',
  '.pages.plan.unsavedConfirm',
  // And the empty Ready tab's line (planBoard.ts nothingReadyLine): a reading
  // of the live lane counts, and the review page has no board.
  '.pages.plan.nothingReady',
  // The trusted-location step's completion under its other answer
  // (doneWhen.ts): the review page draws each step once, under the answer the
  // example records, and the example records a selected network.
  '.shared.trustedNetworkRemoteDoneWhen[0]',
  '.shared.trustedNetworkRemoteDoneWhen[1]',
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
// read by the product, never by the review page. steps[].doneEnd is a held
// policy's own end state, read by stepContract.ts in place of the shared one (B8).
// steps[].aiFocus is the step's own request to the assistant, read by AI Info's
// briefing (aiGrounding.ts) and never by the review page.
// shared.mailDevices is Block Legacy Authentication's second Implementation Task
// (ui/surfaces/policyTasks.ts), drawn by the Plan's task frame and never by the
// review page, which draws no tasks.
// These fields are consumed by Plan.tsx, stepContract.ts, stepResources.ts and aiGrounding.ts, not the static content-review renderer.
const isAppOnly = (p: string): boolean => p === '.pages.plan.howTo.intro' || p.startsWith('.pages.plan.howTo.legend.') || /^\.pages\.plan\.howTo\.legend\[/.test(p) || p === '.shared.certificatePrompt' || /\.tileNote$/.test(p) || /\.whatToDo\.verification\[/.test(p) || /^\.steps\[\d+\]\.preparation\[\d+\]$/.test(p) || /^\.steps\[\d+\]\.decision\.heading$/.test(p) || /^\.steps\[\d+\]\.(doneEnd|aiFocus|taskTitle)$/.test(p) || /^\.steps\[\d+\]\.card\.(subject|check)$/.test(p) || p.startsWith('.pages.plan.workflows.reviewCard.') || p === '.pages.plan.workflows.reviewTaskTitle' || p.startsWith('.pages.app.') || p.startsWith('.pages.plan.blockedSubject.') || p.startsWith('.pages.plan.settings.mappings.') || p.startsWith('.shared.engine.') || p.startsWith('.shared.deviation.') || p.startsWith('.shared.devicePlan.') || p.startsWith('.shared.mailDevices.') || p === '.pages.plan.footer.notLicensedDevices' || p === '.shared.planPromptTitle' || p === '.shared.policySettingsForAction' || p.startsWith('.shared.deviceBriefing.') || p.startsWith('.shared.passkeyCompatibility.') || p.startsWith('.shared.passkeyRestrictions.') || p.startsWith('.shared.registrationScope.')
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
        if (k === 'example' || k.startsWith('$comment') || k === 'version') continue
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
      for (const [k, v] of Object.entries(node)) if (k !== 'example' && !k.startsWith('$comment')) walk(v, `${path}.${k}`)
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
  // render.ts is the reviewer's rendering. A test that asserts what the reviewer's
  // reference says is not a renderer either: the group specs read it to check the
  // reference agrees with the translator's generated line.
  const ALLOWED = new Set(['src/content/render.ts', 'src/content/content.test.ts', 'src/ui/surfaces/protectAdmins.test.ts', 'src/ui/surfaces/mfaEveryone.test.ts', 'src/ui/surfaces/riskAndSessions.test.ts'])
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
