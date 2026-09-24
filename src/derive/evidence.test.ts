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
    // A clean row is a Teams sign-in, which is what the mail-or-Teams derivation reports (E6).
    if (k === 'officeSignIns') continue
    assert.equal((e[k] as { count: number }).count, 0, `${k} is silent`)
    assert.deepEqual((e[k] as { people: string[] }).people, [], `${k} names nobody`)
  }
  assert.equal(e.trustedLocationMatches.total, 2)
  assert.deepEqual(e.officeSignIns!.byPerson, { u1: ['Microsoft Teams'], u2: ['Microsoft Teams'] }, 'the Teams sign-in is a mail-or-Teams sign-in, by person')
})

test('each scenario line fires on the rows that carry its evidence, per person, and on nothing else', () => {
  // mail or Teams sign-ins are named per person; the Azure portal and the management API are Azure sign-ins (E6, E9)
  {
    const e = deriveScenarioEvidence([
      row({ userId: 'a', appDisplayName: 'Outlook', resourceDisplayName: 'Office 365 Exchange Online' }),
      row({ userId: 'a', clientAppUsed: 'IMAP4', appDisplayName: 'Mail client' }),
      row({ userId: 'b', appId: 'c44b4083-3bb0-49c1-b47d-974e53cbdf3c', appDisplayName: 'Azure Portal', resourceDisplayName: 'Windows Azure Service Management API' }),
      row({ userId: 'c', appId: '14d82eec-204b-4c2f-b7e8-296a70dab67e', appDisplayName: 'Microsoft Graph Command Line Tools' }),
    ])
    assert.deepEqual(e.officeSignIns!.byPerson, { a: ['Mail client', 'Outlook'] })
    assert.deepEqual(e.azureSignIns!.people, ['b'])
    assert.equal(e.azureSignIns!.count, 1)
  }
  // legacy clients are named per person; the phone Mail app is Exchange ActiveSync
  {
    const e = deriveScenarioEvidence([
      row({ userId: 'a', clientAppUsed: 'IMAP4' }),
      row({ userId: 'a', clientAppUsed: 'Authenticated SMTP' }),
      row({ userId: 'b', clientAppUsed: 'Exchange ActiveSync' }),
      row({ userId: 'c', clientAppUsed: 'Browser' }),
    ])
    assert.deepEqual(e.legacyClients.people, ['a', 'b'])
    assert.deepEqual(e.legacyClients.byPerson, { a: ['Authenticated SMTP', 'IMAP4'], b: ['Exchange ActiveSync'] })
    assert.equal(e.legacyClients.detail['Exchange ActiveSync'], 1)
  }
  // password not typed: every sign-in by PRT, Hello, passkey or certificate; one password disqualifies
  {
    const e = deriveScenarioEvidence([
      row({ userId: 'hello', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Windows Hello for Business' }] }),
      row({ userId: 'hello', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Primary Refresh Token' }] }),
      row({ userId: 'mixed', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Passkey (device-bound)' }] }),
      row({ userId: 'mixed', authenticationDetails: [{ succeeded: true, authenticationMethod: 'Password' }] }),
    ])
    assert.deepEqual(e.passwordNotTyped.people, ['hello'])
    assert.equal(e.passwordNotTyped.count, 2)
  }
  // ROPC and password-only sign-ins to technician tools or custom apps; risk; servers; guests; partners
  {
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
  }
  // device-based lines: technician tools off compliance, unregistered Windows, browsers without claims, empty platform
  {
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
  }
  // trusted locations: matches per name, trusted flagged; shared devices: only Teams device apps
  {
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
  }
  // non-Microsoft apps are counted per person, and the detail counts people per app
  {
    const e = deriveScenarioEvidence([
      row({ userId: 'a', appId: 'aaaaaaaa-0000-0000-0000-000000000001', appDisplayName: 'FortiClient VPN' }),
      row({ userId: 'b', appId: 'aaaaaaaa-0000-0000-0000-000000000001', appDisplayName: 'FortiClient VPN' }),
      row({ userId: 'b', appId: 'aaaaaaaa-0000-0000-0000-000000000001', appDisplayName: 'FortiClient VPN' }),
      row({ userId: 'c', appId: 'aaaaaaaa-0000-0000-0000-000000000002', appDisplayName: 'Salesforce' }),
    ])
    assert.deepEqual(e.nonMicrosoftApps.detail, { 'FortiClient VPN': 2, Salesforce: 1 })
    assert.deepEqual(e.nonMicrosoftApps.byPerson.b, ['FortiClient VPN'])
  }
  // a registered computer is counted as not joined, and separately from one with no trust at all
  {
    // Entra has three device trust types and only two of them are a join, so a
    // REGISTERED computer is a computer that is not joined. `unjoinedComputers`
    // deliberately counts neither-joined-nor-registered-nor-compliant-nor-managed
    // devices — devices with no identity the scan could read — and the question
    // above it said "computers that aren't joined", which is a far wider
    // population. The wording now matches what it counts, and the registered
    // population, which is what "make them Managed" actually costs, is its own
    // number instead of being silently folded away.
    const rows = [
      // No identity at all: the unjoined line's population.
      row({ userId: 'u-unknown', trustType: 'none', isCompliant: false, isManaged: false }),
      // Registered to the tenant, and not joined: work under a Managed answer.
      row({ userId: 'u-registered-1', trustType: 'registered', isCompliant: false, isManaged: false }),
      row({ userId: 'u-registered-2', trustType: 'registered', isCompliant: false, isManaged: false, os: 'macOS' }),
      // Already joined, and a phone: neither line's business.
      row({ userId: 'u-joined', trustType: 'joined' }),
      row({ userId: 'u-phone', os: 'iOS', trustType: 'registered', isCompliant: false, isManaged: false }),
    ]
    const e = deriveScenarioEvidence(rows, new Set())

    assert.deepEqual(e.unjoinedComputers?.people, ['u-unknown'], 'the unidentified line took in a device whose trust the scan could read')
    assert.deepEqual(e.registeredComputers?.people, ['u-registered-1', 'u-registered-2'], 'the registered line is not the registered computers')
    // A phone is not a computer on either line, whatever its trust.
    for (const d of [e.unjoinedComputers, e.registeredComputers]) assert.equal(d?.people.includes('u-phone'), false, 'a phone is counted as a computer')
    // The two populations are disjoint: a device is in one line or the other,
    // never both, so the reader can add them without double-counting anyone.
    const overlap = (e.registeredComputers?.people ?? []).filter((p) => (e.unjoinedComputers?.people ?? []).includes(p))
    assert.deepEqual(overlap, [], 'a person is counted on both device lines')
  }
})
