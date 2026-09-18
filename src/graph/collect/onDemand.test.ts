import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignedLicenseSkuIdsOf, directMemberObjectsOf } from './groupShape.ts'

test('saved-group license evidence stays unknown when the collection or an identifier is unreadable', () => {
  assert.equal(assignedLicenseSkuIdsOf(undefined), null)
  assert.equal(assignedLicenseSkuIdsOf([{ skuId: '' }]), null)
  assert.equal(assignedLicenseSkuIdsOf([{}]), null)
  assert.deepEqual(assignedLicenseSkuIdsOf([]), [])
  assert.deepEqual(assignedLicenseSkuIdsOf([{ skuId: 'license-1' }]), ['license-1'])
})

test('direct membership rejects a row without a stable identifier instead of certifying an empty result', () => {
  assert.throws(() => directMemberObjectsOf([{ displayName: 'Unread object' }]), /stable id/)
  assert.throws(() => directMemberObjectsOf([null]), /not an object/)
  assert.deepEqual(directMemberObjectsOf([{ id: 'member-1', displayName: 'Member', '@odata.type': '#microsoft.graph.user' }]), [{ id: 'member-1', displayName: 'Member', userPrincipalName: null, kind: 'user' }])
})
