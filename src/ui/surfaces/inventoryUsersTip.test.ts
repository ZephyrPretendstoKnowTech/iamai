// Inventory's Distinct users tip says both ways its number differs from MFA
// Readiness's (F-138). It said Readiness could only be higher, while on the
// demo Readiness counts fewer (30 against 34): it leaves the emergency,
// service and shared accounts out.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { INVENTORY as C } from '../../copy/inventory.ts'

test('the Distinct users tip names who it counts and why Readiness can differ either way', () => {
  const tip = C.signIns.distinctUsersTip.text
  assert.equal(tip, 'Every account with a sign-in record in this window, emergency, service and shared accounts included. MFA Readiness counts only people and guests, over 90 days, so its number can be lower or higher.')
  assert.doesNotMatch(tip, /can be higher than this number/)
})
