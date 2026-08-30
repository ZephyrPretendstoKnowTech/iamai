// The feedback message, built as data so it can be shown before it is sent
// (prompt 34 §2) and tested for what it must never contain.
//
// Nothing is sent by IAMAI. This builds text, the panel shows it, and the
// person's own mail client opens with it visible. Pure: no DOM, no network.
import type { TenantSnapshot } from './graph/collect/types.ts'

export const FEEDBACK_ADDRESS = 'feedback@getiamai.com'
export const FEEDBACK_SUBJECT = 'IAMAI feedback'

export type FeedbackContext = {
  /** The route the person was on, as a hash path. */
  page: string
  version: string
  userAgent: string
}

/**
 * Counts only. No display names, no sign-in names, no tenant id, no group or
 * user ids: the things that make a report useful and nothing that identifies
 * anybody. `src/feedback.test.ts` holds it to that.
 */
export function diagnosticsSummary(snapshot: TenantSnapshot | null): string[] {
  if (!snapshot) return ['No scan on this device.']
  const disabled = Object.entries(snapshot.sources)
    .filter(([, v]) => v.status === 'disabled' || v.status === 'error')
    .map(([k]) => k)
  const config = Object.entries(snapshot.config)
    .filter(([, v]) => v?.status === 'disabled' || v?.status === 'error')
    .map(([k]) => k)
  const caps = Object.entries(snapshot.capabilities)
    .filter(([, v]) => v.enabled)
    .map(([k]) => k)
  return [
    `Users in the directory: ${snapshot.users.length}`,
    `Conditional Access policies: ${snapshot.config.caPolicies?.rows.length ?? 0}`,
    `Devices: ${snapshot.devices.length}`,
    `Licence capabilities on: ${caps.length > 0 ? caps.join(', ') : 'none'}`,
    `Sign-in records: ${snapshot.sources.signInEvidence?.status ?? 'not collected'}`,
    `Sections that could not be read: ${[...disabled, ...config].join(', ') || 'none'}`,
  ]
}

/** Exactly what the mail client will contain, shown before anything opens. */
export function feedbackBody(ctx: FeedbackContext, summary: string[] | null): string {
  const lines = [
    'What looked wrong, or what was unclear:',
    '',
    '',
    '---',
    `Page: ${ctx.page}`,
    `Version: ${ctx.version}`,
    `Browser: ${ctx.userAgent}`,
  ]
  if (summary) lines.push('', 'Scan summary (counts only, no names and no tenant id):', ...summary.map((l) => `  ${l}`))
  return lines.join('\n')
}

export function mailtoHref(ctx: FeedbackContext, summary: string[] | null): string {
  const body = encodeURIComponent(feedbackBody(ctx, summary))
  return `mailto:${FEEDBACK_ADDRESS}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}&body=${body}`
}
