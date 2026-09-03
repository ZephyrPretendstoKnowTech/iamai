// Connect before sign-in (docs/design/connect-mockup.html): tile 1 as the
// sign-in tile with the consent rows for every requested scope, its three
// error states from the MSAL error code, tile 3 (Scan) after sign-in with the
// beats for your tenant, and tile 4 (Plan) after the scan with the sample
// tenant's four facts computed from the demo fixture and Open the sample plan.
// The other states' strings are absent from each.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GRAPH_SCOPES } from '../../graph/scopes.ts'
import { SIGN_IN_SCOPES } from '../../copy/permissions.ts'
import { classifyAuthError } from '../../graph/authError.ts'
import { demoFacts } from '../demoFacts.ts'
import { demoTenant } from '../demo.ts'
import { W, accountTile, planTile, scanTile, signInTile, tileStrings } from './connectView.ts'
import type { SignInTile } from './connectView.ts'

const CONSENT = 'The first sign-in in a tenant needs an account that can grant consent (a Global Administrator, once); every sign-in after that can be Global Reader.'

const OWN: Record<string, string[]> = {
  none: ['no tenant connected'],
  consent: ['Microsoft asked for admin approval', 'first sign-in for'],
  personal: ['personal Microsoft account', 'Sign in with a work or school account'],
  cancelled: ['sign-in was cancelled'],
}
const onlyItsOwn = (kind: string, t: SignInTile): void => {
  const text = tileStrings(t).join('\n')
  for (const s of OWN[kind]) assert.ok(text.includes(s), `${kind} renders "${s}"`)
  for (const [other, strings] of Object.entries(OWN)) {
    if (other === kind) continue
    for (const s of strings) assert.ok(!text.includes(s), `${kind} must not render ${other}'s "${s}"`)
  }
  for (const s of tileStrings(t)) assert.ok(!/Security Reader|Reports Reader/.test(s), `"${s}" names a role other than Global Reader`)
}

test('the heading above the tiles is the same in both states, and Connect a tenant is gone', () => {
  assert.equal(W.h1, 'Plan the journey to your Conditional Access baseline.')
  assert.equal(W.intro, 'IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access baseline, and writes a dated plan to help you close the gaps without locking anyone out. It is read-only and runs in this browser.')
  assert.ok(!JSON.stringify(W).includes('Connect a tenant'))
  assert.ok(!JSON.stringify(W).includes('What happens next'), 'tile 3 is Scan')
})

test('tile 1 signed out: no tenant connected, the Global Reader line with the consent sentence, Sign in with Microsoft (primary), Try it with sample data (secondary), the consent rows for every requested scope in order, the removal line', () => {
  const t = signInTile({ error: null })
  assert.equal(t.n, 1)
  assert.equal(t.title, 'Sign in')
  assert.equal(t.state, 'no tenant connected')
  assert.equal(t.tone, null)
  assert.equal(t.lead, null)
  assert.ok(t.note?.startsWith('Global Reader is the least privilege that reads everything IAMAI needs; a Global Administrator account works too, but sign in with less if you can. It writes nothing. '))
  assert.ok(t.note?.endsWith(CONSENT), 'the consent sentence ends the line')
  assert.deepEqual(t.actions, [
    { label: 'Sign in with Microsoft', weight: 'primary' },
    { label: 'Try it with sample data', weight: 'secondary' },
  ])
  const P = t.permissions
  assert.equal(P.summary, 'What IAMAI asks for, and how to remove it')
  assert.equal(P.lead, `Microsoft's consent screen will list these ${P.rows.length}, in this order:`)
  const tenantScopes = GRAPH_SCOPES.filter((s) => !SIGN_IN_SCOPES.includes(s))
  assert.deepEqual([...P.rows.map((r) => r.scope)].sort(), [...tenantScopes].sort(), 'one row per requested tenant scope, none invented')
  assert.equal(P.rows[0].scope, 'Directory.Read.All')
  assert.equal(P.rows[0].name, "Read all users' basic profiles / Read directory data")
  assert.equal(P.rows[1].name, "Read your organization's policies")
  for (const r of P.rows) {
    assert.ok(r.name.length > 10, `${r.scope}: Microsoft's wording`)
    assert.ok(r.reads.length > 10, `${r.scope}: what it reads`)
  }
  assert.equal(P.removal, 'Remove it any time: Entra admin center → Enterprise applications → IAMAI Planner → Delete. Nothing it read leaves this browser unless you export it.')
  onlyItsOwn('none', t)
})

test('the signed-in tile 1 carries the same consent sentence', () => {
  const t = accountTile({ tenant: 'Contoso Pty Ltd', upn: 'alex@example.com', role: 'Global Administrator' })
  assert.ok(t.note.endsWith(CONSENT))
})

