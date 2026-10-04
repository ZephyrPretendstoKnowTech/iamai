// T3-A (owner D1, 2026-10-03): the Account menu's tenant switcher. The list is
// every tenant this browser holds records for and every tenant an account is
// signed in to in this tab, once each, the open one first; choosing a row opens
// a signed-in tenant in place or signs in to one that is not. Pure, so held
// here; the moves themselves are ui/actions.ts's (actions.test.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { AccountInfo } from '@azure/msal-browser'
import { isTenantId, storedTenantOf, switchMove, tenantEntries, tenantLabel } from './tenants.ts'
import { DEMO_SNAPSHOT_STATE_ID, DEMO_TENANT_ID } from './demoMode.ts'

// Synthetic tenant ids: GUID-shaped, as Entra's are.
const A = 'aaaaaaaa-0000-4000-8000-000000000001'
const B = 'bbbbbbbb-0000-4000-8000-000000000002'
const C = 'cccccccc-0000-4000-8000-000000000003'
const D = 'dddddddd-0000-4000-8000-000000000004'
const acct = (tenantId: string, username: string, homeAccountId = `${username}-home`): AccountInfo =>
  ({ homeAccountId, environment: 'login.windows.net', tenantId, username, localAccountId: 'u' } as AccountInfo)
const scanOf = (name: string | null, upn: string | null) => ({
  snapshot: { tenantId: 'x', config: { organization: { rows: name === null ? [] : [{ displayName: name }] }, me: { rows: upn === null ? [] : [{ userPrincipalName: upn }] } } },
  at: '2026-10-01T00:00:00.000Z',
})

test("a stored scan names its tenant and who scanned it, and nothing else of it is read", () => {
  assert.deepEqual(storedTenantOf(A, scanOf('Contoso', 'admin@contoso.example')), { tenantId: A, name: 'Contoso', signedInAs: 'admin@contoso.example' })
  // No stored scan (a plan file loaded, a scan that ended with gaps): the id alone.
  assert.deepEqual(storedTenantOf(B, null), { tenantId: B, name: null, signedInAs: null })
  // A scan whose organization or me read failed has no rows: nothing is invented.
  assert.deepEqual(storedTenantOf(C, scanOf(null, null)), { tenantId: C, name: null, signedInAs: null })
  assert.deepEqual(storedTenantOf(C, { snapshot: { config: { organization: { rows: [{ displayName: '  ' }] } } } }), { tenantId: C, name: null, signedInAs: null })
})

test('the sample shares the database under ids that are not tenants, and is never listed', () => {
  assert.equal(isTenantId(A), true)
  assert.equal(isTenantId(DEMO_TENANT_ID), false)
  assert.equal(isTenantId(DEMO_SNAPSHOT_STATE_ID), false)
  const rows = tenantEntries([{ tenantId: DEMO_TENANT_ID, name: 'Sample', signedInAs: null }, { tenantId: A, name: 'Contoso', signedInAs: null }], [], null, null)
  assert.deepEqual(rows.map((r) => r.tenantId), [A])
})

test('every stored tenant and every signed-in tenant once, the open one first and marked, the rest by name', () => {
  const current = acct(A, 'admin@contoso.example')
  const fabrikam = acct(B, 'it@fabrikam.example')
  const rows = tenantEntries(
    [
      { tenantId: A, name: 'Contoso (stored name)', signedInAs: 'old@contoso.example' },
      { tenantId: C, name: 'Northwind', signedInAs: 'ops@northwind.example' },
      { tenantId: B, name: 'Fabrikam', signedInAs: null },
    ],
    // MSAL lists the open account too, and a tenant with nothing stored (signed in, never scanned).
    [current, fabrikam, acct(D, 'new@woodgrove.example')],
    current,
    'Contoso',
  )
  assert.deepEqual(
    rows.map((r) => [tenantLabel(r), r.current, r.stored, r.account?.username ?? null, r.loginHint]),
    [
      // The open tenant first, with the header's name and the session's account.
      ['Contoso', true, true, 'admin@contoso.example', 'admin@contoso.example'],
      ['Fabrikam', false, true, 'it@fabrikam.example', 'it@fabrikam.example'],
      // Signed in, nothing stored: named by its account until a scan names it.
      ['new@woodgrove.example', false, false, 'new@woodgrove.example', 'new@woodgrove.example'],
      // Not signed in: the account that scanned it is the hint.
      ['Northwind', false, true, null, 'ops@northwind.example'],
    ],
  )
  // Two accounts in one tenant are one row.
  assert.equal(tenantEntries([], [fabrikam, acct(B, 'second@fabrikam.example')], null, null).length, 1)
  // A stored tenant with no name and no account says which tenant it is.
  assert.equal(tenantLabel(tenantEntries([{ tenantId: C, name: null, signedInAs: null }], [], null, null)[0]), `Tenant ${C}`)
})

