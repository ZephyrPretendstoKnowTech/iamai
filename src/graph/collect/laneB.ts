// Lane B — sign-in evidence. Thin wrapper binding the testable core
// (laneBCore.ts) to real I/O: Graph HTTP with the §6 retry policy, the
// IndexedDB cache, and wall-clock time.
import { PAGE_ABORT_MS } from './constants.ts'
import { BETA, graphRequest } from './http.ts'
import type { TokenSource } from './http.ts'
import { loadEvidenceCache, saveEvidenceCache } from './cache.ts'
import { EVIDENCE_SCHEMA, EVIDENCE_SCHEMA_COMPATIBLE_FROM, runLaneB } from './laneBCore.ts'
import type { LaneBProgress, SignInEvidence } from './laneBCore.ts'

export type { LaneBProgress, SignInEvidence }

export async function collectSignInEvidence(
  ctx: { tokens: TokenSource; signal: AbortSignal },
  opts: {
    tenantId: string
    windowDays: number
    onPage?: (p: LaneBProgress) => void
    onSlow?: () => void
  },
): Promise<SignInEvidence> {
  const lambda = encodeURIComponent("signInEventTypes/any(t: t eq 'interactiveUser')")
  return runLaneB({
    startUrl: `${BETA}/auditLogs/signIns?$filter=${lambda}&$top=200`,
    windowDays: opts.windowDays,
    nowMs: Date.now(),
    clock: () => performance.now(),
    fetchPage: (url) => graphRequest(ctx.tokens, url, { abortMs: PAGE_ABORT_MS, signal: ctx.signal }),
    loadCache: async () => {
      const cached = await loadEvidenceCache(opts.tenantId)
      // A cache from schema 6 loads with the prompt 48 labels absent; older ones are refetched.
      const schema = cached?.meta.schema ?? 0
      if (!cached || schema < EVIDENCE_SCHEMA_COMPATIBLE_FROM || schema > EVIDENCE_SCHEMA) return null
      return { covered: cached.meta.covered, rows: cached.rows }
    },
    saveCache: (covered, rows) => saveEvidenceCache(opts.tenantId, covered, rows, EVIDENCE_SCHEMA),
    onPage: opts.onPage,
    onSlow: opts.onSlow,
  })
}
