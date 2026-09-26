// Review of fix/exact-and-accept (2026-09-26): which way a difference leans is
// read against the plan's own policy, an acceptance survives the tenant closing
// part of a gap, a session correction can be followed to the end, and every
// correction line that loosens the tenant's policy says so.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acceptanceCovers, acceptanceKeyOf, differencePieces, grantDirectionOf } from './differences.ts'
import { sameDimension } from './observation.ts'
import { correctionSettings, PROCEDURE } from './policyProcedure.ts'
import type { ProcedureContext } from './policyProcedure.ts'
import { buildStrengthLookup } from '../coverage/strength.ts'
import { tenantVocabulary } from '../redactSnapshot.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

type Row = Record<string, unknown>
const STRICTER = PROCEDURE.stricterNote
const MFA = '00000000-0000-0000-0000-000000000002'
const PHISHING_RESISTANT = '00000000-0000-0000-0000-000000000004'
const strengths = buildStrengthLookup([])
const ctx: ProcedureContext = { nameOf: (id) => ({ ex: 'Core - Exclusions', svc: 'Service accounts', vip: 'Old VIP exclusions' } as Record<string, string>)[id] ?? id, exclusionsGroupId: 'ex' }
const users = (u: Row): Row => ({ conditions: { users: u } })

test('a grant leans against the plan’s own grant, never the goal’s floor', () => {
  const grant = (g: Row | null): Row => ({ grantControls: g })
  // The baseline asks for a password change and a passwordless strength; plain MFA with a password change asks less.
  const plan = grant({ operator: 'AND', builtInControls: ['passwordChange'], authenticationStrength: { id: '00000000-0000-0000-0000-000000000003' } })
  assert.equal(grantDirectionOf(plan, grant({ operator: 'AND', builtInControls: ['mfa', 'passwordChange'] }), strengths), 'weaker')
  // A grant where the plan has none asks more.
  assert.equal(grantDirectionOf(grant(null), grant({ operator: 'OR', builtInControls: ['mfa'] }), strengths), 'stricter')
  // Phishing-resistant against the plan's MFA strength asks more; the other way asks less.
  const mfa = grant({ operator: 'OR', builtInControls: [], authenticationStrength: { id: MFA } })
  const pr = grant({ operator: 'OR', builtInControls: [], authenticationStrength: { id: PHISHING_RESISTANT } })
  assert.equal(grantDirectionOf(mfa, pr, strengths), 'stricter')
  assert.equal(grantDirectionOf(pr, mfa, strengths), 'weaker')
  assert.deepEqual(differencePieces('grantControls', mfa, pr, { exclusionsGroupId: null, grant: 'stricter', same: sameDimension }).map((p) => p.direction), ['stricter'])
})

test('an acceptance survives the tenant closing part of a gap; a new gap or a moved setting reopens it', () => {
  const plan = users({ includeRoles: ['r1', 'r2', 'r3'], excludeGroups: ['ex'] })
  const pieces = (tenant: Row) => differencePieces('conditions.users', plan, tenant, { exclusionsGroupId: 'ex', same: sameDimension })
  const saved = acceptanceKeyOf(pieces(users({ includeRoles: ['r1'], excludeGroups: ['ex', 'y', 'z'] })))
  assert.equal(acceptanceCovers(saved, pieces(users({ includeRoles: ['r1', 'r2'], excludeGroups: ['ex', 'y'] }))), true, 'a role added back and an exclusion taken off keep it')
  assert.equal(acceptanceCovers(saved, pieces(users({ includeRoles: ['r1', 'r2', 'r9'], excludeGroups: ['ex', 'y', 'z'] }))), true, 'a role beyond the plan keeps it')
  assert.equal(acceptanceCovers(saved, pieces(users({ includeRoles: ['r1'], excludeGroups: ['ex', 'y', 'z', 'w'] }))), false, 'a new exclusion reopens it')
  const session = (hours: number): Row => ({ sessionControls: { signInFrequency: { isEnabled: true, type: 'hours', value: hours, frequencyInterval: 'timeBased' } } })
  const kept = acceptanceKeyOf(differencePieces('sessionControls', {}, session(4), { exclusionsGroupId: null, same: sameDimension }))
  assert.equal(acceptanceCovers(kept, differencePieces('sessionControls', {}, session(8), { exclusionsGroupId: null, same: sameDimension })), false, 'a setting whose value moved reopens it')
})

