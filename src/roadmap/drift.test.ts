// Exclusion drift (prompt 44 Part 3).
//
// The distinction that matters: growth WITHIN the nominated emergency-access
// count is a note, and growth BEYOND it is a finding. A group holding exactly
// the accounts somebody nominated is doing its job; one holding more is doing
// something nobody asked for, and everyone in it sits outside every policy that
// excludes it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { directExclusionDrift, exclusionDrift } from './drift.ts'
import type { Checkpoint } from './plan.ts'

const nameOf = (id: string) => ({ 'u-1': 'Break-glass 01', 'u-2': 'Break-glass 02', 'u-9': 'Sam Lee', 'u-8': 'Alex Okafor' })[id] ?? id

const checkpoint = (groups: { groupId: string; memberCount: number; memberIds?: string[] }[]): Checkpoint =>
  ({ at: '2026-09-14T00:00:00.000Z', exclusionGroups: groups }) as unknown as Checkpoint

test('the first scan reports nothing: there is nothing to compare against', () => {
  const items = exclusionDrift({
    previous: null,
    current: [{ groupId: 'g1', name: 'Core - Exclusion - Break-glass', memberCount: 9 }],
    usedAsExclusion: new Set(['g1']),
    nominated: 2,
    nameOf,
  })
  assert.deepEqual(items, [])
})

test('growth beyond the nominated accounts is a finding, and names who arrived', () => {
  const items = exclusionDrift({
    previous: checkpoint([{ groupId: 'g1', memberCount: 2, memberIds: ['u-1', 'u-2'] }]),
    current: [{ groupId: 'g1', name: 'Core - Exclusion - Break-glass', memberCount: 4, memberIds: ['u-1', 'u-2', 'u-9', 'u-8'] }],
    usedAsExclusion: new Set(['g1']),
    nominated: 2,
    nameOf,
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].finding, true, 'beyond the nominated count is a finding, not a note')
  assert.match(items[0].sentence, /only 2 emergency access accounts are nominated/)
  assert.deepEqual(items[0].addedNames, ['Sam Lee', 'Alex Okafor'])
  assert.match(items[0].detail ?? '', /Added since the last scan: Sam Lee, Alex Okafor/)
})

test('a group that has not moved and sits at the nominated count says nothing', () => {
  const items = exclusionDrift({
    previous: checkpoint([{ groupId: 'g1', memberCount: 2, memberIds: ['u-1', 'u-2'] }]),
    current: [{ groupId: 'g1', name: 'Core - Exclusion - Break-glass', memberCount: 2, memberIds: ['u-1', 'u-2'] }],
    usedAsExclusion: new Set(['g1']),
    nominated: 2,
    nameOf,
  })
  assert.deepEqual(items, [])
})

test('a group nothing excludes is not reported, however it has grown', () => {
  const items = exclusionDrift({
    previous: checkpoint([{ groupId: 'finance', memberCount: 2 }]),
    current: [{ groupId: 'finance', name: 'Finance team', memberCount: 40 }],
    usedAsExclusion: new Set(),
    nominated: 2,
    nameOf,
  })
  assert.deepEqual(items, [], 'a normal group growing is not a security event')
})

test('shrinking is reported too, and is never a finding on its own', () => {
  const items = exclusionDrift({
    previous: checkpoint([{ groupId: 'g1', memberCount: 2, memberIds: ['u-1', 'u-2'] }]),
    current: [{ groupId: 'g1', name: 'Core - Exclusion - Break-glass', memberCount: 1, memberIds: ['u-1'] }],
    usedAsExclusion: new Set(['g1']),
    nominated: 2,
    nameOf,
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].finding, false)
  assert.match(items[0].sentence, /shrunk from 2 members to 1/)
})

test('an older plan file with counts but no ids names nobody rather than guessing', () => {
  const items = exclusionDrift({
    previous: checkpoint([{ groupId: 'g1', memberCount: 2 }]),
    current: [{ groupId: 'g1', name: 'Core - Exclusion - Break-glass', memberCount: 5, memberIds: ['u-1', 'u-2', 'u-9', 'u-8', 'x'] }],
    usedAsExclusion: new Set(['g1']),
    nominated: 2,
    nameOf,
  })
  assert.equal(items[0].finding, true, 'the count still tells the truth')
  assert.deepEqual(items[0].addedNames, [], 'without ids at both ends, nobody is named')
})

test('a group too large to list is counted, not enumerated', () => {
  const before = Array.from({ length: 12 }, (_, i) => `m${i}`)
  const after = [...before, 'u-9', 'u-8']
  const items = exclusionDrift({
    previous: checkpoint([{ groupId: 'g1', memberCount: 12, memberIds: before }]),
    current: [{ groupId: 'g1', name: 'Big exclusion', memberCount: 14, memberIds: after }],
    usedAsExclusion: new Set(['g1']),
    nominated: 2,
    nameOf,
  })
  assert.deepEqual(items[0].addedNames, [], 'past the limit, nobody is listed')
  assert.match(items[0].detail ?? '', /2 members added since the last scan/)
})

test('accounts excluded on a policy directly get the same treatment (item 15)', () => {
  const items = directExclusionDrift({
    previous: new Map([['p1', 1]]),
    current: [{ policyId: 'p1', policyName: 'CA001 - Require MFA', excludedCount: 3 }],
    since: '2026-09-14T00:00:00.000Z',
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].finding, true)
  assert.match(items[0].sentence, /excludes 3 accounts by name, up from 1/)
  assert.match(items[0].detail ?? '', /invisible in the group list/)
})