test('a sign-in error is one of three states from the MSAL error code: admin approval needed (amber), a personal account (red, its own button), cancelled (the state line only)', () => {
  const consent = classifyAuthError({ code: 'consent_required', message: "AADSTS65001: The user or administrator has not consented to use the application with ID 'x' named 'IAMAI Planner' for user 'alex@contoso.com'." })
  assert.deepEqual(consent, { kind: 'consent', domain: 'contoso.com' })
  assert.deepEqual(classifyAuthError({ code: 'access_denied', message: 'AADSTS90094: The grant requires admin permission.' }), { kind: 'consent', domain: null })
  const personal = classifyAuthError({ code: 'invalid_request', message: "AADSTS50020: User account 'someone@outlook.com' from identity provider 'live.com' does not exist in tenant 'organizations' and cannot access the application." })
  assert.deepEqual(personal, { kind: 'personal', account: 'someone@outlook.com' })
  assert.deepEqual(classifyAuthError({ code: 'user_cancelled', message: 'User cancelled the flow.' }), { kind: 'cancelled' })
  assert.deepEqual(classifyAuthError({ code: 'access_denied', message: 'AADSTS65004: User declined to consent to access the app.' }), { kind: 'cancelled' })
  assert.deepEqual(classifyAuthError({ code: 'server_error', message: 'AADSTS90002: Tenant not found.' }), { kind: 'failed', message: 'AADSTS90002: Tenant not found.' })

  const c = signInTile({ error: consent })
  assert.equal(c.state, 'Microsoft asked for admin approval')
  assert.equal(c.tone, 'wait')
  assert.equal(c.lead, 'This is the first sign-in for contoso.com, and consent has to be granted once by a Global Administrator. Sign in with that account this one time, or send them this link; after that, Global Reader is enough.')
  assert.equal(c.note, null, 'the error paragraph replaces the Global Reader line')
  assert.deepEqual(
    c.actions.map((a) => a.label),
    ['Sign in with Microsoft', 'Try it with sample data'],
  )
  assert.equal(signInTile({ error: { kind: 'consent', domain: null } }).lead?.startsWith('This is the first sign-in for this tenant, '), true)
  onlyItsOwn('consent', c)

  const p = signInTile({ error: personal })
  assert.equal(p.state, 'that is a personal Microsoft account')
  assert.equal(p.tone, 'stop')
  assert.equal(p.lead, 'someone@outlook.com is a personal account. IAMAI reads a Microsoft Entra tenant, so it needs a work or school account that belongs to one.')
  assert.deepEqual(p.actions, [
    { label: 'Sign in with a work or school account', weight: 'primary' },
    { label: 'Try it with sample data', weight: 'secondary' },
  ])
  assert.equal(signInTile({ error: { kind: 'personal', account: null } }).lead?.startsWith('That account is a personal account.'), true)
  onlyItsOwn('personal', p)

  const x = signInTile({ error: { kind: 'cancelled' } })
  assert.equal(x.state, 'sign-in was cancelled')
  assert.equal(x.tone, null)
  assert.equal(x.lead, null)
  assert.equal(x.note, null)
  assert.deepEqual(
    x.actions.map((a) => a.weight),
    ['primary', 'secondary'],
  )
  onlyItsOwn('cancelled', x)
})

test('tile 3 signed out: Scan after sign-in · about a minute for a small tenant, the beats for "your tenant", no button, no state colour', () => {
  const t = scanTile(W.scan.yourTenant, { kind: 'sample' })
  assert.equal(t.n, 3)
  assert.equal(t.title, 'Scan')
  assert.equal(t.state, 'after sign-in · about a minute for a small tenant')
  assert.equal(t.tone, null)
  assert.equal(t.beats[0].text, "your tenant's policies, people, sign-in records and licences.")
  assert.equal(t.beats[1].text, 'what each baseline policy is for with what your tenant already has.')
  assert.equal(t.limits.lines.length, 5)
  assert.deepEqual(t.actions, [])
  const text = tileStrings(t).join('\n')
  for (const s of ['complete · ', 'no plan built', "can't read the tenant", 'Stop', 'Scan tenant', 'Scan again']) assert.ok(!text.includes(s), `the signed-out Scan tile must not render "${s}"`)
})

test("tile 4 signed out: Plan after the scan, the sample tenant's four facts computed from the demo fixture, Open the sample plan (secondary)", () => {
  const facts = demoFacts()
  assert.equal(facts.people, demoTenant(false).snapshot.users.length, 'people is the demo snapshot\'s user count, as the ready tile counts it')
  assert.ok(facts.steps > 10 && facts.inPlace >= 0 && facts.inPlace <= facts.steps && facts.weeks >= 1, JSON.stringify(facts))
  const t = planTile({ kind: 'sample', facts })
  assert.equal(t.n, 4)
  assert.equal(t.kind, 'sample')
  assert.equal(t.title, 'Plan')
  assert.equal(t.state, 'after the scan')
  assert.equal(t.tone, null)
  assert.equal(t.lead, 'What the sample tenant produced:')
  assert.deepEqual(
    t.facts?.map((f) => f.label),
    ['people', 'steps', 'already in place', 'to finish'],
  )
  assert.deepEqual(t.facts?.slice(0, 3).map((f) => f.value), [String(facts.people), String(facts.steps), String(facts.inPlace)])
  assert.match(t.facts?.[3].value ?? '', /^\d+ weeks?$/)
  assert.deepEqual(t.actions, [{ label: 'Open the sample plan', weight: 'secondary' }])
  assert.equal(planTile({ kind: 'sample', facts: null }).facts, undefined, 'the facts wait for the fixture; nothing is typed in')
  const text = tileStrings(t).join('\n')
  for (const s of ['Open the plan →', 'Open the last full plan', 'from the scan', 'Try it with sample data', 'licence']) assert.ok(!text.includes(s), `the sample tile must not render "${s}"`)
})
