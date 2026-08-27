// Auto-scheduling (2026-08-27 redesign): the operator picks a start date and
// every phase gets real calendar dates, scaled by complexity — 2–4 weeks
// typical, longer only when report-only observation windows demand it. Pure.
import { EXIT_MIN_DAYS_OBSERVED } from './constants.ts'
import type { Step } from './types.ts'
import { SCHEDULE_NOTE } from '../copy/steps.ts'

export const PHASE_BASE_DAYS = 2
export const DAYS_PER_TWO_STEPS = 1
export const LARGE_TENANT_ACTIVE_USERS = 500
export const LARGE_TENANT_EXTRA_DAYS = 3
export const TARGET_MIN_DAYS = 14
export const TARGET_TYPICAL_MAX_DAYS = 28

export type PhaseSchedule = {
  phase: number
  start: string
  end: string
  days: number
  note: string | null
}

export type Schedule = {
  start: string
  targetEnd: string
  totalDays: number
  weeks: number
  withinTypicalTarget: boolean
  phases: PhaseSchedule[]
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function toWeekday(iso: string): string {
  const d = new Date(iso)
  const day = d.getUTCDay()
  if (day === 6) return addDays(iso, 2) // Saturday → Monday
  if (day === 0) return addDays(iso, 1) // Sunday → Monday
  return iso
}

export function nextMonday(fromIso: string): string {
  const d = new Date(fromIso)
  const day = d.getUTCDay()
  const delta = day === 1 ? 7 : (8 - day) % 7 || 7
  return addDays(fromIso.slice(0, 10) + 'T00:00:00.000Z', delta)
}

// Days a phase needs, from what actually has to happen in it.
export function phaseDuration(steps: Step[], activeUsers: number): { days: number; note: string | null } {
  const work = steps.filter((s) => s.status !== 'done' && s.status !== 'skipped')
  if (work.length === 0) return { days: 0, note: SCHEDULE_NOTE.complete }
  let days = PHASE_BASE_DAYS + Math.ceil(work.length / 2) * DAYS_PER_TWO_STEPS
  let note: string | null = null
  const needsObservation = work.some((s) => s.kind === 'create' || s.kind === 'adjust')
  if (needsObservation) {
    days += EXIT_MIN_DAYS_OBSERVED
    note = SCHEDULE_NOTE.observation(EXIT_MIN_DAYS_OBSERVED)
  }
  if (activeUsers > LARGE_TENANT_ACTIVE_USERS) {
    days += LARGE_TENANT_EXTRA_DAYS
    note = note ? `${note}; ${SCHEDULE_NOTE.largeTenant}` : SCHEDULE_NOTE.largeTenant
  }
  return { days, note }
}

export function buildSchedule(steps: Step[], startIso: string, activeUsers: number): Schedule {
  const phases = [...new Set(steps.map((s) => s.phase))].sort((a, b) => a - b)
  const out: PhaseSchedule[] = []
  let cursor = toWeekday(startIso)
  let totalDays = 0
  for (const phase of phases) {
    const inPhase = steps.filter((s) => s.phase === phase)
    const { days, note } = phaseDuration(inPhase, activeUsers)
    const start = cursor
    const end = days === 0 ? cursor : addDays(cursor, days)
    out.push({ phase, start, end, days, note })
    if (days > 0) {
      cursor = toWeekday(end)
      totalDays += days
    }
  }
  const targetEnd = out.length > 0 ? out[out.length - 1].end : startIso
  return {
    start: startIso,
    targetEnd,
    totalDays,
    weeks: Math.max(1, Math.round(totalDays / 7)),
    withinTypicalTarget: totalDays >= TARGET_MIN_DAYS ? totalDays <= TARGET_TYPICAL_MAX_DAYS : true,
    phases: out,
  }
}
