// The diagnostics bundle (prompt 46 item 24): what each read returned, never
// what it contained. Per source and per configuration section: status, the
// reason when it did not run, the HTTP status and body length when it did,
// and for the authentication methods policy the property names the row
// carries plus its migration state, so "could not be read" can be told apart
// from "read, but the field is missing" without a tenant's data leaving the
// browser. Pure.
import type { ConfigSection, ConfigSectionKey, TenantSnapshot } from './graph/collect/types.ts'

export type SectionDiagnostic = {
  status: ConfigSection['status']
  reason: string | null
  rows: number
  httpStatus: number | null
  bodyBytes: number | null
}

export type DiagnosticsBundle = {
  generatedAt: string
  userAgent: string
  schemaVersion: number | null
  tenantIdHash: string
  sources: TenantSnapshot['sources'] | null
  /** The scan's per-source progress rows, when the bundle is built on the Scan page. */
  sections: unknown[]
  config: Partial<Record<ConfigSectionKey, SectionDiagnostic>>
  authMethodsPolicy: {
    read: boolean
    status: ConfigSection['status'] | null
    reason: string | null
    httpStatus: number | null
    bodyBytes: number | null
    /** Property names on the first row: the shape of what came back, not its values. */
    keys: string[]
    policyMigrationState: string | null
  }
}

function sectionDiagnostic(s: ConfigSection): SectionDiagnostic {
  return { status: s.status, reason: s.reason, rows: s.rows.length, httpStatus: s.httpStatus ?? null, bodyBytes: s.bodyBytes ?? null }
}

export function diagnosticsBundle(
  snapshot: TenantSnapshot | null,
  sections: unknown[],
  meta: { tenantIdHash: string; userAgent: string; generatedAt: string },
): DiagnosticsBundle {
  const config: DiagnosticsBundle['config'] = {}
  for (const [key, section] of Object.entries(snapshot?.config ?? {}) as [ConfigSectionKey, ConfigSection | undefined][]) {
    if (section) config[key] = sectionDiagnostic(section)
  }
  const amp = snapshot?.config.authMethodsPolicy ?? null
  const row = (amp?.rows[0] ?? null) as Record<string, unknown> | null
  return {
    generatedAt: meta.generatedAt,
    userAgent: meta.userAgent,
    schemaVersion: snapshot?.schemaVersion ?? null,
    tenantIdHash: meta.tenantIdHash,
    sources: snapshot?.sources ?? null,
    sections,
    config,
    authMethodsPolicy: {
      read: amp?.status === 'ok',
      status: amp?.status ?? null,
      reason: amp?.reason ?? null,
      httpStatus: amp?.httpStatus ?? null,
      bodyBytes: amp?.bodyBytes ?? null,
      keys: row ? Object.keys(row).sort() : [],
      policyMigrationState: typeof row?.policyMigrationState === 'string' ? row.policyMigrationState : null,
    },
  }
}
