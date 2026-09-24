// Prompt 53, night-1: the derivations behind the first walk's P0s, pinned so
// they cannot come back. A shared reference ({datesNew}) with a hole is a hole
// in the line that uses it; a policy already in report-only takes its date from
// the scan; a session goal fills {wanted} from the baseline policy it maps to.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// On the curated baseline (fixtures/index.ts `curatedFixture`): this is about a
// policy that can be written, not about the source groups this baseline has not
// settled (roadmap/sourceIdentity.test.ts).
import { curatedFixture as fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { missingVars } from '../../content/render.ts'
import { shared } from '../../content/content.ts'
import { sessionWantedForGoal, sessionWantedLongForGoal } from './stepPortal.ts'
import { stepVars } from './stepVars.ts'
import { hoursInWords } from '../../coverage/verdict.ts'
import { effectsOf } from '../../roadmap/strand.ts'
import { PINNED } from '../../baseline/pinned.ts'
import { PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'

test('a shared reference with an unfilled variable is a hole in the line that names it', () => {
  // {datesNew} expands to "Announce {announce} · Report-only from {reportOnly} · Enforce {enforce}".
  assert.match(String((shared as Record<string, unknown>).datesNew), /\{announce\}/)
  assert.deepEqual(missingVars('{datesNew}', {}), ['announce', 'reportOnly', 'enforce'])
  assert.deepEqual(missingVars('{datesNew}', { announce: 'Sep 1', reportOnly: 'Sep 1', enforce: 'Sep 8' }), [])
  assert.deepEqual(missingVars('{datesNew}', { announce: 'Sep 1', enforce: 'Sep 8' }), ['reportOnly'], 'the walk saw "Report-only from ·"')
  // The signature reference has a default and is never a hole.
  assert.deepEqual(missingVars('Regards, {signature}', {}), [])
})

/** The fixture on a package that carries its own admin-session policy: every admin role but the pin's, twelve hours, never persistent. */
function withOwnAdminSession(f: Fixture): Fixture {
  const first = f.baseline.policies[0] as unknown as { conditions: { users: { excludeGroups?: string[] } }; placeholders?: Record<string, string> }
  const pinned = PINNED.policies.find((p) => p.id === PINNED_GOAL_MAP['admin-session'][0])!
  const roles = (pinned.conditions as { users: { includeRoles: string[] } }).users.includeRoles
  const own = {
    id: '0000a115-0000-4000-8000-000000000001',
    displayName: 'Custom - Session - Admin sign-in frequency',
    state: 'enabled',
    placeholders: first.placeholders,
    conditions: { users: { includeRoles: roles, excludeGroups: first.conditions.users.excludeGroups ?? [] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['browser'] },
    grantControls: null,
    sessionControls: { persistentBrowser: { isEnabled: true, mode: 'never' }, signInFrequency: { isEnabled: true, type: 'hours', value: 12, frequencyInterval: 'timeBased', authenticationType: 'primaryAndSecondaryAuthentication' } },
  }
  return { ...f, baseline: { ...f.baseline, policies: [...f.baseline.policies, own] as typeof f.baseline.policies } }
}

test('a session goal fills {wanted} from the policy the step will write, and says nothing where it cannot read one', () => {
  assert.equal(sessionWantedForGoal('admin-session'), '4 hours', 'the baseline still answers for a step with no policy of its own')
  assert.equal(sessionWantedForGoal('mfa-all-users'), null, 'a grant goal wants no session frequency')
  assert.equal(hoursInWords(168), 'weekly')
  assert.equal(hoursInWords(24), 'daily')
  const varsFor = (f: Fixture): { ex: Record<string, unknown>; hours: number | null } => {
    const r = runFixture(f)
    const step = r.steps.find((s) => s.goalId === 'admin-session')!
    const hours = (effectsOf(step) ?? []).map((e) => e.sessionControls?.signInFrequencyHours ?? null).find((h) => h !== null) ?? null
    return { ex: stepVars(step, { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, signature: 'IT', operatorId: null, now: f.snapshot.asOf }) as Record<string, unknown>, hours }
  }
  // The operation the step will run says how long a session lives — whatever the
  // baseline's own version of the goal wants. A goal the package carries no
  // policy for is written from the pinned one (q-pin), so this tenant's package
  // carries an admin-session policy of its own, at twelve hours.
  const { ex, hours } = varsFor(withOwnAdminSession(fixture('getiamai')))
  assert.equal(hours, 12, 'this tenant’s admin-session policy sets twelve hours')
  assert.equal(ex.wanted, hoursInWords(hours!), 'the manager note "expire after {wanted}" fills from the policy')
  assert.equal(ex.wantedLong, '12 hours', 'the email "expire after {wantedLong}" fills, as a duration')
  assert.notEqual(ex.wanted, sessionWantedForGoal('admin-session'), 'and not from the baseline the goal maps to')
  // The demo cannot write this policy: an object it names is missing. A line
  // that told the operator what their sessions will expire after would be
  // describing the author's policy, not one this tenant is getting.
  const { ex: held } = varsFor(noExclusionsAnswer(fixture('demo')))
  assert.equal(held.wanted, undefined, 'a policy the plan cannot write says nothing about the session it would set')
  assert.equal(held.wantedLong, undefined)
  assert.equal(sessionWantedLongForGoal('mfa-all-users'), null)
})

