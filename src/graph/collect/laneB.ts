// Lane B — sign-in evidence. Thin wrapper binding the testable read
// (signInStream.ts) to real I/O: Graph HTTP with the §6 retry policy, the
// IndexedDB store, and wall-clock time.
import { PAGE_ABORT_MS, SIGN_IN_PAGE_SIZE, SIGN_IN_RETRY_MAX_429, SIGN_IN_RETRY_MAX_5XX } from './constants.ts'
import { BETA, graphPaged, graphRequest } from './http.ts'
import type { TokenSource } from './http.ts'
import { evidenceStore } from './cache.ts'
import { EVIDENCE_SCHEMA, EVIDENCE_SCHEMA_COMPATIBLE_FROM, TARGETED_READ_BUDGET_MS, mapRecoveryAudit, mapRow, mergeTargeted, recoveryAuditRequest, targetedReadUrl } from './laneBCore.ts'
import type { LaneBProgress, SignInEvidence } from './laneBCore.ts'
import { runLaneB } from './signInStream.ts'
import type { EvidenceStore } from './signInStream.ts'
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

/**
 * The first page of interactive sign-ins, newest first; with `through`, only
 * those created at or before it (a continued read). `le`, because Graph
 * documents only eq, le and ge on a sign-in's createdDateTime.
 */
export function signInPageUrl(through: string | null): string {
  const lambda = "signInEventTypes/any(t: t eq 'interactiveUser')"
  const filter = through === null ? lambda : `createdDateTime le ${through} and ${lambda}`
  return `${BETA}/auditLogs/signIns?$filter=${encodeURIComponent(filter)}&$top=${SIGN_IN_PAGE_SIZE}`
}

export async function collectSignInEvidence(
  ctx: SignInCtx,
  opts: {
    tenantId: string
    windowDays: number
    onPage?: (p: LaneBProgress) => void
    onSlow?: () => void
  },
): Promise<SignInEvidence> {
  const saved = evidenceStore(opts.tenantId, EVIDENCE_SCHEMA, ctx.signal)
  const store: EvidenceStore = {
    ...saved,
    meta: async () => {
      // Records saved under another schema are read again from Graph (runLaneB resets them first).
      const meta = await saved.meta()
      const schema = meta?.schema ?? 0
      if (!meta || schema < EVIDENCE_SCHEMA_COMPATIBLE_FROM || schema > EVIDENCE_SCHEMA) return null
      return { covered: meta.covered }
    },
  }
  const evidence = await runLaneB({
    pageUrl: signInPageUrl,
    windowDays: opts.windowDays,
    nowMs: Date.now(),
    clock: () => performance.now(),
    fetchPage: (url) => graphRequest(ctx.tokens, url, { ...SIGN_IN_READ, signal: ctx.signal, wait: ctx.wait }),
    store,
    tenantId: opts.tenantId,
    signal: ctx.signal,
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
 * in the part of the window a partial bulk read did not reach, their own read
 * (every page of it), stopping at the time budget. Returns how many were read and how many
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
      // Every page of their records to the start of the window, following nextLink: a busy person has more than one page.
      const raw = await graphPaged(ctx.tokens, targetedReadUrl(BETA, id, windowStart, coveredFrom), { ...SIGN_IN_READ, signal: ctx.signal, wait: ctx.wait })
      // The read asks for createdDateTime le coveredFrom: a record at or after it is the bulk read's, folded already.
      const rows = raw.map(mapRow).filter((r): r is StoredSignIn => r !== null && Date.parse(r.createdDateTime) < Date.parse(coveredFrom))
      mergeTargeted(perUser, id, rows)
      read += 1
    } catch {
      // Left for the next scan: an unread person stays Unknown, never Confirm it.
    }
  }
  return { read, remaining: ids.length - read }
}
