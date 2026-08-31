// The lockout-scenario derivations (prompt 48 item 3) over synthetic rows:
// each fires on the rows that carry its evidence and stays silent otherwise,
// and a row stored before schema 7 (no device labels) never fires a
// device-based line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { StoredSignIn } from '../graph/collect/types.ts'
import { deriveScenarioEvidence, emptyScenarioEvidence } from './evidence.ts'

const AT = '2026-08-20T09:00:00Z'
let n = 0
const row = (over: Partial<StoredSignIn>): StoredSignIn => ({
  id: `r${++n}`,
  createdDateTime: AT,
  userId: 'u1',
  os: 'Windows',
  browser: '',
  isCompliant: true,
  isManaged: true,
  trustType: 'joined',
  crossTenantAccessType: 'none',
  appDisplayName: 'Microsoft Teams',
  appId: '1fec8e78-bce4-4aaf-ab1b-5451cc387264',
  resourceDisplayName: 'Microsoft Graph',
  namedLocations: [],
  trustedLocation: false,
  authenticationDetails: [{ succeeded: true, authenticationMethod: 'Password' }],
  ...over,
})

test('nothing fires on clean rows, and every shape is present', () => {
  const e = deriveScenarioEvidence([row({}), row({ userId: 'u2' })])
  const zero = emptyScenarioEvidence()
  for (const k of Object.keys(zero) as (keyof typeof zero)[]) {
    if (k === 'trustedLocationMatches') continue
    assert.equal((e[k] as { count: number }).count, 0, `${k} is silent`)
    assert.deepEqual((e[k] as { people: string[] }).people, [], `${k} names nobody`)
  }
  assert.equal(e.trustedLocationMatches.total, 2)
})

test('legacy clients are named per person; the phone Mail app is Exchange ActiveSync', () => {
  const e = deriveScenarioEvidence([
    row({ userId: 'a', clientAppUsed: 'IMAP4' }),
    row({ userId: 'a', clientAppUsed: 'Authenticated SMTP' }),
    row({ userId: 'b', clientAppUsed: 'Exchange ActiveSync' }),
    row({ userId: 'c', clientAppUsed: 'Browser' }),
  ])
  assert.deepEqual(e.legacyClients.people, ['a', 'b'])
  assert.deepEqual(e.legacyClients.byPerson, { a: ['Authenticated SMTP', 'IMAP4'], b: ['Exchange ActiveSync'] })
  assert.equal(e.legacyClients.detail['Exchange ActiveSync'], 1)
})

