// Dev-only check for design §10.5: pull every user's auth methods and apply
// the platform-derivation heuristic (deviceTag → version scheme → displayName
// hint) to the tenant's real Authenticator methods, so the heuristic is
// confirmed against data before it is locked. Saves derivation inputs and
// outcomes only — no method values, no raw display names (keyword hits only).
import { getGraphToken } from '../msal.ts'
import { saveDevResults } from './spike1.ts'

const V1 = 'https://graph.microsoft.com/v1.0'

type AuthenticatorRow = {
  deviceTag: string | null
  phoneAppVersion: string | null
  clientAppName: string | null
  createdDateTime: string | null
  displayNameHint: string | null
  derivedPlatform: 'ios' | 'android' | 'unknown'
  derivedFrom: 'deviceTag' | 'version' | 'displayName' | 'none'
}

export type PlatformCheckResults = {
  checkedAt: string
  userCount: number
  methodKinds: Record<string, number>
  authenticatorMethods: AuthenticatorRow[]
  newestVersionByPlatform: Record<string, string>
  allDerived: boolean
  error?: string
}

const IOS_NAME = /iphone|ipad|\bios\b/i
const ANDROID_NAME = /android|pixel|galaxy|samsung|\bsm-|oneplus|xiaomi|motorola/i

function deriveRow(m: Record<string, unknown>): AuthenticatorRow {
  const deviceTag = typeof m.deviceTag === 'string' ? m.deviceTag : null
  const phoneAppVersion = typeof m.phoneAppVersion === 'string' ? m.phoneAppVersion : null
  const displayName = typeof m.displayName === 'string' ? m.displayName : ''
  const row: AuthenticatorRow = {
    deviceTag,
    phoneAppVersion,
    clientAppName: typeof m.clientAppName === 'string' ? m.clientAppName : null,
    createdDateTime: typeof m.createdDateTime === 'string' ? m.createdDateTime : null,
    displayNameHint: null,
    derivedPlatform: 'unknown',
    derivedFrom: 'none',
  }
  // 10.5 order: deviceTag → version numbering scheme → (fallback) displayName.
  if (deviceTag && /android/i.test(deviceTag)) {
    row.derivedPlatform = 'android'
    row.derivedFrom = 'deviceTag'
  } else if (deviceTag && /ios|iphone|ipad/i.test(deviceTag)) {
    row.derivedPlatform = 'ios'
    row.derivedFrom = 'deviceTag'
  } else if (phoneAppVersion) {
    const minor = Number(phoneAppVersion.split('.')[1])
    if (Number.isFinite(minor)) {
      // Android Authenticator uses date-based minors (6.2xxx.xxxx); iOS small minors (6.8.x).
      row.derivedPlatform = minor >= 1000 ? 'android' : 'ios'
      row.derivedFrom = 'version'
    }
  }
  const iosHit = IOS_NAME.exec(displayName)?.[0]
  const androidHit = ANDROID_NAME.exec(displayName)?.[0]
  row.displayNameHint = iosHit ?? androidHit ?? null
  if (row.derivedFrom === 'none' && (iosHit || androidHit)) {
    row.derivedPlatform = iosHit ? 'ios' : 'android'
    row.derivedFrom = 'displayName'
  }
  return row
}

export async function runPlatformCheck(): Promise<PlatformCheckResults> {
  const token = await getGraphToken()
  const results: PlatformCheckResults = {
    checkedAt: new Date().toISOString(),
    userCount: 0,
    methodKinds: {},
    authenticatorMethods: [],
    newestVersionByPlatform: {},
    allDerived: false,
  }
  try {
    const usersRes = await fetch(`${V1}/users?$select=id&$top=999`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const users: { value?: { id: string }[] } = await usersRes.json()
    const ids = (users.value ?? []).map((u) => u.id)
    results.userCount = ids.length

    for (let i = 0; i < ids.length; i += 20) {
      const chunk = ids.slice(i, i + 20)
      const res = await fetch(`${V1}/$batch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          requests: chunk.map((id, n) => ({ id: String(n + 1), method: 'GET', url: `/users/${id}/authentication/methods` })),
        }),
      })
      const body: { responses?: { status: number; body?: { value?: Record<string, unknown>[] } }[] } =
        await res.json()
      for (const r of body.responses ?? []) {
        for (const m of r.body?.value ?? []) {
          const type = String(m['@odata.type'] ?? 'unknown').replace('#microsoft.graph.', '')
          results.methodKinds[type] = (results.methodKinds[type] ?? 0) + 1
          if (type === 'microsoftAuthenticatorAuthenticationMethod') {
            results.authenticatorMethods.push(deriveRow(m))
          }
        }
      }
    }

    for (const row of results.authenticatorMethods) {
      if (row.derivedPlatform === 'unknown' || !row.phoneAppVersion) continue
      const cur = results.newestVersionByPlatform[row.derivedPlatform]
      const newer =
        !cur ||
        row.phoneAppVersion.split('.').map(Number).join() > cur.split('.').map(Number).join()
      // crude compare is fine for a spike; the real implementation compares numerically
      if (newer) results.newestVersionByPlatform[row.derivedPlatform] = row.phoneAppVersion
    }
    results.allDerived = results.authenticatorMethods.every((r) => r.derivedPlatform !== 'unknown')
  } catch (e) {
    results.error = e instanceof Error ? e.message : String(e)
  }
  console.log('[platform-check] RESULTS', JSON.stringify(results, null, 2))
  await saveDevResults('platform-check', results)
  return results
}

declare global {
  interface Window {
    __runPlatformCheck?: typeof runPlatformCheck
  }
}

if (import.meta.env.DEV) {
  window.__runPlatformCheck = runPlatformCheck
}
