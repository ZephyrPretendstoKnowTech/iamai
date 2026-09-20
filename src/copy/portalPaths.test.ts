// One route to one page. The Entra admin center's top level is **Entra ID**:
// Microsoft's own current articles say so (`how-to-create-delete-users`
// ms.date 2026-05-08 "Browse to Entra ID > Users"; `how-to-manage-groups`
// ms.date 2026-06-17 "Entra ID > Groups > All groups";
// `policy-admin-phish-resistant-mfa` ms.date 2026-03-24 "Entra ID >
// Conditional Access > Policies" — all checked 2026-09-19), and so does every
// implementation procedure in the library. "Identity →" and "Protection →" are
// the console's former top levels: an admin following the emergency step and
// then a policy step must not be given two routes to the same blade.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { RULE_ACTION, SUBJECT_WHERE } from './validation.ts'
import { PACKAGE } from './inventory.ts'

test('the shared copy sends an admin to one Entra admin center top level', () => {
  for (const file of ['src/copy/validation.ts', 'src/copy/inventory.ts']) {
    const text = readFileSync(file, 'utf8')
    assert.equal(/Identity → (Users|Groups)/.test(text), false, `${file} still names the former Identity top level`)
    assert.equal(/Protection → Conditional Access/.test(text), false, `${file} still names the former Protection top level`)
  }
  assert.equal(SUBJECT_WHERE.breakGlass, 'Entra admin center → Entra ID → Users')
  assert.equal(SUBJECT_WHERE.exclusionGroup, 'Entra admin center → Entra ID → Groups → this group → Members')
  assert.match(RULE_ACTION['bg.excludedFromAllPolicies'](null), /Entra admin center → Entra ID → Conditional Access → Policies\.$/)
  assert.equal(PACKAGE.way1[0], 'Entra admin center → Entra ID → Conditional Access → Policies.')
})

test('the frozen passkey step links to the article Microsoft has now', () => {
  // `how-to-enable-passkey-fido2` only redirects; the live article is
  // `how-to-authentication-passkeys-fido2` ("How to enable passkeys (FIDO2) in
  // Microsoft Entra ID", ms.date 2026-03-08, checked 2026-09-19).
  const content = readFileSync('docs/design/content.json', 'utf8')
  assert.equal(content.includes('how-to-enable-passkey-fido2'), false, 'the renamed slug survives in the content')
  assert.ok(content.includes('https://learn.microsoft.com/entra/identity/authentication/how-to-authentication-passkeys-fido2'))
})
