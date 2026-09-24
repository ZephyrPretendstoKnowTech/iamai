// The organisation report (naming-and-consolidation.md §3, prompt 43 Part 3).
//
// Two properties matter. Every item carries what, why HERE, and the exact
// change — an item with no change is an observation, and observations belong
// elsewhere. And nothing here can reach the coverage score, which is why none of
// these functions touches report.results.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { organisationItems, STALE_REPORT_ONLY_DAYS } from './organisationItems.ts'
import { detectConvention } from '../roadmap/convention.ts'
import type { OrganisationReport } from './types.ts'

const NOW = '2026-09-30T00:00:00.000Z'
const daysAgo = (n: number) => new Date(Date.parse(NOW) - n * 86_400_000).toISOString()

const snapshot = (rows: unknown[]) => ({ asOf: NOW, config: { caPolicies: { rows } } }) as never

function report(over: Partial<OrganisationReport['naming']> = {}, consolidation: OrganisationReport['consolidation'] = []): OrganisationReport {
  const names = over.names ?? []
  return {
    notInBaseline: [],
    notAssessed: [],
    consolidation,
    naming: {
      pattern: null,
      share: 0,
      outliers: [],
      prefix: null,
      separator: null,
      convention: detectConvention(names),
      unprefixed: [],
      names,
      ...over,
    },
    microsoftManaged: [],
  } as OrganisationReport
}

test('nothing to say is no item: a tidy tenant, a report-only policy inside the window, meaningful group names', () => {
  assert.deepEqual(organisationItems(report(), snapshot([{ displayName: 'CA001 - Require MFA', state: 'enabled' }]), []), [])
  const fresh = snapshot([{ displayName: 'Recent', state: 'enabledForReportingButNotEnforced', modifiedDateTime: daysAgo(STALE_REPORT_ONLY_DAYS - 1) }])
  assert.deepEqual(organisationItems(report(), fresh, []), [], 'inside the window it is being observed, not forgotten')
  assert.deepEqual(organisationItems(report(), snapshot([]), ['CA - Exclusion - Break-glass', 'Finance team']), [])
  const opaque = organisationItems(report(), snapshot([]), ['Group1', 'temp', 'CA - Exclusion - Break-glass'])
  assert.deepEqual(opaque.find((i) => i.kind === 'groupName')!.names, ['Group1', 'temp'], 'a name that says its purpose is left alone')
})

test('every item states what, why here, and the exact change, and never proposes a delete', () => {
  const items = organisationItems(
    report({ outliers: ['Old policy'], unprefixed: ['Old policy'], share: 0.75, names: ['CA001 - a', 'CA002 - b', 'CA003 - c', 'Old policy'] }, [
      { goalId: 'g1', goalName: 'MFA for everyone', policyNames: ['CA001 - a', 'CA002 - b'] },
    ]),
    snapshot([
      { displayName: 'Disabled one', state: 'disabled' },
      { displayName: 'Forgotten', state: 'enabledForReportingButNotEnforced', modifiedDateTime: daysAgo(STALE_REPORT_ONLY_DAYS + 5) },
    ]),
    ['Group1'],
  )
  assert.ok(items.length >= 5, `expected every kind to fire, got ${items.map((i) => i.kind).join(', ')}`)
  for (const i of items) {
    assert.ok(i.what.length > 0 && i.what.endsWith('.'), `${i.kind} says what, as a sentence`)
    assert.ok(i.why.length > 0, `${i.kind} says why it matters here`)
    assert.ok(i.change.length > 0, `${i.kind} names the exact change`)
    assert.ok(i.id.length > 0, `${i.kind} has an id to key on`)
  }
  // Consolidation names the policies and points at the safe procedure.
  const c = items.find((i) => i.kind === 'consolidate')!
  assert.deepEqual(c.names, ['CA001 - a', 'CA002 - b'], 'the policies are named')
  assert.match(c.change, /report-only/, 'the change is the safe procedure')
  assert.doesNotMatch(c.change, /\bdelete\b/i, 'and never a delete')
  // A disabled policy is the user's call, not IAMAI's.
  assert.match(items.find((i) => i.kind === 'disabled')!.change, /your call/, 'IAMAI never proposes the deletion itself')
})
