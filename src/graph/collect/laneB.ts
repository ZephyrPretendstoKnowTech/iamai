// Lane B — sign-in evidence. Thin wrapper binding the testable core
// (laneBCore.ts) to real I/O: Graph HTTP with the §6 retry policy, the
// IndexedDB cache, and wall-clock time.
import { PAGE_ABORT_MS, SIGN_IN_RETRY_MAX_429, SIGN_IN_RETRY_MAX_5XX } from './constants.ts'
import { BETA, graphRequest } from './http.ts'
import type { TokenSource } from './http.ts'
import { loadEvidenceCache, saveEvidenceCache } from './cache.ts'
import { EVIDENCE_SCHEMA, EVIDENCE_SCHEMA_COMPATIBLE_FROM, TARGETED_READ_BUDGET_MS, mapRecoveryAudit, mapRow, mergeTargeted, recoveryAuditRequest, runLaneB, targetedReadUrl } from './laneBCore.ts'
import type { LaneBProgress, SignInEvidence } from './laneBCore.ts'
import type { RecoveryDirectoryAudit, StoredSignIn, UserEvidence } from './types.ts'

export type { LaneBProgress, SignInEvidence }

/** The scan's token and cancellation; `wait` is the retry policy's, injectable so tests don't sleep. */
export type SignInCtx = { tokens: TokenSource; signal: AbortSignal; wait?: (ms: number, signal?: AbortSignal) => Promise<void> }

/**
 * Every sign-in and directory-audit read: a long page timeout, and the longer
 * retry ceilings the sign-in logs need (constants.ts). A read that still fails
 * leaves the records unread for the next scan, never a person's failure.
 */
export const SIGN_IN_READ = { abortMs: PAGE_ABORT_MS, attempts429: SIGN_IN_RETRY_MAX_429, attempts5xx: SIGN_IN_RETRY_MAX_5XX } as const

export async function collectSignInEvidence(
  ctx: SignInCtx,
  opts: {
    tenantId: string
    windowDays: number
    onPage?: (p: LaneBProgress) => void
    onSlow?: () => void
  },
): Promise<SignInEvidence> {
  const lambda = encodeURIComponent("signInEventTypes/any(t: t eq 'interactiveUser')")
  const evidence = await runLaneB({
    startUrl: `${BETA}/auditLogs/signIns?$filter=${lambda}&$top=200`,
    windowDays: opts.windowDays,
    nowMs: Date.now(),
    clock: () => performance.now(),
    fetchPage: (url) => graphRequest(ctx.tokens, url, { ...SIGN_IN_READ, signal: ctx.signal, wait: ctx.wait }),
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
  const { since, url } = recoveryAuditRequest(BETA, Date.now())
  let next: string | null = url
  const recoveryAudits: RecoveryDirectoryAudit[] = []
  try {
    while (next) {
      const page: any = await graphRequest(ctx.tokens, next, { ...SIGN_IN_READ, signal: ctx.signal, wait: ctx.wait })
      if (!page || !Array.isArray(page.value)) throw new Error('Directory audit evidence returned an unreadable page.')
      for (const raw of page.value as unknown[]) { const projected = mapRecoveryAudit(raw); if (projected) recoveryAudits.push(projected) }
      next = typeof page['@odata.nextLink'] === 'string' ? page['@odata.nextLink'] : null
    }
  } catch (error) {
    return { ...evidence, recoveryAudits: [], recoveryAuditSource: { status: 'error', reason: `Directory audit evidence could not be read: ${error instanceof Error ? error.message : String(error)}`, coveredWindow: null, asOf: new Date().toISOString() } }
  }
  return { ...evidence, recoveryAudits, recoveryAuditSource: { status: 'ok', reason: null, coveredWindow: { from: since, to: new Date().toISOString() }, asOf: new Date().toISOString() } }
}

/**
 * MFA Readiness's targeted reads (prompt 62): each person's interactive sign-ins
 * in the part of the window a partial bulk read did not reach, one small request
 * each, stopping at the time budget. Returns how many were read and how many
 * wait for the next scan. A failed person is left for the next scan too.
 */
export async function readTargeted(
  ctx: SignInCtx,
  perUser: Record<string, UserEvidence>,
  ids: readonly string[],
  windowStart: string,
  coveredFrom: string,
): Promise<{ read: number; remaining: number }> {
  const started = Date.now()
  let read = 0
  for (const id of ids) {
    if (Date.now() - started > TARGETED_READ_BUDGET_MS || ctx.signal.aborted) break
    try {
      const page: any = await graphRequest(ctx.tokens, targetedReadUrl(BETA, id, windowStart, coveredFrom), { ...SIGN_IN_READ, signal: ctx.signal, wait: ctx.wait })
      const rows = (Array.isArray(page?.value) ? page.value : []).map(mapRow).filter((r: StoredSignIn | null): r is StoredSignIn => r !== null)
      mergeTargeted(perUser, id, rows)
      read += 1
    } catch {
      // Left for the next scan: an unread person stays Unknown, never Confirm it.
    }
  }
  return { read, remaining: ids.length - read }
}
