// Pacing model (prompt 12 §A): waves, not phases in series. Day 0 creates
// every "New policy" step in report-only in one batch; one shared observation
// window runs for all of them; enforcement then happens in waves that follow
// the phase order. Done steps consume no time. Blocked steps are scheduled
// after their blocker resolves, never inside a wave they cannot join. Pure.
import { PACES } from './constants.ts'
import type { Pace } from './constants.ts'
import type { Step } from './types.ts'

export const TARGET_MIN_DAYS = 14
export const TARGET_TYPICAL_MAX_DAYS = 28

export type WaveSchedule = {
  wave: number // 1..7 = phase 1..7; 0 = day 0 (foundations + report-only creation)
  phase: number
  start: string
  end: string
  days: number
  stepIds: string[]
  note: string | null
}

export type Schedule = {
  pace: Pace
  start: string
  targetEnd: string
  totalDays: number
  weeks: number
  withinTypicalTarget: boolean
  observation: { start: string; end: string; days: number }
  waves: WaveSchedule[]
  /** step id → the wave it enforces in (0 for day 0 / done). */
  waveOf: Record<string, number>
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + Math.round(days))
  return d.toISOString()
}

export function toWeekday(iso: string): string {
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
  // Noon UTC so the calendar day reads the same in every display time zone.
  return addDays(fromIso.slice(0, 10) + 'T12:00:00.000Z', delta)
}

const isWork = (s: Step): boolean => s.status !== 'done' && s.status !== 'skipped'

/** Wave a step naturally enforces in: its phase (0 stays on day 0). */
function naturalWave(s: Step): number {
  if (!isWork(s)) return 0
  if (s.kind === 'prerequisite' || s.kind === 'recurring') return 0
  return Math.min(7, Math.max(1, s.phase))
}

export function buildSchedule(steps: Step[], startIso: string, activeUsers: number, pace: Pace = 'standard'): Schedule {
  const preset = PACES[pace]
  const day0 = toWeekday(startIso)
  const byId = new Map(steps.map((s) => [s.id, s]))

  // Wave assignment: natural wave, then pushed after blockers (iterate to a fixed point).
  const waveOf: Record<string, number> = {}
  for (const s of steps) waveOf[s.id] = naturalWave(s)
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false
    for (const s of steps) {
      if (!isWork(s)) continue
      for (const b of s.blockedBy) {
        const blocker = byId.get(b)
        if (!blocker || !isWork(blocker)) continue
        const need = Math.min(7, Math.max(waveOf[s.id], waveOf[b] + 1))
        if (need !== waveOf[s.id]) {
          waveOf[s.id] = need
          changed = true
        }
      }
    }
    if (!changed) break
  }

  const needsObservation = steps.some((s) => isWork(s) && (s.kind === 'create' || s.kind === 'adjust'))
  const needsVerification = steps.some((s) => isWork(s) && s.kind === 'verify')
  const obsDays = needsObservation ? preset.observationDays : 0
  const observation = { start: day0, end: addDays(day0, obsDays), days: obsDays }

  const waves: WaveSchedule[] = []
  // Wave 0: day 0 — foundations, report-only creation, anything already done.
  // Human foundation work (accounts, groups, locations, Setup answers) takes
  // real days before any policy can be created; observation starts after it.
  const day0Steps = steps.filter((s) => waveOf[s.id] === 0).map((s) => s.id)
  const foundationWork = steps.filter((s) => waveOf[s.id] === 0 && isWork(s) && s.kind === 'prerequisite').length
  const day0Days = foundationWork > 0 ? Math.min(5, 1 + foundationWork) : 0
  const day0End = addDays(day0, day0Days)
  waves.push({ wave: 0, phase: 0, start: day0, end: day0End, days: day0Days, stepIds: day0Steps, note: null })
  observation.start = toWeekday(day0End)
  observation.end = addDays(observation.start, obsDays)

  let cursor = toWeekday(observation.end)
  let totalDays = day0Days + obsDays
  const largeTenant = activeUsers > 500 ? 1 : 0
  for (let w = 1; w <= 7; w += 1) {
    const ids = steps.filter((s) => waveOf[s.id] === w).map((s) => s.id)
    if (ids.length === 0) continue
    let days = Math.max(1, Math.round(preset.waveGapDays)) + largeTenant
    let note: string | null = null
    if (w === 2 && needsVerification) {
      days += preset.verificationDays
      note = `includes ${preset.verificationDays} days for the MFA verification campaign`
    }
    const start = cursor
    const end = addDays(start, days)
    waves.push({ wave: w, phase: w, start, end, days, stepIds: ids, note })
    cursor = toWeekday(end)
    totalDays += days
  }

  const targetEnd = waves.length > 1 ? waves[waves.length - 1].end : day0
  return {
    pace,
    start: day0,
    targetEnd,
    totalDays,
    weeks: Math.max(1, Math.round(totalDays / 7)),
    withinTypicalTarget: totalDays >= TARGET_MIN_DAYS ? totalDays <= TARGET_TYPICAL_MAX_DAYS : true,
    observation,
    waves,
    waveOf,
  }
}
