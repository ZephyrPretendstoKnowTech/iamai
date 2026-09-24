// Task 016: the two entry surfaces and the trust they make claims about.
//
// Connect's progression (Microsoft tenant → Baseline → Tenant scan → Plan), the
// permission truth the signed-out disclosure is generated from, How's hosting
// and credit statements, and the housekeeping the public claims rest on.
//
// The assertions are about facts and structure, never about a particular
// sentence: the copy is the owner's to change, and a test that freezes prose
// makes the next edit look like a regression.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GRAPH_SCOPES } from '../../graph/scopes.ts'
import { CONSENT_SCREEN_ORDER, SCOPE_COPY, SIGN_IN_SCOPES, consentRows } from '../../copy/permissions.ts'
import { app, pages } from '../../content/content.ts'
import { signInTile, stages } from '../scan/connectView.ts'
import { findingsIn, loadFingerprints } from '../../../scripts/tenant-guard.mjs'
import { REQUEST_HOSTS } from '../../../scripts/csp.ts'

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

// ---- C. permission truth ----

// The signed-out disclosure is generated from the permission authority: the
// scopes the app requests, crossed with what each one is spent on. There is no
// second list in the content that could widen or contradict it.
test('the permission disclosure on Connect and the tables on How are generated from GRAPH_SCOPES and the registries, never from a list of their own', () => {
  {
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
  }
  {
    // The permission, read and check tables stay generated from the registries the
    // code runs from. A hand-maintained table beside them is a second truth that
    // can quietly disagree with what the tool actually does.
    assert.match(HOW, /scopeRows\(\)/, 'the permissions are generated from GRAPH_SCOPES')
    assert.match(read('src/ui/surfaces/howView.ts'), /COLLECTOR_REGISTRY\.filter/, 'the reads are the collector registry')
    assert.match(read('src/ui/surfaces/howView.ts'), /REGISTRY\.filter/, 'the checks are the rule registry')
    // No literal endpoint, scope or check written into the page.
    for (const literal of ['https://graph.microsoft.com', '/v1.0/', 'Policy.Read.All', 'Directory.Read.All']) {
      assert.ok(!HOW.includes(literal), `How writes ${literal} down instead of reading it from the registry`)
    }
    const words = JSON.stringify(app.how)
    for (const scope of GRAPH_SCOPES) assert.ok(!words.includes(scope), `${scope} is written into How's words`)
  }
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

// Where the site runs, and where the tenant's data does not. The sentence has to
// be true of the current deployment: a static site on GitHub Pages behind
// Cloudflare, with the snapshot never leaving the browser.
test("How's hosting statement says where the site is served from, the telemetry the host collects, every non-Microsoft host the app contacts, and that tenant data stays in the browser", () => {
  {
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
  }
  {
    const hosting = (app.how as Record<string, string>).hostingBody
    // Named, so a reader who opens the network tab is not surprised by it.
    assert.match(hosting, /beacon|page load|page-load/i, 'the hosting statement does not mention the host-injected beacon')
    // And bounded: it is about the page, and IAMAI cannot remove it from here.
    assert.match(hosting, /\btenant\b/, 'it does not say what the beacon does not carry')
    assert.match(hosting, /cannot be removed|not in IAMAI/i, 'it does not say the beacon is outside the bundle')
  }
  {
    // Connect asks GitHub whether the baseline's author has published changes
    // (ui/baseline.ts checkAuthorHead and baselineReview) from the administrator's
    // browser. How's "Where it runs" named Cloudflare's beacon and never the one
    // other third party the app itself contacts (Phase 2 audit, How).
    const hosting = (app.how as Record<string, string>).hostingBody
    const others = REQUEST_HOSTS.filter((h) => !/microsoft(online)?\.com$/.test(h))
    assert.ok(others.length > 0)
    for (const host of others) assert.ok(hosting.includes(host), `How's hosting statement does not name ${host}`)
    assert.match(hosting, /no tenant data/i, 'it does not say what the GitHub requests carry')
    // "reads the changed files when there are" left "there are" with nothing to
    // refer to (Phase 2 review, round 2).
    assert.match(hosting, /when there are changes, reads the changed files/, 'it says when the changed files are read')
  }
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

// Production publishes the exact commit pushed to main (bb385cd0, a0284f8a):
// deploy-pages.yml checks out that SHA, builds the site and deploys it; a
// failed install or build deploys nothing. What ci.yml runs, and on which
// pushes, is the owner's to change and is not pinned here.
test('the deploy workflow publishes the pushed main commit, built first, and no pull request publishes', () => {
  // Owner, 2026-09-23: deploy on push to main, with the build as the gate; ci runs on demand for major changes.
  const uncommented = (yml: string): string => yml.split('\n').filter(l => !/^\s*#/.test(l)).join('\n')
  const config = uncommented(read('.github/workflows/deploy-pages.yml'))
  assert.match(config, /on:\n  push:\n    branches: \[main\]/, 'the deploy does not publish main on push')
  assert.doesNotMatch(config, /pull_request/, 'a pull request can publish')
  assert.ok(config.indexOf('npm run build:site') > 0 && config.indexOf('npm run build:site') < config.indexOf('actions/deploy-pages@'), 'the site is deployed without being built first')
  assert.doesNotMatch(config, /npm run walk|workflow_call|night-1|\/next\/|TOOL_PATH_PREFIX|ref: +main\s*$/m)
  assert.doesNotMatch(read('scripts/toolPath.ts'), /process\.env/)
})

// The wording review is read by people who are not the owner: its example
// operator is a generic one, not the owner's own sign-in address.
test("the wording review's example operator is admin@contoso.com", () => {
  const render = read('src/content/render.ts')
  assert.match(render, /upn: 'admin@contoso\.com'/, 'the review renders a generic operator')
  assert.deepEqual(findingsIn(render, loadFingerprints()), [], "the owner's own sign-in address is not the example")
})

// ---- Analytics truth ----
//
// The bundle carries no analytics: src/network.test.ts holds every host in the
// source to the three the product needs, and nothing in `dist/` references a
// beacon. The public site is not the bundle. Cloudflare injects its Web
// Analytics beacon into the HTML at the edge, so page-load telemetry *is*
// collected for getiamai.com, by the host, outside anything this repository can
// change. The product may say IAMAI collects nothing; it may not say nothing is
// collected.
test('no public surface claims a blanket absence of analytics, and no analytics host is referenced in the source the bundle is built from', () => {
  {
    // A bare "no analytics" / "no telemetry" reads as a claim about the page, and
    // the page is not IAMAI's to make that claim about. Qualified forms ("no
    // analytics of its own", "no telemetry in the bundle") are what the evidence
    // supports.
    const BARE = /\bno (analytics|telemetry|tracking)\b(?!\s+(of (its|our) own|in the bundle|of ours))/i
    for (const [what, words] of [
      ['the home page', JSON.stringify(pages.home)],
      ['Connect', JSON.stringify(pages.connect)],
      ['How', JSON.stringify(app.how)],
    ] as const) {
      assert.doesNotMatch(words, BARE, `${what} makes an unqualified no-analytics claim`)
    }
  }
  {
    // The home page's own short claim is about the tenant's data, which is the
    // claim the product can keep: the beacon is not the tenant's data.
    const trust = pages.home.trust as { title: string; body: string }[]
    const row = trust.find((t) => /browser/i.test(t.title) || /browser/i.test(t.body))
    assert.ok(row, 'the trust row about the browser is gone')
    assert.match(row.title + ' ' + row.body, /tenant/i, 'the claim is not narrowed to the tenant’s data')
    assert.match(row.body, /host/i, 'the row does not admit that the web host counts page loads')
    // Said without naming Cloudflare: that sentence lives on How, once.
    assert.ok(!row.body.includes('Cloudflare'), 'the hosting sentence is repeated on the home page')
  }
  {
    // The claim rests on the build, so the build is what the test reads: no
    // analytics host may appear in any source file the bundle is made from.
    const HOSTS = /cloudflareinsights|google-analytics|googletagmanager|plausible\.io|segment\.(io|com)|mixpanel|sentry\.io|posthog/i
    for (const path of ['index.html', 'vite.config.ts', 'scripts/assemble-site.mjs', 'scripts/build-home.ts']) {
      assert.doesNotMatch(read(path), HOSTS, `${path} references an analytics host`)
    }
    // SECURITY.md is the one place that names the beacon, because naming it is
    // the disclosure; it is prose, not a script tag.
    assert.match(read('SECURITY.md'), /cloudflareinsights/, 'SECURITY.md no longer discloses the host-injected beacon')
  }
})

// ---- Baseline source and version ----
//
// "Source and version" has to answer both. The version is the commit of the
// package actually loaded and the repository is the one it was loaded from, so
// the two can never name different things and no version is stated anywhere but
// in the package's own origin.
test('Connect renders the baseline source and version from the loaded package, not from a second authority', () => {
  assert.match(CONNECT, /t2\.source\.link/, 'the disclosure does not render the source')
  // Connect has no bare links: every anchor in a step is a text link or a
  // button in one of the three weights (the walk fails the build otherwise).
  assert.match(CONNECT, /<a className="lnk" href=\{t2\.source\.link\.url\}/, 'the source link is not classed as a text link')
  assert.match(CONNECT, /t2\.source\.version/, 'the disclosure does not render the version')
  const pin = CONNECT.slice(CONNECT.indexOf('function baselinePin'), CONNECT.indexOf('function baselineStrings'))
  assert.match(pin, /baseline\.origin\.kind !== 'github'/, 'an uploaded package is given a source it does not have')
  assert.match(pin, /\bcommit\b/, 'the version is not the loaded package’s own commit')
  // No commit, repository or date written into the component by hand.
  assert.doesNotMatch(pin, /[0-9a-f]{7,40}/, 'a revision is hardcoded beside the one the package carries')
  assert.doesNotMatch(pin, /\d{4}-\d{2}-\d{2}/, 'a date is hardcoded beside the pinned index’s own')
})
