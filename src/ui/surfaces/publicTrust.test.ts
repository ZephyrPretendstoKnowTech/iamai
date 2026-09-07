// Task 016: the two entry surfaces and the trust they make claims about.
//
// Connect's progression (Microsoft tenant → Baseline → Tenant scan → Plan), the
// mechanics behind its controls (task 015's, unchanged), the permission truth
// the signed-out disclosure is generated from, How's hosting and credit
// statements, and the repository housekeeping the public claims rest on.
//
// The assertions are about facts and structure, never about a particular
// sentence: the copy is the owner's to change, and a test that freezes prose
// makes the next edit look like a regression.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { GRAPH_SCOPES } from '../../graph/scopes.ts'
import { CONSENT_SCREEN_ORDER, SCOPE_COPY, SIGN_IN_SCOPES, consentRows } from '../../copy/permissions.ts'
import { app, pages } from '../../content/content.ts'
import { signInTile, stages } from '../scan/connectView.ts'

const read = (p: string): string => readFileSync(p, 'utf8')
const CONNECT = read('src/ui/surfaces/Connect.tsx')
const HOW = read('src/ui/surfaces/How.tsx')
const CA_REPO = 'https://github.com/Jhope188/ca-policy-analyzer'

// ---- A. the progression ----

// Four stages, one of them current. The current stage is the first one that is
// not finished; everything before it settles, everything after it waits. The
// representative states are the ones an operator actually passes through.
test('the setup progression settles what is done and makes the next action the current stage', () => {
  // Signed out: nothing is behind the operator, so stage 1 is the one to act on.
  assert.deepEqual(stages([false, false, false, false]), ['current', 'ahead', 'ahead', 'ahead'])
  // Connected, no baseline yet.
  assert.deepEqual(stages([true, false, false, false]), ['settled', 'current', 'ahead', 'ahead'])
  // Baseline picked, the scan has not run (or is running, or ended with gaps):
  // the scan is the stage with the next action either way.
  assert.deepEqual(stages([true, true, false, false]), ['settled', 'settled', 'current', 'ahead'])
  // The scan is complete and the plan is still computing: the Plan stage is next.
  assert.deepEqual(stages([true, true, true, false]), ['settled', 'settled', 'settled', 'current'])
  // Plan ready: every stage is behind the operator, and the page marks none of them Next.
  assert.deepEqual(stages([true, true, true, true]), ['settled', 'settled', 'settled', 'settled'])
  // Never two at once, and never a settled stage after the current one.
  for (const done of [
    [false, false, false, false],
    [true, false, false, false],
    [true, true, false, false],
    [true, true, true, false],
    [true, true, true, true],
  ]) {
    const s = stages(done)
    assert.ok(s.filter((x) => x === 'current').length <= 1, `${done}: one stage at a time`)
    const first = s.indexOf('current')
    if (first !== -1) assert.ok(s.lastIndexOf('settled') < first, `${done}: nothing settled after the current stage`)
  }
})

