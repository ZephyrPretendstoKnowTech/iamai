// IndexedDB cache for Lane B evidence (docs/design/collection.md §11–§12).
// Raw sign-in rows stay on this device only; "Forget this tenant" deletes
// everything stored for a tenant. Works in both the worker and the main
// thread. Every call is failure-tolerant: a broken/unavailable IndexedDB
// degrades to "no cache", never to a scan failure.
import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { StoredSignIn } from './types.ts'

export type EvidenceCacheMeta = {
  tenantId: string
  covered: { from: string; to: string }
  asOf: string
  // Bumped when the Lane B $select changes; a mismatched cache is ignored.
  schema?: number
}

export type GroupMembersCacheEntry = {
  tenantId: string
  groupId: string
  displayName: string | null
  membershipRule: string | null
  memberCount: number
  memberIds: string[]
  sampled: boolean
  asOf: string
}

interface IamaiDB extends DBSchema {
  'signin-rows': {
    key: [string, string]
    value: StoredSignIn & { tenantId: string }
    indexes: { byTenant: string }
  }
  'evidence-meta': {
    key: string
    value: EvidenceCacheMeta
  }
  'group-members': {
    key: [string, string]
    value: GroupMembersCacheEntry
    indexes: { byTenant: string }
  }
  mapping: {
    key: string
    value: { tenantId: string } & Record<string, unknown>
  }
  plan: {
    key: string
    value: { tenantId: string } & Record<string, unknown>
  }
  snapshot: {
    key: string
    value: { tenantId: string } & Record<string, unknown>
  }
}

let dbPromise: Promise<IDBPDatabase<IamaiDB>> | null = null

function db(): Promise<IDBPDatabase<IamaiDB>> {
  dbPromise ??= openDB<IamaiDB>('iamai', 5, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        const rows = d.createObjectStore('signin-rows', { keyPath: ['tenantId', 'id'] })
        rows.createIndex('byTenant', 'tenantId')
        d.createObjectStore('evidence-meta', { keyPath: 'tenantId' })
      }
      if (oldVersion < 2) {
        const groups = d.createObjectStore('group-members', { keyPath: ['tenantId', 'groupId'] })
        groups.createIndex('byTenant', 'tenantId')
      }
      if (oldVersion < 3) {
        d.createObjectStore('mapping', { keyPath: 'tenantId' })
      }
      if (oldVersion < 4) {
        d.createObjectStore('plan', { keyPath: 'tenantId' })
      }
      if (oldVersion < 5) {
        d.createObjectStore('snapshot', { keyPath: 'tenantId' })
      }
    },
  })
  return dbPromise
}

export async function loadGroupMembersCache(
  tenantId: string,
  groupId: string,
): Promise<GroupMembersCacheEntry | null> {
  try {
    const d = await db()
    return (await d.get('group-members', [tenantId, groupId])) ?? null
  } catch {
    return null
  }
}

export async function saveGroupMembersCache(entry: GroupMembersCacheEntry): Promise<void> {
  try {
    const d = await db()
    await d.put('group-members', entry)
  } catch {
    // Cache is an optimization; losing it must never fail the lookup.
  }
}

export async function loadEvidenceCache(
  tenantId: string,
  expectedSchema?: number,
): Promise<{ meta: EvidenceCacheMeta; rows: StoredSignIn[] } | null> {
  try {
    const d = await db()
    const meta = await d.get('evidence-meta', tenantId)
    if (!meta) return null
    // A stale schema is discarded before its rows are loaded.
    if (expectedSchema !== undefined && meta.schema !== expectedSchema) return null
    const rows = await d.getAllFromIndex('signin-rows', 'byTenant', tenantId)
    return { meta, rows }
  } catch {
    return null
  }
}

export async function saveEvidenceCache(
  tenantId: string,
  covered: { from: string; to: string },
  rows: StoredSignIn[],
  schema: number,
): Promise<void> {
  try {
    const d = await db()
    const tx = d.transaction(['signin-rows', 'evidence-meta'], 'readwrite')
    const store = tx.objectStore('signin-rows')
    let cursor = await store.index('byTenant').openCursor(tenantId)
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }
    for (const row of rows) {
      await store.put({ ...row, tenantId })
    }
    await tx.objectStore('evidence-meta').put({ tenantId, covered, asOf: new Date().toISOString(), schema })
    await tx.done
  } catch {
    // Cache is an optimization; losing it must never fail the scan.
  }
}

export async function loadMappingRecord<T>(tenantId: string): Promise<T | null> {
  try {
    const d = await db()
    return ((await d.get('mapping', tenantId)) as T | undefined) ?? null
  } catch {
    return null
  }
}

export async function saveMappingRecord(tenantId: string, value: Record<string, unknown>): Promise<void> {
  try {
    const d = await db()
    await d.put('mapping', { ...value, tenantId })
  } catch {
    // Cache is an optimization; losing it must never fail the page.
  }
}

export async function loadPlanRecord<T>(tenantId: string): Promise<T | null> {
  try {
    const d = await db()
    return ((await d.get('plan', tenantId)) as T | undefined) ?? null
  } catch {
    return null
  }
}

export async function savePlanRecord(tenantId: string, value: Record<string, unknown>): Promise<void> {
  try {
    const d = await db()
    await d.put('plan', { ...value, tenantId })
  } catch {
    // Cache is an optimization; losing it must never fail the page.
  }
}

// The last completed scan, so nobody has to re-scan just to look around.
export async function loadSnapshotRecord<T>(tenantId: string): Promise<T | null> {
  try {
    const d = await db()
    return ((await d.get('snapshot', tenantId)) as T | undefined) ?? null
  } catch {
    return null
  }
}

export async function saveSnapshotRecord(tenantId: string, value: Record<string, unknown>): Promise<void> {
  try {
    const d = await db()
    await d.put('snapshot', { ...value, tenantId })
  } catch {
    // Cache is an optimization; losing it must never fail the scan.
  }
}

export async function forgetTenant(tenantId: string): Promise<void> {
  const d = await db()
  const tx = d.transaction(['signin-rows', 'evidence-meta', 'group-members', 'mapping', 'plan', 'snapshot'], 'readwrite')
  for (const storeName of ['signin-rows', 'group-members'] as const) {
    const store = tx.objectStore(storeName)
    let cursor = await store.index('byTenant').openCursor(tenantId)
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }
  }
  await tx.objectStore('evidence-meta').delete(tenantId)
  await tx.objectStore('mapping').delete(tenantId)
  await tx.objectStore('plan').delete(tenantId)
  await tx.objectStore('snapshot').delete(tenantId)
  await tx.done
}
