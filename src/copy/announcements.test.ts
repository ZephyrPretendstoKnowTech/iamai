// The salutation follows the audience (prompt 41 §4, review-09 finding 8).
// Every template opened "Hi everyone," including the ones addressed to two
// named people, which tells the reader nobody looked at who the message was
// for. The audience model already knew; it was not reaching the first line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { salutation } from './announcements.ts'

test('the salutation has a branch for every audience kind', () => {
  assert.equal(salutation({ kind: 'everyone' }), 'Hi everyone,')
  assert.equal(salutation({ kind: 'admins' }), 'Hi admins,')
  assert.equal(salutation({ kind: 'segment' }), 'Hi all,')
  assert.equal(salutation({ kind: 'none' }), 'Hi,')
  // No audience at all is the safe default, never a wrong name.
  assert.equal(salutation(null), 'Hi everyone,')
})

test('named audiences are greeted by name, and never as everyone', () => {
  assert.equal(salutation({ kind: 'named', names: ['Alex Okafor'] }), 'Hi Alex Okafor,')
  // The exact case review 09 reported: two named people, greeted "Hi everyone".
  assert.equal(salutation({ kind: 'named', names: ['Alex Okafor', 'Sam Lee'] }), 'Hi Alex Okafor and Sam Lee,')
  assert.equal(salutation({ kind: 'named', names: ['A', 'B', 'C'] }), 'Hi A, B and C,')
})

test('more names than a greeting can carry become "Hi all", not a list', () => {
  assert.equal(salutation({ kind: 'named', names: ['A', 'B', 'C', 'D'] }), 'Hi all,')
  // A named audience with no resolvable names still must not say "everyone".
  assert.equal(salutation({ kind: 'named', names: [] }), 'Hi,')
})

test('no salutation ends in a stray comma or double punctuation', () => {
  const all = [
    salutation(null),
    salutation({ kind: 'admins' }),
    salutation({ kind: 'named', names: ['Alex Okafor', 'Sam Lee'] }),
    salutation({ kind: 'named', names: [] }),
  ]
  for (const s of all) {
    assert.ok(s.endsWith(','), `${s} ends with a comma`)
    assert.ok(!/,\s*,/.test(s), `${s} has no doubled comma`)
    assert.ok(!/\s,/.test(s), `${s} has no space before its comma`)
  }
})