// Plan is the destination after the first successful scan, and the order is the
// product's: Connect → Plan → MFA Readiness → Export. Connect renders four
// numbered stages in that order and routes on to the plan alone.
test('Connect renders tenant → baseline → scan → Plan and routes on to the plan', () => {
  // Both states render the same four stages, in the same order.
  const signedOutAt = CONNECT.indexOf('function SignedOut(')
  const signedInAt = CONNECT.indexOf('function SignedIn(')
  const authorUpdateAt = CONNECT.indexOf('function useAuthorUpdate(')
  assert.ok(signedOutAt > 0 && signedInAt > signedOutAt && authorUpdateAt > signedInAt, 'the two states are here, in this order')
  const bodies = {
    'signed out': CONNECT.slice(signedOutAt, signedInAt),
    'signed in': CONNECT.slice(signedInAt, authorUpdateAt),
  }
  for (const [state, body] of Object.entries(bodies)) {
    const rendered = [...body.matchAll(/<(Tile n=\{1\}|BaselineTile|ScanTileView|PlanTileView)[ \n]/g)].map((m) => m[1])
    assert.deepEqual(rendered, ['Tile n={1}', 'BaselineTile', 'ScanTileView', 'PlanTileView'], `${state}: tenant → baseline → scan → Plan`)
  }
  assert.match(CONNECT, /<PlanTileView tile=\{t4\}/, 'the fourth stage is the Plan')
  assert.match(CONNECT, /href=\{PLAN_HREF\}/, 'and it opens the plan')
  // Nothing on Connect sends the operator to MFA Readiness first.
  assert.doesNotMatch(CONNECT, /readinessHref|#\/readiness|LadderTiles/, 'Connect does not route to MFA Readiness')
  assert.ok(!JSON.stringify(pages.connect).includes('#/readiness'), 'and its words carry no readiness link')
  // The current stage says so in a word, so the progression is not colour alone.
  assert.match(CONNECT, /stage === 'current' && <span className="next">/, 'the current stage carries a word marker')
  assert.match(read('src/ui/app.css'), /\.step-tile\.settled \{/, 'and a settled stage steps back')
})

// ---- B. the mechanics are task 015's ----

// The redesign moved presentation. Every control on Connect still calls the one
// canonical action, and the page keeps no session, auth, demo or cache state of
// its own to disagree with it.
test('every Connect control calls the canonical action, and the page owns no session state', () => {
  assert.match(CONNECT, /from '\.\.\/actions\.ts'/, 'the actions come from ui/actions.ts')
  for (const action of ['signIn', 'signInAnother', 'signOut', 'chooseBaseline', 'stopScan']) {
    assert.ok(new RegExp(`\\b${action}\\b`).test(CONNECT), `Connect calls ${action} rather than reimplementing it`)
  }
  assert.match(CONNECT, /scan as runScan/, 'the scan is ui/actions.ts scan()')
  assert.match(CONNECT, /useSession\(\)/, 'and the scan in flight is the session\'s')
  assert.match(CONNECT, /demoUrl\(\)/, 'the sample-data entry is demoMode.ts')
  // No second implementation of what task 015 owns.
  for (const forbidden of ['msalInstance', 'localStorage.', 'indexedDB', 'forgetStored', 'PublicClientApplication', 'DEMO_PARAM']) {
    assert.ok(!CONNECT.includes(forbidden), `Connect reaches past ui/actions.ts for ${forbidden}`)
  }
})

// The public demo exit is one implementation: the banner's link is the URL
// demoMode.ts builds, and nothing else clears the demo.
test('leaving the demo goes through the one exit, from the shell', () => {
  const shell = read('src/ui/shell/AppShell.tsx')
  assert.match(shell, /exitDemoUrl\(\)/, 'the banner leaves through demoMode.ts')
  const demoMode = read('src/ui/demoMode.ts')
  assert.match(demoMode, /export function exitDemoUrl/, 'and there is one exit')
  // Demo mode is read from the URL, never from storage: leaving is a navigation,
  // not a state a second implementation could get wrong.
  assert.match(demoMode, /Read from the URL, never from storage/)
  // The home page's sample-data link enters the same way the app leaves it.
  const home = read('home/index.html')
  assert.ok(home.includes('?demo=1#/plan'), 'the home page enters the demo at the same URL demoUrl() builds')
})

// ---- C. permission truth ----

// The signed-out disclosure is generated from the permission authority: the
// scopes the app requests, crossed with what each one is spent on. There is no
// second list in the content that could widen or contradict it.
test('the signed-out disclosure is generated from GRAPH_SCOPES, not from a list of its own', () => {
  const tenantScopes = GRAPH_SCOPES.filter((s) => !SIGN_IN_SCOPES.includes(s))
  const rows = consentRows()
  assert.deepEqual([...rows.map((r) => r.scope)].sort(), [...tenantScopes].sort(), 'one row per requested tenant scope, none invented')
  assert.deepEqual(rows.map((r) => r.scope), CONSENT_SCREEN_ORDER, "the rows are in the consent screen's order")
  for (const r of rows) {
    assert.equal(r.name, SCOPE_COPY[r.scope].consentName, `${r.scope}: the name is the authority's`)
    assert.equal(r.reads, SCOPE_COPY[r.scope].consentReads, `${r.scope}: what it reads is the authority's`)
  }
  // The tile renders exactly those rows, and the count in its lead is theirs.
  const tile = signInTile({ error: null })
  assert.deepEqual(tile.permissions.rows, rows)
  assert.ok(tile.permissions.lead.includes(String(rows.length)), 'the lead counts the rows it shows')
  // The content carries no permission list of its own any more.
  const words = JSON.stringify(pages.connect)
  for (const scope of GRAPH_SCOPES) assert.ok(!words.includes(scope), `${scope} is written into the page's words as well`)
  assert.ok(!('consent' in (pages.connect as { signIn: Record<string, unknown> }).signIn), 'the second consent list was retired')
})

// Read-only is the product boundary, not a claim about it: no requested scope
// can write, and nothing on the public surfaces asks for one.
test('no write scope is requested, and no public surface names one', () => {
  for (const scope of GRAPH_SCOPES) assert.doesNotMatch(scope, /Write|ReadWrite|\.Manage\b/i, `${scope} is not a read scope`)
  for (const words of [JSON.stringify(pages.home), JSON.stringify(pages.connect), JSON.stringify(app.how)]) {
    assert.doesNotMatch(words, /\bReadWrite\b|\bWrite\.All\b/, 'a public surface names a write permission')
  }
})

// ---- G, H, I. How: the technical trust surface ----

// The permission, read and check tables stay generated from the registries the
// code runs from. A hand-maintained table beside them is a second truth that
// can quietly disagree with what the tool actually does.
test('How generates its permissions, reads and checks from the registries', () => {
  assert.match(HOW, /scopeRows\(\)/, 'the permissions are generated from GRAPH_SCOPES')
  assert.match(HOW, /COLLECTOR_REGISTRY\.filter/, 'the reads are the collector registry')
  assert.match(HOW, /REGISTRY\.filter/, 'the checks are the rule registry')
  // No literal endpoint, scope or check written into the page.
  for (const literal of ['https://graph.microsoft.com', '/v1.0/', 'Policy.Read.All', 'Directory.Read.All']) {
    assert.ok(!HOW.includes(literal), `How writes ${literal} down instead of reading it from the registry`)
  }
  const words = JSON.stringify(app.how)
  for (const scope of GRAPH_SCOPES) assert.ok(!words.includes(scope), `${scope} is written into How's words`)
})

// Where the site runs, and where the tenant's data does not. The sentence has to
// be true of the current deployment: a static site on GitHub Pages behind
// Cloudflare, with the snapshot never leaving the browser.
test('How says where the public site is served from, that the tenant data stays in the browser, and that the source is public', () => {
  const hosting = (app.how as Record<string, string>).hostingBody
  assert.ok(hosting, 'How carries a hosting statement')
  assert.match(hosting, /Cloudflare/, 'it names what serves the public site')
  assert.match(hosting, /GitHub/, 'and where the files and the source are')
  assert.match(hosting, /browser/, 'and where the tenant data stays')
  assert.match(hosting, /public/, 'and that the source is public')
  // Cloudflare serves the site; it never receives the snapshot. The sentence
  // must not be readable the other way.
  assert.doesNotMatch(hosting, /Cloudflare[^.]*\b(receives|stores|holds|processes|sends)\b/i, hosting)
  assert.match(HOW, /\{C\.hostingBody\}/, 'and the page renders it')
  // Said once: the home page makes its own shorter claim rather than repeating this.
  assert.ok(!JSON.stringify(pages.home).includes('Cloudflare'), 'the hosting sentence is not copied onto the home page')
})

// Jon Hope's work is credited by name and by canonical repository, with no claim
// that anyone endorses, sponsors or is affiliated with IAMAI.
test('How credits CA Policy Analyzer and the baseline without claiming an endorsement', () => {
  const C = app.how as Record<string, string>
  assert.equal(C.creditAnalyzer, 'CA Policy Analyzer by Jon Hope')
  assert.ok(HOW.includes(CA_REPO), 'the canonical repository is the link')
  assert.match(HOW, /\{C\.creditAnalyzer\}/, 'and the page renders the credit')
  const said = [C.creditBaseline, C.creditAnalyzerNote, C.creditsNote].join(' ')
  for (const claim of [/\bfork(ed)?\b/i, /\bsponsor/i, /\bpartnership\b/i, /based on (its|their) code/i, /\bendorses IAMAI\b/i]) {
    assert.doesNotMatch(said, claim, `the credits claim more than the repository shows: ${said}`)
  }
  assert.match(said, /not affiliated/i, 'the separate project is named as separate')
  // Microsoft MVP is a person's credential, and the page says so rather than
  // letting it read as a Microsoft approval of IAMAI or of the baseline.
  assert.match(C.creditsNote, /Microsoft MVP/, 'the award is explained')
  assert.match(C.creditsNote, /does not endorse|not a Microsoft certification/i, 'and separated from an endorsement')
  // The baseline's own attribution stays where it is, on Connect.
  assert.ok(JSON.stringify(pages.connect).includes('Jon Hope'), 'the baseline attribution is still on Connect')
})

// ---- K, L, M. the housekeeping the public claims rest on ----

// Production publishes reviewed `main`, gated walk → build → deploy. The retired
// night-1 preview is gone, and no branch or path can reach the live site around
// the walk.
test('the deploy workflow gates production on the walk and publishes main alone', () => {
  const wf = read('.github/workflows/deploy-pages.yml')
  // The header comment records that the preview was retired; the configuration
  // must not bring any of it back, so this reads the workflow without its prose.
  const config = wf
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')
  assert.doesNotMatch(config, /night-1|\/next\/|TOOL_PATH_PREFIX/, 'the retired preview machinery is back')
  assert.match(wf, /^  build:\n    needs: walk$/m, 'build needs walk')
  assert.match(wf, /^  deploy:\n    needs: build$/m, 'deploy needs build')
  assert.match(wf, /branches: \[main\]/, 'only main triggers a publication')
  assert.match(wf, /npm run walk/, 'the walk runs')
  assert.match(wf, /ref: main/, 'and the artifact is built from main')
  // The tool path has no environment override any longer, so no deployment
  // variable can publish the bundle somewhere else.
  assert.doesNotMatch(read('scripts/toolPath.ts'), /process\.env/, 'the published path is a constant')
})

test('dependabot is configured for the one npm project at the root, weekly', () => {
  const path = '.github/dependabot.yml'
  assert.ok(existsSync(path), 'the dependabot config exists')
  const yml = read(path)
  assert.match(yml, /^version: 2$/m)
  assert.match(yml, /package-ecosystem: npm/)
  assert.match(yml, /directory: \/$/m)
  assert.match(yml, /interval: weekly/)
})

// The wording review is read by people who are not the owner: its example
// operator is a generic one, not the owner's own sign-in address.
test("the wording review's example operator is admin@contoso.com", () => {
  const render = read('src/content/render.ts')
  assert.match(render, /upn: 'admin@contoso\.com'/, 'the review renders a generic operator')
  assert.ok(!render.includes('Lachlan@getiamai.com'), "the owner's own sign-in address is not the example")
})
