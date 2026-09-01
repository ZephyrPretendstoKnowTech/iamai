// The list variables a content step renders (prompt 51 §8.9, owner: derive
// collected data, never gate it). Each {list:...} the content file uses is a
// view over what the scan already collected — the mfaViability buckets over
// authMethods + registrationDetails + sign-ins, the lockout-scenario people from
// scenarioEvidence, and the emergency/service/admin id sets — resolved to names.
//
// Pure: no DOM, no network. Runs in Node tests and in the worker.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability, rolloutBucket } from '../scoring/mfaViability.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { adminUserIds, ROLE_TEMPLATES } from '../roles.ts'
import { CORE_ADMIN_ROLE_IDS } from '../coverage/classify.ts'
import { sharedDeviceIds } from './sharedDevices.ts'

export type ListContext = {
  snapshot: TenantSnapshot
  mapping: MappingState
  nameOf: (id: string) => string
  now: string
}

const roleName = (id: string): string => ROLE_TEMPLATES.find((r) => r.templateId.toLowerCase() === id.toLowerCase())?.name ?? id
const people = (ev: { people: string[] } | undefined | null): string[] => ev?.people ?? []

/**
 * Every list variable the content file can fill from this tenant, resolved to
 * names. A step reads only the keys it uses; extra keys are harmless. A list the
 * scan cannot produce is simply absent (the renderer's none-branch handles it).
 */
export function contentLists(ctx: ListContext): Record<string, string[]> {
  const { snapshot, mapping, nameOf, now } = ctx
  const svc = new Set(mapping.serviceAccountUserIds)
  const viability = buildViabilityInputs(snapshot, now, svc).map(scoreMfaViability)
  const active = viability.filter((v) => v.enabled && v.activity === 'active')
  const names = (ids: readonly string[]): string[] => ids.map(nameOf)
  const scen = snapshot.scenarioEvidence ?? null

  // The registration campaign buckets (§6, the campaign step). Each person once,
  // in the first bucket that applies — the order the content lists them in.
  const noMethod = active.filter((v) => rolloutBucket(v) === 'noMethod')
  const smsOnly = active.filter((v) => v.signals.smsVoiceOnly || (v.methodTiers.length > 0 && v.methodTiers.every((t) => t === 'smsVoice')))
  const pushOnly = active.filter((v) => v.methodTiers.includes('push') && !v.methodTiers.includes('phishingResistant') && !v.methodTiers.includes('passwordless') && v.mfa !== 'verified')
  const possiblyBroken = active.filter((v) => v.mfa === 'unverified' && v.signals.observableInWindow === false)
  const unproven = active.filter((v) => rolloutBucket(v) === 'unproven')
  const bucketName = (rows: MfaViability[]): string[] => rows.map((v) => nameOf(v.userId))

  return {
    // Campaign buckets (mfaViability over collected methods + sign-ins).
    noMethod: bucketName(noMethod),
    insufficient: bucketName(smsOnly),
    pushOnly: bucketName(pushOnly),
    possiblyBroken: bucketName(possiblyBroken),
    unproven: bucketName(unproven),
    // Lockout-scenario people (scenarioEvidence, from the sign-in rows).
    legacyUsers: names(people(scen?.legacyClients)),
    serverUsers: names(people(scen?.serverSignIns)),
    ropcAccounts: names(people(scen?.ropcAutomation)),
    unmanagedUsers: names(people(scen?.browserWithoutClaims)),
    browserUsers: names(people(scen?.browserWithoutClaims)),
    guestsWithState: names(people(scen?.guestsSeen)),
    sharedDevices: names(sharedDeviceIds(snapshot)),
    // Emergency, service and admin id sets (mapping, roles).
    emergencyAccounts: names(mapping.breakGlassUserIds),
    emergencyAccountUpns: mapping.breakGlassUserIds.map((id) => upnOf(snapshot, id) ?? nameOf(id)),
    serviceAccounts: names(mapping.serviceAccountUserIds),
    admins: names([...adminUserIds(snapshot.roles)]),
    coreAdminRoles: [...CORE_ADMIN_ROLE_IDS].map(roleName),
    eligible: names(Object.keys(snapshot.roles.eligible)),
  }
}

function upnOf(snapshot: TenantSnapshot, id: string): string | undefined {
  const u = snapshot.users.find((x) => (x as { id?: string }).id === id) as { userPrincipalName?: string } | undefined
  return u?.userPrincipalName
}
