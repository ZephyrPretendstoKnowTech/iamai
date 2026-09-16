import type { MappingState, PasskeyApprovedModel } from './types.ts'

export const PASSKEY_MODELS_STEP = 's-prereq-passkey-settings'
export const PASSKEY_MODELS_ANSWER = 'Additional Authenticators'
export const PASSKEY_MODELS_ACCEPT = 'accept-passkey-model-deviation'
const AAGUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Reject an invalid approval as a whole; never silently approve only part of it. */
export function normalizePasskeyApprovedModels(value: unknown): PasskeyApprovedModel[] | null {
  if (!Array.isArray(value)) return null
  const result: PasskeyApprovedModel[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name.trim() || typeof item.aaguid !== 'string' || !AAGUID.test(item.aaguid.trim())) return null
    const aaguid = item.aaguid.trim().toLowerCase()
    if (!seen.has(aaguid)) result.push({ name: item.name.trim(), aaguid })
    seen.add(aaguid)
  }
  return result
}

export function parsePasskeyApprovedModels(value: string | undefined): PasskeyApprovedModel[] | null {
  if (typeof value !== 'string') return null
  try { return normalizePasskeyApprovedModels(JSON.parse(value)) } catch { return null }
}

export function passkeyApprovedModelsOf(mapping: Pick<MappingState, 'passkeyApprovedModels'>): PasskeyApprovedModel[] {
  return normalizePasskeyApprovedModels(mapping.passkeyApprovedModels) ?? []
}
