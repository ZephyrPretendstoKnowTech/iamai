// Task 015. Three truths the session mechanics rest on, each asserted where it
// is written rather than restated in a second place:
//
//   - what this device stored is never proof of a sign-in. Who is signed in
//     comes from MSAL, and MSAL's cache is this tab's (sessionStorage), so a
//     second tab over the same full IndexedDB draws the signed-out Connect;
//   - nothing about a tenant is written to web storage, so Forget this tenant
//     has one store to empty and no crumbs anywhere else;
//   - the app routes by hash. Which folder the bundle is published under is a
//     deploy fact carried by one constant, and MSAL's redirect URI follows it,
//     so moving it is a deploy and app-registration decision and never a change
//     to a route helper.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PLAN_HREF, READINESS_HREF } from './shell/routes.ts'
import { TOOL_PATH } from '../../scripts/toolPath.ts'

const app = readFileSync('src/ui/App.tsx', 'utf8')
const actions = readFileSync('src/ui/actions.ts', 'utf8')
const msal = readFileSync('src/graph/msal.ts', 'utf8')

/** Every non-test source file under a directory. */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) sources(p, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p.split('\\').join('/'))
  }
  return out
}

test("a full local store is never a sign-in: the account decides the shell, and the stored scan is read only for that account's tenant", () => {
  // Signed out is decided by the account and nothing else; no branch reaches a
  // scanned shell from a record the store happens to hold.
  assert.match(app, /const shellState: ShellState = !account \? 'signedOut'/)
  const path = app.slice(app.indexOf('initAuth()'), app.indexOf('.catch((e: unknown) => setAuthError'))
  assert.ok(path.length > 0, 'the sign-in path in App.tsx has moved')
  const guard = path.indexOf('if (a) {')
  assert.ok(guard >= 0, 'the sign-in path no longer guards on an account')
  // Whether this device's store can be written to at all is a device fact, so
  // it is asked here — but only once there is an account, as before.
  assert.ok(path.indexOf('probeStorage') > guard, 'probeStorage is reached without an account')
  // The tenant's own records are not read here at all. They are read by the one
  // action (ui/actions.ts restoreSession), which reads them in the tenant's turn
  // so Sign out and Forget this tenant can cancel a read still in flight; a
  // record read from a component is a record no trust action can take back.
  assert.doesNotMatch(app, /loadSnapshotRecord|loadBaselineRecord|fetchTenantName/, 'App.tsx reads a tenant record itself')
  assert.match(path, /await restoreSession\(a\)/, 'the sign-in path no longer restores through the action')
  const restore = actions.slice(actions.indexOf('export async function restoreSession'))
  assert.ok(restore.length > 0, 'the restore action has moved')
  assert.match(restore, /if \(!account\) return/, 'the restore reaches the store with nobody signed in')
  assert.match(restore, /loadSnapshotRecord<ScanRecord>\(account\.tenantId\)/)
  assert.match(restore, /loadBaselineRecord<BaselineResult\['origin'\]>\(account\.tenantId\)/)
})

test("MSAL's session is this tab's, and the account the app takes is the one the redirect returned", () => {
  assert.match(msal, /cache: \{ cacheLocation: 'sessionStorage' \}/, 'MSAL no longer keeps its session per tab')
  const body = msal.slice(msal.indexOf('export function initAuth'), msal.indexOf('let authorityWarm'))
  const returned = body.indexOf('result.account')
  const cached = body.indexOf('msal.getActiveAccount()')
  assert.ok(returned >= 0 && cached > returned, 'an account already in the cache is taken before the one a redirect just returned')
})

test('nothing about a tenant reaches web storage: what a browser keeps outside IndexedDB is a theme, a page tip and one reload flag', () => {
  const allowed: Record<string, RegExp> = {
    'src/ui/shell/AppShell.tsx': /const THEME_KEY = 'iamai-theme'/,
    'src/ui/tipState.ts': /const KEY = \(page: string\): string => `iamai\.tip\.\$\{page\}`/,
    'src/ui/preloadError.ts': /export const PRELOAD_RELOAD_KEY = 'iamai\.preloadReloaded'/,
  }
  const writers = sources('src').filter((f) => /\.setItem\(/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(writers.sort(), Object.keys(allowed).sort(), 'a source writes to web storage that this test has not been told about')
  for (const [file, key] of Object.entries(allowed)) assert.match(readFileSync(file, 'utf8'), key, `${file} writes a key this test does not allow`)
  // And the tenant's own records have one home, which is the store Forget empties.
  assert.match(readFileSync('src/graph/collect/cache.ts', 'utf8'), /openDB<IamaiDB>\('iamai', \d+/)
})

test('the app routes by hash: the folder the bundle is published under is one deploy constant, not a route', () => {
  const routes = readFileSync('src/ui/shell/routes.ts', 'utf8')
  assert.doesNotMatch(routes, /\/rollout\/|\/planner\//, 'an absolute product path has been written into the route table')
  assert.doesNotMatch(app, /\/rollout\/|\/planner\//)
  assert.equal(PLAN_HREF, '#/plan')
  assert.equal(READINESS_HREF, '#/readiness')
  // One place names the folder: scripts/toolPath.ts, in the source and not in a
  // deployment variable that can go unset. The bundle's base follows it, the
  // site assembler lays out dist/ under it, and MSAL's redirect URI follows the
  // base — which is why moving it is an app-registration decision as much as a
  // build one. It is /planner/ (owner decision, task 015): the registered SPA
  // redirect URI, and a hard cut with no /rollout/ left behind.
  const tool = readFileSync('scripts/toolPath.ts', 'utf8')
  assert.match(tool, /export const TOOL_NAME = 'planner'/)
  assert.equal(TOOL_PATH, 'planner')
  for (const file of ['vite.config.ts', 'scripts/assemble-site.mjs', 'scripts/walk.mjs', '.github/workflows/deploy-pages.yml']) {
    // The path form only: "rollout" is also an ordinary word in this product.
    assert.doesNotMatch(readFileSync(file, 'utf8'), /\/rollout\b|['"]rollout['"]/, `${file} still names the retired /rollout/ path`)
  }
  assert.match(msal, /redirectUri: window\.location\.origin \+ \(import\.meta\.env\.BASE_URL \?\? '\/'\)/)
})

test('a baseline nobody picked is not recorded for the tenant, so the page Forget lands on cannot undo it', () => {
  const connect = readFileSync('src/ui/surfaces/Connect.tsx', 'utf8')
  // Tile 2 loads the author's baseline for itself whenever nothing is stored —
  // on a first sign-in, and again on the Connect that Forget this tenant lands
  // on. That is a default, not a pick.
  assert.match(connect, /void loadPinned\(false\)/, "the tile's own default load now claims to be a choice")
  // The picker's two answers are picks, and are remembered.
  assert.match(connect, /void loadPinned\(true\)/)
  assert.match(connect, /chooseBaseline\(async \(\) => \{[\s\S]*loadUploadedBaseline\(files\)[\s\S]*\}, true\)/)
  // And only a pick reaches the store, from the one action that applies a
  // baseline, so forgetting a tenant leaves no row of it behind and none is
  // written back a moment later.
  const actions = readFileSync('src/ui/actions.ts', 'utf8')
  assert.match(actions, /if \(!chosen \|\| !account\) return\s+baselineSave = storeLib\.saveBaselineRecord\(account\.tenantId, result\.origin\)/)
  assert.doesNotMatch(app, /saveBaselineRecord/, "App writes the tenant's baseline row itself again")
})
