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
}

let dbPromise: Promise<IDBPDatabase<IamaiDB>> | null = null

function db(): Promise<IDBPDatabase<IamaiDB>> {
  dbPromise ??= openDB<IamaiDB>('iamai', 1, {
    upgrade(d) {
      const rows = d.createObjectStore('signin-rows', { keyPath: ['tenantId', 'id'] })
      rows.createIndex('byTenant', 'tenantId')
      d.createObjectStore('evidence-meta', { keyPath: 'tenantId' })
    },
  })
  return dbPromise
}

export async function loadEvidenceCache(
  tenantId: string,
): Promise<{ meta: EvidenceCacheMeta; rows: StoredSignIn[] } | null> {
  try {
    const d = await db()
    const meta = await d.get('evidence-meta', tenantId)
    if (!meta) return null
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
    await tx.objectStore('evidence-meta').put({ tenantId, covered, asOf: new Date().toISOString() })
    await tx.done
  } catch {
    // Cache is an optimization; losing it must never fail the scan.
  }
}

export async function forgetTenant(tenantId: string): Promise<void> {
  const d = await db()
  const tx = d.transaction(['signin-rows', 'evidence-meta'], 'readwrite')
  const store = tx.objectStore('signin-rows')
  let cursor = await store.index('byTenant').openCursor(tenantId)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.objectStore('evidence-meta').delete(tenantId)
  await tx.done
}