test('password not typed: every sign-in by PRT, Hello, passkey or certificate; one password disqualifies', () => {
  const e = deriveScenarioEvidence([
    row({ userId: 'hello', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Windows Hello for Business' }] }),
    row({ userId: 'hello', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Primary Refresh Token' }] }),
    row({ userId: 'mixed', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Passkey (device-bound)' }] }),
    row({ userId: 'mixed', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Password' }] }),
  ])
  assert.deepEqual(e.passwordNotTyped.people, ['hello'])
  assert.equal(e.passwordNotTyped.count, 2)
})

test('ROPC and password-only sign-ins to technician tools or custom apps; risk; servers; guests; partners', () => {
  const e = deriveScenarioEvidence([
    row({ userId: 'svc', authenticationProtocol: 'ropc', appId: '1950a258-227b-4e31-a9cf-717495945fc2', appDisplayName: 'Microsoft Azure PowerShell' }),
    row({ userId: 'svc2', authenticationRequirement: 'singleFactorAuthentication', appId: '99999999-0000-0000-0000-000000000001', appDisplayName: 'Backup Orchestrator' }),
    row({ userId: 'risky', riskLevelAggregated: 'high' }),
    row({ userId: 'ops', appId: '372140e0-b3b7-4226-8ef9-d57986796201', appDisplayName: 'Azure Windows VM Sign-In' }),
    row({ userId: 'guest', crossTenantAccessType: 'b2bCollaboration' }),
    row({ userId: 'msp', crossTenantAccessType: 'serviceProvider', homeTenantId: 't-partner-1' }),
    row({ userId: 'msp2', crossTenantAccessType: 'serviceProvider', homeTenantId: 't-partner-1' }),
  ])
  assert.deepEqual(e.ropcAutomation.people, ['svc', 'svc2'])
  assert.deepEqual(e.ropcAutomation.byPerson.svc, ['Microsoft Azure PowerShell'])
  assert.deepEqual(e.highUserRisk.people, ['risky'])
  assert.deepEqual(e.serverSignIns.people, ['ops'])
  assert.deepEqual(e.guestsSeen.people, ['guest'])
  assert.deepEqual(e.serviceProviderSignIns.people, ['msp', 'msp2'])
  assert.equal(e.serviceProviderSignIns.homeTenants, 1)
})

test('device-based lines: technician tools off compliance, unregistered Windows, browsers without claims, empty platform', () => {
  const rows = [
    row({ userId: 'tech', appId: '14d82eec-204b-4c2f-b7e8-296a70dab67e', appDisplayName: 'Microsoft Graph Command Line Tools', isCompliant: false, isManaged: false, trustType: 'none' }),
    row({ userId: 'home', appDisplayName: 'Outlook', resourceDisplayName: 'Office 365 Exchange Online', trustType: 'none', isCompliant: false, isManaged: false }),
    row({ userId: 'kaladin', browser: 'Chrome', trustType: 'none', isCompliant: false, isManaged: false }),
    row({ userId: 'mobile', os: '', appDisplayName: 'Outlook Mobile' }),
    row({ userId: 'old', os: undefined, browser: undefined, isCompliant: undefined, isManaged: undefined, trustType: undefined, appId: '14d82eec-204b-4c2f-b7e8-296a70dab67e' }),
  ]
  const e = deriveScenarioEvidence(rows, new Set(['kaladin']))
  assert.deepEqual(e.technicianToolsOffCompliance.people, ['tech'], 'a schema-6 row without labels never fires')
  assert.deepEqual(e.unregisteredWindows.people, ['home', 'kaladin'], 'an unregistered Windows browser sign-in to Teams counts too')
  assert.deepEqual(e.browserWithoutClaims.people, ['kaladin'])
  assert.deepEqual(e.browserWithoutClaims.detail, { Chrome: 1 })
  assert.deepEqual(e.emptyPlatform.people, ['mobile'])
  assert.deepEqual(deriveScenarioEvidence(rows, new Set()).browserWithoutClaims.people, [], 'only people who own a compliant device')
})

test('trusted locations: matches per name, trusted flagged; shared devices: only Teams device apps', () => {
  const e = deriveScenarioEvidence([
    row({ namedLocations: ['HQ'], trustedLocation: true }),
    row({ namedLocations: ['HQ', 'Branch'] }),
    row({}),
    row({ userId: 'room', appId: 'cc15fd57-2c6c-4117-a88c-83b1d56b4bbe', appDisplayName: 'Microsoft Teams Services' }),
    row({ userId: 'room', appId: '87749df4-7ccf-48f8-aa87-704bad0e0e16', appDisplayName: 'Microsoft Teams - Device Admin Agent' }),
    row({ userId: 'person', appId: 'cc15fd57-2c6c-4117-a88c-83b1d56b4bbe' }),
    row({ userId: 'person' }),
  ])
  assert.equal(e.trustedLocationMatches.total, 7)
  assert.deepEqual(e.trustedLocationMatches.byLocation, { HQ: 2, Branch: 1 })
  assert.deepEqual(e.trustedLocationMatches.trusted, ['HQ'])
  assert.deepEqual(e.sharedDeviceOnly.people, ['room'])
})

test('non-Microsoft apps are counted per person, and the detail counts people per app', () => {
  const e = deriveScenarioEvidence([
    row({ userId: 'a', appId: 'aaaaaaaa-0000-0000-0000-000000000001', appDisplayName: 'FortiClient VPN' }),
    row({ userId: 'b', appId: 'aaaaaaaa-0000-0000-0000-000000000001', appDisplayName: 'FortiClient VPN' }),
    row({ userId: 'b', appId: 'aaaaaaaa-0000-0000-0000-000000000001', appDisplayName: 'FortiClient VPN' }),
    row({ userId: 'c', appId: 'aaaaaaaa-0000-0000-0000-000000000002', appDisplayName: 'Salesforce' }),
  ])
  assert.deepEqual(e.nonMicrosoftApps.detail, { 'FortiClient VPN': 2, Salesforce: 1 })
  assert.deepEqual(e.nonMicrosoftApps.byPerson.b, ['FortiClient VPN'])
})
