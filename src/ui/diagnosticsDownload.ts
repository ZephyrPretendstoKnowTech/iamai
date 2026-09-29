// Download the diagnostics bundle (prompt 46 item 24), from the Scan page
// with its live section rows or from the ?dev=1 panel with the last saved
// scan. Both go through the export guard, which redacts identifiers. The
// bundle names no tenant: not its id, and no hash of it, which anyone could
// recompute from the public id of a candidate domain (security audit, 2026-09-29).
import { diagnosticsBundle } from '../diagnostics.ts'
import { loadSnapshotRecord } from '../graph/collect/cache.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { REDACTED, exportDownload } from './exportGuard.ts'

export async function downloadScanDiagnostics(snapshot: TenantSnapshot | null, sections: unknown[] = []): Promise<void> {
  const bundle = diagnosticsBundle(snapshot, sections, {
    userAgent: navigator.userAgent,
    generatedAt: new Date().toISOString(),
  })
  exportDownload(`iamai-diagnostics-${Date.now()}.json`, JSON.stringify(bundle, null, 2), 'application/json', REDACTED)
}

/** The dev panel's entry: the last saved scan for this tenant, or an empty bundle that says so. */
export async function downloadSavedScanDiagnostics(tenantId: string): Promise<void> {
  const stored = await loadSnapshotRecord<{ snapshot: TenantSnapshot; at: string }>(tenantId)
  await downloadScanDiagnostics(stored?.snapshot ?? null, [])
}
