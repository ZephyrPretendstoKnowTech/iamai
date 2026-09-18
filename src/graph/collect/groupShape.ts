import { GraphResponseShapeError } from './http.ts'
import type { DirectoryMemberEvidence } from './presence.ts'

export function assignedLicenseSkuIdsOf(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const ids: string[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null
    const skuId = (entry as Record<string, unknown>).skuId
    if (typeof skuId !== 'string' || !skuId.trim()) return null
    ids.push(skuId)
  }
  return ids
}

export function directoryMemberEvidenceOf(raw: Record<string, unknown>): DirectoryMemberEvidence {
  if (typeof raw.id !== 'string' || !raw.id.trim()) throw new GraphResponseShapeError('direct member row without a stable id')
  const type = String(raw['@odata.type'] ?? '')
  return {
    id: raw.id,
    displayName: typeof raw.displayName === 'string' ? raw.displayName : null,
    userPrincipalName: typeof raw.userPrincipalName === 'string' ? raw.userPrincipalName : null,
    kind: type.endsWith('.user') ? 'user' : type.endsWith('.group') ? 'group' : type.endsWith('.servicePrincipal') ? 'servicePrincipal' : type.endsWith('.device') ? 'device' : 'other',
  }
}

export function directMemberObjectsOf(rows: readonly unknown[]): DirectoryMemberEvidence[] {
  return rows.map(row => {
    if (!row || typeof row !== 'object') throw new GraphResponseShapeError('direct member row is not an object')
    return directoryMemberEvidenceOf(row as Record<string, unknown>)
  })
}
