// MFA Readiness search (F-116): a search opens every group and sub-group it
// matches in and shows every match; where the view hides every match, the empty
// line offers the whole list.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../roadmap/fixtures/index.ts'
import { groupOpens, matchesElsewhere, readinessView, rowsShown, shows, subGroupOpens } from './mfaReadiness.ts'
import { isReady } from '../scoring/phishingResistant.ts'
import { searchText } from '../ui/surfaces/readinessCells.ts'
import { pages } from '../content/content.ts'

test('a search opens every group and sub-group, and shows every match past the first rows', () => {
  // A closed group (not the next check's, under Needs action) opens while a search is typed.
  assert.equal(groupOpens({ next: false, quiet: false, show: 'needsAction', searching: false }), false)
  assert.equal(groupOpens({ next: false, quiet: false, show: 'needsAction', searching: true }), true)
  assert.equal(groupOpens({ next: false, quiet: false, show: 'all', searching: true }), true)
  // Without a search, the groups open as before.
  assert.equal(groupOpens({ next: true, quiet: false, show: 'all', searching: false }), true)
  assert.equal(groupOpens({ next: false, quiet: false, show: 'method', searching: false }), true)
  assert.equal(groupOpens({ next: false, quiet: true, show: 'needsAction', searching: false }), true)
  assert.equal(groupOpens({ next: false, quiet: true, show: 'all', searching: false }), false)
  // A sub-group the person closed opens while searching, and shows every match.
  assert.equal(subGroupOpens({ saved: false, admins: true, searching: true }), true)
  assert.equal(subGroupOpens({ saved: false, admins: true, searching: false }), false)
  assert.equal(subGroupOpens({ saved: undefined, admins: false, searching: false }), false)
  assert.equal(rowsShown(120, 50, true), 120)
  assert.equal(rowsShown(120, 50, false), 50)
  assert.equal(rowsShown(10, 50, false), 10)
})

test('a search the view hides entirely counts the matches the whole list holds (the demo)', () => {
  const f = fixture('demo')
  const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const ready = view.rows.find((r) => r.state !== null && isReady(r.state) && !view.lapsing.includes(r.user.id) && r.user.displayName)
  assert.ok(ready, 'the premise: the demo has a Ready person')
  const q = String(ready.user.displayName).toLowerCase()
  const matches = (r: (typeof view.rows)[number]): boolean => searchText(r).includes(q)
  // Needs action hides the Ready person; the whole list holds them.
  assert.ok(!view.rows.some((r) => shows(r, 'needsAction', view.lapsing) && matches(r)), 'Needs action hides the match')
  assert.ok(matchesElsewhere(view.rows, matches, 'needsAction', view.lapsing) >= 1)
  // Everyone is the whole list: nothing elsewhere to offer.
  assert.equal(matchesElsewhere(view.rows, matches, 'all', view.lapsing), 0)
  // A query nobody matches offers nothing.
  assert.equal(matchesElsewhere(view.rows, () => false, 'needsAction', view.lapsing), 0)
})

test('the page opens its groups for a search and offers Search everyone', () => {
  const page = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.match(page, /const searching = q !== ''/)
  assert.match(page, /open=\{groupOpens\(\{ next: isNext, quiet, show, searching \}\) \|\| undefined\}/)
  assert.match(page, /subGroupOpens\(\{ saved: openSubs\[key\], admins: g\.admins, searching \}\)/)
  assert.match(page, /rowsShown\(g\.rows\.length, limitOf\(key, g\.admins \? 3 : SUB_GROUP_AT\), searching\)/)
  assert.match(page, /onClick=\{\(\) => select\('all'\)\}>\{T\.searchEveryone\}/)
  assert.equal((pages.readiness as unknown as { searchEveryone: string }).searchEveryone, 'Search everyone')
})
