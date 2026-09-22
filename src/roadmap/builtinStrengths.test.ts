import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import builtinStrengths from '../../data/builtin-strengths.json' with { type: 'json' }
import { BUILT_IN_MFA_STRENGTH, effectOf } from './operations.ts'
import { inventoryReferences } from '../baseline/references.ts'
import type { CaPolicy } from '../baseline/types.ts'

// The R4-42 review. The built-in Multifactor authentication strength's id was
// written out twice in source: operations.ts, where effectOf reads it as the
// Require MFA grant, and baseline/references.ts, which lists the strengths that
// are the same in every tenant — beside data/builtin-strengths.json, which
// already held all three and is what every other reader of them imports. Two
// copies of one fact agree only until one is edited. The data file is the one.
test('R4-42: the built-in strength ids are written once, in data/builtin-strengths.json', () => {
  const ids = builtinStrengths.strengths.map((s) => s.id.toLowerCase())
  assert.equal(ids.length, 3, 'the premise: three built-in strengths')
  const copies: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name).replace(/\\/g, '/')
      if (entry.isDirectory()) { walk(full); continue }
      // Source only: tests, fixture tenants and test helpers carry ids as data.
      if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.') || full.includes('/fixtures/') || full.startsWith('src/testing/')) continue
      const text = readFileSync(full, 'utf8').toLowerCase()
      for (const id of ids) if (text.includes(id)) copies.push(`${full}: ${id}`)
    }
  }
  walk('src')
  assert.deepEqual(copies, [])

  // And both readers still read the same thing from it.
  const mfa = builtinStrengths.strengths.find((s) => s.displayName === 'Multifactor authentication')!
  assert.equal(BUILT_IN_MFA_STRENGTH, mfa.id.toLowerCase())
  const policy = (id: string) => effectOf({ state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', authenticationStrength: { id } } })
  assert.deepEqual(policy(mfa.id).requirements, [{ kind: 'mfa' }], 'the built-in MFA strength reads as the Require MFA grant')
  for (const s of builtinStrengths.strengths.filter((x) => x !== mfa)) assert.deepEqual(policy(s.id).requirements, [{ kind: 'strength', id: s.id }], s.displayName)
  const refs = inventoryReferences(builtinStrengths.strengths.map((s) => ({ displayName: s.displayName, grantControls: { authenticationStrength: { id: s.id } } }) as unknown as CaPolicy))
  assert.deepEqual(refs.map((r) => [r.id, r.portability]), ids.map((id) => [id, 'stable']), 'a built-in strength needs nothing from the target tenant')
  assert.equal(inventoryReferences([{ displayName: 'own', grantControls: { authenticationStrength: { id: '11111111-2222-3333-4444-555555555555' } } } as unknown as CaPolicy])[0].portability, 'tenantSpecific')
})
