// The disclosure cannot drift from the consent screen (prompt 34 §1), and the
// consent screen asks for reads only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GRAPH_SCOPES } from '../graph/scopes.ts'
import { COLLECTOR_REGISTRY } from '../graph/collect/registry.ts'
import { SCOPE_COPY, SIGN_IN_SCOPES } from '../copy/permissions.ts'

test('no write permission is requested', () => {
  for (const scope of GRAPH_SCOPES) {
    assert.doesNotMatch(scope, /Write|ReadWrite/i, `${scope} is not a read scope`)
  }
})

// The canonical requested set, written down once so that adding a scope is a
// deliberate act with a visible diff rather than a quiet widening of consent.
// Every disclosure on the public surfaces is generated from this list, and
// src/graph/msal.test.ts holds MSAL's own token requests to it.
test('the requested scope set includes the dedicated read-only method-policy permission', () => {
  assert.deepEqual(GRAPH_SCOPES, [
    'Policy.Read.All',
    'Policy.Read.AuthenticationMethod',
    'Directory.Read.All',
    'AuditLog.Read.All',
    'RoleManagement.Read.Directory',
    'UserAuthenticationMethod.Read.All',
    'Reports.Read.All',
    'openid',
    'profile',
    'offline_access',
  ])
})

test('what is requested, what is explained and what the collectors spend are one set', () => {
  assert.deepEqual(GRAPH_SCOPES.filter((s) => SCOPE_COPY[s] === undefined), [], 'requested with nothing said about it')
  assert.deepEqual(Object.keys(SCOPE_COPY).filter((s) => !GRAPH_SCOPES.includes(s)), [], 'explained but never requested')
  const used = new Set(COLLECTOR_REGISTRY.flatMap((s) => s.scopes))
  assert.deepEqual([...used].filter((s) => !GRAPH_SCOPES.includes(s)), [], 'a collector spends a scope consent never asked for')
  // Every requested tenant scope has a collector behind it (prompt 46 item 23
  // removed Application.Read.All, which had none).
  assert.equal(GRAPH_SCOPES.includes('Application.Read.All'), false)
  for (const scope of GRAPH_SCOPES) if (!SIGN_IN_SCOPES.includes(scope)) assert.ok(used.has(scope), `${scope} is requested and spent`)
})

test('How derives its permission and read tables from the runtime registries, never a hand-written list', () => {
  // A hand-written table would state a permission set the product does not
  // actually request (task 040).
  const how = readFileSync('src/ui/surfaces/How.tsx', 'utf8')
  const view = readFileSync('src/ui/surfaces/howView.ts', 'utf8')
  assert.match(view, /COLLECTOR_REGISTRY\.filter/)
  assert.match(view, /REGISTRY\.filter/)
  assert.match(how, /import \{ howCheckTables[,} ][^\n]*from '\.\/howView\.ts'/)
  assert.match(how, /import \{ scopeRows \} from '\.\.\/PermissionsDisclosure\.tsx'/)
  assert.match(how, /rows=\{permissions\}/)
  assert.match(how, /howReadTables\(\)/)
  // No literal Graph scope or endpoint is written into the page.
  assert.ok(!/'[A-Za-z]+\.Read(Write)?\.(All|Directory)'/.test(how), 'a permission name is hard-coded on How')
  assert.ok(!/'\/(policies|users|devices|reports|identity)\//.test(how), 'an endpoint is hard-coded on How')
})
