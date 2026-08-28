import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN_ROLE_IDS, ROLE_TEMPLATES, coversAdminSet, roleLabel, roleName } from './roles.ts'

const GA = '62e90394-69f5-4237-9190-012177145e10'

test('role catalogue resolves every built-in template, unknown ids say so once', () => {
  assert.ok(ROLE_TEMPLATES.length > 100)
  assert.equal(roleName(GA), 'Global Administrator')
  assert.equal(roleName(GA.toUpperCase()), 'Global Administrator')
  assert.equal(roleLabel('00000000-0000-0000-0000-000000000000'), 'Unknown role (id 00000000-0000-0000-0000-000000000000)')
  assert.ok(ADMIN_ROLE_IDS.has(GA))
})

test('coversAdminSet: the full catalogue covers; one short does not', () => {
  const all = ROLE_TEMPLATES.map((r) => r.templateId)
  assert.equal(coversAdminSet(all), true)
  assert.equal(coversAdminSet(all.filter((id) => id !== GA)), false)
  assert.equal(coversAdminSet([GA]), false)
})
