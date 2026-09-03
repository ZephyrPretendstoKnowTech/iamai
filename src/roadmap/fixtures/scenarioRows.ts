// Synthetic sign-in rows so every lockout scenario fires on at least one
// fixture and on none where the evidence is absent (prompt 48 item 8). Keyed
// by fixture name; each returns raw StoredSignIn rows that the derivations
// then read, exactly as the collection worker would. Small and mid carry the
// person-level scenarios; large carries high risk (it is the hybrid tenant).
import type { StoredSignIn } from '../../graph/collect/types.ts'

const AT = '2026-08-15T09:00:00.000Z'
let seq = 0
function row(over: Partial<StoredSignIn>): StoredSignIn {
  return {
    id: `sc-${++seq}`,
    createdDateTime: AT,
    userId: '',
    os: 'Windows',
    browser: '',
    isCompliant: true,
    isManaged: true,
    trustType: 'joined',
    crossTenantAccessType: 'none',
    appId: '1fec8e78-bce4-4aaf-ab1b-5451cc387264',
    appDisplayName: 'Microsoft Teams',
    resourceDisplayName: 'Microsoft Graph',
    namedLocations: [],
    trustedLocation: false,
    authenticationDetails: [{ succeeded: true, authenticationMethod: 'Password' }],
    ...over,
  }
}