test('a session control the tenant adds leans the way it acts, and a changed frequency by which is shorter', () => {
  const pieces = (plan: Row, tenant: Row) => differencePieces('sessionControls', plan, tenant, { exclusionsGroupId: null, same: sameDimension }).map((p) => [p.control, p.change, p.direction])
  assert.deepEqual(pieces({}, { sessionControls: { persistentBrowser: { isEnabled: true, mode: 'always' } } }), [['persistentBrowser', 'extra', 'weaker']])
  assert.deepEqual(pieces({}, { sessionControls: { continuousAccessEvaluation: { mode: 'disabled' } } }), [['continuousAccessEvaluation', 'extra', 'weaker']])
  assert.deepEqual(pieces({}, { sessionControls: { persistentBrowser: { isEnabled: true, mode: 'never' } } }), [['persistentBrowser', 'extra', 'stricter']])
  const freq = (n: number, type: string): Row => ({ sessionControls: { signInFrequency: { isEnabled: true, type, value: n, frequencyInterval: 'timeBased' } } })
  assert.deepEqual(pieces(freq(1, 'days'), freq(4, 'hours')), [['signInFrequency', 'changed', 'stricter']])
  assert.deepEqual(pieces(freq(4, 'hours'), freq(1, 'days')), [['signInFrequency', 'changed', 'weaker']])
})

test('a session correction clears each control the plan does not set, by name, and says when that loosens the policy', () => {
  const plan: Row = { sessionControls: { secureSignInSession: { isEnabled: true } } }
  const tenant: Row = { sessionControls: { secureSignInSession: { isEnabled: true }, signInFrequency: { isEnabled: true, frequencyInterval: 'everyTime' } } }
  const lines = correctionSettings(tenant, plan, ctx, new Set(['session']))
  assert.deepEqual(lines, [`Under **Session**, clear **Sign-in frequency**. ${STRICTER}`])
  const looser = correctionSettings({ sessionControls: { persistentBrowser: { isEnabled: true, mode: 'always' } } }, {}, ctx, new Set(['session']))
  assert.deepEqual(looser, ['Under **Session**, clear every control.'], 'clearing an always-persistent browser tightens the policy: no note')
})

test('narrowing All users, and excluding anyone but the exclusions group, say they loosen the policy', () => {
  const all = users({ includeUsers: ['All'], excludeGroups: ['ex'] })
  const roles = users({ includeRoles: ['62e90394-69f5-4237-9190-012177145e10'], excludeGroups: ['ex'] })
  assert.ok(correctionSettings(all, roles, ctx, new Set(['users']))[0].includes(STRICTER), 'All users narrowed to the plan’s roles')
  assert.equal(correctionSettings(roles, all, ctx, new Set(['users'])).some((l) => l.includes(STRICTER)), false, 'widening to All users tightens it')
  const svc = correctionSettings(users({ includeUsers: ['All'], excludeGroups: ['ex'] }), users({ includeUsers: ['All'], excludeGroups: ['ex', 'svc'] }), ctx, new Set(['users']))
  assert.ok(svc.some((l) => l.startsWith('Under **Users → Exclude**') && l.endsWith(STRICTER)), svc.join(' | '))
  const group = correctionSettings(users({ includeUsers: ['All'] }), users({ includeUsers: ['All'], excludeGroups: ['ex'] }), ctx, new Set(['users']))
  assert.equal(group.some((l) => l.includes(STRICTER)), false, 'adding the exclusions group is required, not a loosening')
})

test('a guest-tenant change is a difference of its own, and only a role the tenant made is a redaction term', () => {
  const plan = users({ includeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest', externalTenants: { membershipKind: 'all' } } })
  const tenant = users({ includeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest', externalTenants: { membershipKind: 'enumerated', members: ['t1'] } } })
  assert.deepEqual(differencePieces('conditions.users', plan, tenant, { exclusionsGroupId: null, same: sameDimension }).map((p) => [p.part, p.control, p.direction]), [['include', 'externalTenants', 'differs']])
  const snapshot = { config: { roleDefinitions: { rows: [{ displayName: 'User', isBuiltIn: true }, { displayName: 'Contoso Helpdesk', isBuiltIn: false }] } } } as unknown as TenantSnapshot
  const terms = [...tenantVocabulary(snapshot).keys()].map((k) => String(k).toLowerCase())
  assert.equal(terms.includes('user'), false, 'Microsoft’s built-in "User" is not the tenant’s word')
  assert.ok(terms.includes('contoso helpdesk'))
})
