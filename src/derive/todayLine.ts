// The one line under Today's heading (target-state §4): people, admins and the
// sign-in window, in the branch the tenant is in. Every sentence is a content
// string (pages.today.line and pages.app.today); this only picks the branch.
//
// Pure: no DOM, no network.
import { app, pages } from '../content/content.ts'
import { fillText } from '../content/render.ts'

export type TodayCounts = { active: number; enabled: number; admins: number }

export function todayLine(c: TodayCounts, window: { from: string; to: string } | null, noRecordsReason: string | null): string {
  const C = app.today
  const records = window ? fillText(C.lineRecords, { from: window.from, to: window.to }) : noRecordsReason ? fillText(C.lineNoRecordsReason, { reason: noRecordsReason }) : C.lineNoRecords
  if (c.enabled === 0) return fillText(C.lineNoPeople, { admins: c.admins, records })
  if (window) return fillText((pages.today as { line: string }).line, { active: c.active, enabled: c.enabled, admins: c.admins, from: window.from, to: window.to })
  return fillText(C.lineNoRecordsLine, { active: c.active, enabled: c.enabled, admins: c.admins, records })
}