/** ids are the fixture's directory ids; svcIds the service accounts; the returned rows carry those ids. */
export function scenarioRows(name: string, ids: string[], svcIds: string[]): StoredSignIn[] {
  const u = (i: number): string => ids[i] ?? ids[0] ?? 'u0'
  if (name === 'small') {
    return [
      // 1 / 7 / 21 — legacy mail clients.
      row({ userId: u(2), clientAppUsed: 'IMAP4' }),
      row({ userId: svcIds[0] ?? u(3), clientAppUsed: 'Authenticated SMTP' }),
      row({ userId: u(4), clientAppUsed: 'Exchange ActiveSync' }),
      // 12 — password never typed (all sign-ins passwordless).
      row({ userId: u(5), authenticationDetails: [{ succeeded: true, authenticationMethod: 'Windows Hello for Business' }] }),
      row({ userId: u(5), authenticationDetails: [{ succeeded: true, authenticationMethod: 'Primary Refresh Token' }] }),
      // 6 — a guest signs in (trust off by default).
      row({ userId: u(6), crossTenantAccessType: 'b2bCollaboration' }),
      // 4 — a non-Microsoft app for the session steps.
      row({ userId: u(7), appId: 'ffffffff-0000-0000-0000-000000000001', appDisplayName: 'FortiClient VPN' }),
      row({ userId: u(8), appId: 'ffffffff-0000-0000-0000-000000000001', appDisplayName: 'FortiClient VPN' }),
      // 17 — an empty-platform mobile sign-in.
      row({ userId: u(9), os: '', appDisplayName: 'Outlook Mobile' }),
      // 5 — a trusted location matched by fewer than half the sign-ins.
      ...Array.from({ length: 10 }, () => row({ userId: u(1), namedLocations: [] })),
      row({ userId: u(1), namedLocations: ['Head office'], trustedLocation: true }),
    ]
  }
  if (name === 'mid') {
    return [
      // 19 — ROPC to a technician tool.
      row({ userId: svcIds[0] ?? u(3), authenticationProtocol: 'ropc', appId: '1950a258-227b-4e31-a9cf-717495945fc2', appDisplayName: 'Microsoft Azure PowerShell' }),
      // 11 — service-provider (GDAP) sign-ins from one partner tenant.
      row({ userId: u(4), crossTenantAccessType: 'serviceProvider', homeTenantId: 't-partner-1' }),
      row({ userId: u(5), crossTenantAccessType: 'serviceProvider', homeTenantId: 't-partner-1' }),
      // 8 — a shared-device-only account (Teams device apps only).
      row({ userId: sharedId(ids), appId: 'cc15fd57-2c6c-4117-a88c-83b1d56b4bbe', appDisplayName: 'Microsoft Teams Services' }),
      row({ userId: sharedId(ids), appId: '87749df4-7ccf-48f8-aa87-704bad0e0e16', appDisplayName: 'Microsoft Teams - Device Admin Agent' }),
      // 15 — high user risk on the mixed-licence tenant (half its seats are P2, so the
      // user-risk step exists): the one P2 scenario that fires without the huge fixture (prune A).
      row({ userId: u(6), riskLevelAggregated: 'high' }),
      row({ userId: u(7), riskLevelAggregated: 'high' }),
    ]
  }
  if (name === 'large') {
    // The Intune tenant, so require-managed-device applies: the device scenarios land here (items 3, 16, 18, 9).
    return [
      row({ userId: u(0), appId: '14d82eec-204b-4c2f-b7e8-296a70dab67e', appDisplayName: 'Microsoft Graph Command Line Tools', isCompliant: false, isManaged: false, trustType: 'none' }),
      row({ userId: u(1), appId: '372140e0-b3b7-4226-8ef9-d57986796201', appDisplayName: 'Azure Windows VM Sign-In' }),
      row({ userId: u(2), appDisplayName: 'Outlook', resourceDisplayName: 'Office 365 Exchange Online', trustType: 'none', isCompliant: false, isManaged: false }),
      row({ userId: u(1), browser: 'Chrome', trustType: 'none', isCompliant: false, isManaged: false }),
    ]
  }
  if (name === 'huge') {
    // The P2 tenant, so the user-risk step exists: high risk lands here (item 15), and huge carries a hybrid user for the writeback can't-see.
    return [
      row({ userId: u(3), riskLevelAggregated: 'high' }),
      row({ userId: u(4), riskLevelAggregated: 'high' }),
    ]
  }
  if (name === 'demo' || name === 'demo-week2') {
    // The demo carries the lockout scenarios a small P1 + Intune business meets,
    // so at least twelve fire on it (prompt 50 items 9, 10).
    return [
      // 1 / 7 / 21 — legacy mail clients: a person on IMAP, the printer on SMTP AUTH, a phone's built-in Mail.
      row({ userId: u(4), clientAppUsed: 'IMAP4' }),
      row({ userId: svcIds[0] ?? u(5), clientAppUsed: 'Authenticated SMTP' }),
      row({ userId: u(6), clientAppUsed: 'Exchange ActiveSync' }),
      // 4 — a non-Microsoft app for the session steps.
      row({ userId: u(7), appId: 'ffffffff-0000-0000-0000-000000000001', appDisplayName: 'FortiClient VPN' }),
      row({ userId: u(8), appId: 'ffffffff-0000-0000-0000-000000000001', appDisplayName: 'FortiClient VPN' }),
      // 6 — a guest signs in (trust off by default).
      row({ userId: u(9), crossTenantAccessType: 'b2bCollaboration' }),
      // 11 — one partner (GDAP) sign-in.
      row({ userId: u(10), crossTenantAccessType: 'serviceProvider', homeTenantId: 't-partner-1' }),
      // 12 — a person who has not typed a password (passwordless sign-ins only).
      row({ userId: u(11), authenticationDetails: [{ succeeded: true, authenticationMethod: 'Windows Hello for Business' }] }),
      // 17 — an empty-platform mobile sign-in.
      row({ userId: u(12), os: '', appDisplayName: 'Outlook Mobile' }),
      // Phones (E2): two people read work mail on a phone, so the device decision is asked.
      row({ userId: u(14), os: 'iOS', appDisplayName: 'Outlook Mobile', trustType: 'none', isCompliant: false, isManaged: false }),
      row({ userId: u(15), os: 'Android', appDisplayName: 'Microsoft Teams', trustType: 'none', isCompliant: false, isManaged: false }),
      // 3 — a technician tool from a non-compliant device (Intune tenant).
      row({ userId: u(0), appId: '14d82eec-204b-4c2f-b7e8-296a70dab67e', appDisplayName: 'Microsoft Graph Command Line Tools', isCompliant: false, isManaged: false, trustType: 'none' }),
      // 16 — a server sign-in.
      row({ userId: u(1), appId: '372140e0-b3b7-4226-8ef9-d57986796201', appDisplayName: 'Azure Windows VM Sign-In' }),
      // 9 — Outlook from an unregistered Windows device (token protection).
      row({ userId: u(2), appDisplayName: 'Outlook', resourceDisplayName: 'Office 365 Exchange Online', trustType: 'none', isCompliant: false, isManaged: false }),
      // 18 — a compliant laptop on Chrome without device claims.
      row({ userId: u(1), browser: 'Chrome', trustType: 'none', isCompliant: false, isManaged: false }),
      // 19 — a script on ROPC to a technician tool.
      row({ userId: svcIds[1] ?? u(13), authenticationProtocol: 'ropc', appId: '1950a258-227b-4e31-a9cf-717495945fc2', appDisplayName: 'Microsoft Azure PowerShell' }),
      // 5 — a stale trusted location: fewer than half the sign-ins match it.
      ...Array.from({ length: 10 }, () => row({ userId: u(3), namedLocations: [] })),
      row({ userId: u(3), namedLocations: ['Head office'], trustedLocation: true }),
    ]
  }
  return []
}

/** The shared-device account id a fixture reserves (the last directory id). */
export function sharedId(ids: string[]): string {
  return ids[ids.length - 1] ?? 'u0'
}