test('the open tenant is always a row, even when MSAL lists nothing and nothing is stored', () => {
  const current = acct(A, 'admin@contoso.example')
  const rows = tenantEntries([], [], current, null)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].current, true)
  assert.equal(tenantLabel(rows[0]), 'admin@contoso.example')
})

test('choosing a row: the open tenant stays, a signed-in tenant opens with its own account, any other signs in with its hint', () => {
  const current = acct(A, 'admin@contoso.example')
  const fabrikam = acct(B, 'it@fabrikam.example')
  const rows = tenantEntries([{ tenantId: C, name: 'Northwind', signedInAs: 'ops@northwind.example' }, { tenantId: D, name: 'Woodgrove', signedInAs: null }], [current, fabrikam], current, 'Contoso')
  const by = (id: string) => rows.find((r) => r.tenantId === id)!
  assert.deepEqual(switchMove(by(A)), { kind: 'stay' })
  assert.deepEqual(switchMove(by(B)), { kind: 'open', account: fabrikam })
  assert.deepEqual(switchMove(by(C)), { kind: 'signIn', loginHint: 'ops@northwind.example' })
  assert.deepEqual(switchMove(by(D)), { kind: 'signIn', loginHint: null })
})

test('the stored tenants are read from the keys of the existing stores: no new store, no version change, nothing written', () => {
  const src = readFileSync('src/graph/collect/cache.ts', 'utf8').replace(/\r\n/g, '\n')
  // The database stays at version 8 (the plan: switching needs no version change).
  assert.match(src, /openDB<IamaiDB>\('iamai', 8, \{/)
  const start = src.indexOf('export async function storedTenantIds')
  assert.ok(start >= 0)
  const body = src.slice(start, src.indexOf('\n}\n', start))
  assert.match(body, /getAllKeys\(store\)/)
  assert.match(body, /openKeyCursor\(null, 'nextunique'\)/)
  assert.doesNotMatch(body, /readwrite|\.put\(|\.delete\(|\.get\(|getAll\(|openCursor\(/, 'listing the tenants reads a value or writes')
})

test('the Account menu draws the switcher from the action module: the tenants when it opens, the open one checked, a choice through switchTenant, Add another tenant through signInAnother', async () => {
  const shell = readFileSync('src/ui/shell/AppShell.tsx', 'utf8').replace(/\r\n/g, '\n')
  const menu = shell.slice(shell.indexOf('function AccountMenu('), shell.indexOf('\n}\n', shell.indexOf('function AccountMenu(')))
  assert.match(shell, /import \{[^}]*\blistTenants\b[^}]*\bswitchTenant\b[^}]*\} from '\.\.\/actions\.ts'/)
  assert.match(menu, /if \(!open\) return\n\s+let live = true\n\s+void listTenants\(\)\.then/, 'the tenants are not read when the menu opens')
  // Only when there is a choice: one tenant needs no list.
  assert.match(menu, /\{tenants\.length > 1 && \(/)
  assert.match(menu, /role="menuitemradio"\n\s+aria-checked=\{t\.current\}/)
  assert.match(menu, /onClick=\{\(\) => \(t\.current \? close\(\) : run\(switchTenant\(t\)\.then\(close\)\)\)\}/, 'a choice does not go through the action, or its failure is dropped')
  assert.match(menu, /title=\{SHELL\.addTenantTooltip\} onClick=\{\(\) => run\(signInAnother\(\)\)\}>\n\s+\{SHELL\.addTenant\}/)
  // Escape still closes the menu and hands focus back to the Account button.
  assert.match(menu, /if \(e\.key === 'Escape'\) \{\n\s+close\(\)\n\s+accountButton\.current\?\.focus\(\)/)
  // A switch draws the page afresh: the routed page is keyed by the tenant as well as the route.
  assert.match(readFileSync('src/ui/App.tsx', 'utf8'), /<ErrorBoundary key=\{`\$\{route\}\|\$\{account\?\.tenantId \?\? ''\}`\} route=\{route\}>/)
  const { app } = await import('../content/content.ts')
  const { fillText } = await import('../content/render.ts')
  assert.equal(app.shell.tenantsLabel, 'Tenants in this browser')
  assert.equal(fillText(app.shell.tenantCurrent, { tenant: 'Contoso' }), 'Contoso · open now')
  assert.equal(fillText(app.shell.tenantSignIn, { tenant: 'Northwind' }), 'Northwind · sign in')
  assert.equal(app.shell.addTenant, 'Add another tenant')
})

test('Sign out says it signs out the open account only', async () => {
  const shell = readFileSync('src/ui/shell/AppShell.tsx', 'utf8')
  assert.match(shell, /role="menuitem" title=\{fillText\(SHELL\.signOutTooltip, \{ username: account\.username \}\)\} onClick=\{\(\) => run\(signOut\(\)\)\}>/)
  const { app } = await import('../content/content.ts')
  const { fillText } = await import('../content/render.ts')
  assert.equal(fillText(app.shell.signOutTooltip, { username: 'admin@contoso.example' }), 'Signs admin@contoso.example out; an account signed in to another tenant here stays signed in')
})
