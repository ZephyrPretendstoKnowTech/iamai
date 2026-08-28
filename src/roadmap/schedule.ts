// Pacing model (prompt 12 §A, re-paced by tenant size in prompt 18): the
// size band sets the expected length. Day 0 holds foundation work and creates
// every "New policy" step in report-only; the registration-and-verification
// window runs next (skipped once a re-scan shows verification complete); one
// shared 7-day observation window follows; enforcement waves then follow the
// phase order, spaced so the whole plan lands on the band. Done steps consume
// no time. Blocked steps are scheduled after their blocker, never inside a
// wave they cannot join. Pure.
import { BANDS, MIN_WAVE_DAYS, OBSERVATION_DAYS, bandForActiveUsers } from './constants.ts'
import type { SizeBand } from './constants.ts'
import type { Step } from './types.ts'

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
  band: SizeBand
  bandSource: 'auto' | 'override'
  activeUsers: number
  expectedDays: number
  start: string
  targetEnd: string
  totalDays: number
  weeks: number
  /** Within the band's expected length (a week of slack allowed). */
  withinBand: boolean
  /** Registration and verification window; 0 days once verification is complete. */
  verification: { start: string; end: string; days: number; complete: boolean }
  observation: { start: string; end: string; days: number }
  waves: WaveSchedule[]
  /** step id → the wave it enforces in (0 for day 0 / done). */
  waveOf: Record<string, number>
  /** Steps whose wave ends after the band's expected length. */
  extendedBy: string[]
  /** Steps blocked on a Setup question. */
  waitingOnSetup: number
  /** The question numbers those steps wait on (ux-review-05 §14). */
  waitingOnSetupQuestions: number[]
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
  if (s.kind === 'prerequisite' || s.kind === 'recurring' || s.kind === 'verify') return 0
  return Math.min(7, Math.max(1, s.phase))
}

export function buildSchedule(steps: Step[], startIso: string, activeUsers: number, bandOverride: SizeBand | null = null): Schedule {
  const band = bandOverride ?? bandForActiveUsers(activeUsers)
  const preset = BANDS[band]
  const expectedDays = preset.weeks * 7
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
  const verifyStep = steps.find((s) => s.kind === 'verify') ?? null
  // The window is skipped once a re-scan shows verification complete: the
  // remaining waves pull forward and the end date shortens.
  const verificationComplete = verifyStep === null || !isWork(verifyStep)
  const verificationDays = verifyStep !== null && !verificationComplete ? preset.verificationDays : 0
  const obsDays = needsObservation ? OBSERVATION_DAYS : 0

  const waves: WaveSchedule[] = []
  // Wave 0: day 0 — foundations, report-only creation, anything already done.
  // Human foundation work (accounts, groups, locations, Setup answers) takes
  // real days before any policy can be created.
  const day0Steps = steps.filter((s) => waveOf[s.id] === 0).map((s) => s.id)
  const foundationWork = steps.filter((s) => waveOf[s.id] === 0 && isWork(s) && s.kind === 'prerequisite').length
  const day0Days = foundationWork > 0 ? Math.min(5, 1 + foundationWork) : 0
  const day0End = addDays(day0, day0Days)
  waves.push({ wave: 0, phase: 0, start: day0, end: day0End, days: day0Days, stepIds: day0Steps, note: null })

  const verification = {
    start: toWeekday(day0End),
    end: addDays(toWeekday(day0End), verificationDays),
    days: verificationDays,
    complete: verificationComplete,
  }
  const observation = { start: toWeekday(verification.end), end: addDays(toWeekday(verification.end), obsDays), days: obsDays }

  // Enforcement waves share what the band leaves after the fixed windows.
  // The spacing is set by the band's full window, not the remaining one, so
  // a verification campaign that finishes early shortens the plan instead
  // of stretching the waves.
  const enforcementWaves = [1, 2, 3, 4, 5, 6, 7].filter((w) => steps.some((s) => waveOf[s.id] === w))
  const plannedVerification = verifyStep !== null ? preset.verificationDays : 0
  const fixedDays = day0Days + verificationDays + obsDays
  const perWave =
    enforcementWaves.length > 0 ? Math.max(MIN_WAVE_DAYS, Math.floor((expectedDays - day0Days - plannedVerification - obsDays) / enforcementWaves.length)) : 0

  let cursor = toWeekday(observation.end)
  let totalDays = fixedDays
  for (const w of enforcementWaves) {
    const ids = steps.filter((s) => waveOf[s.id] === w).map((s) => s.id)
    const start = cursor
    const end = addDays(start, perWave)
    waves.push({ wave: w, phase: w, start, end, days: perWave, stepIds: ids, note: null })
    cursor = toWeekday(end)
    totalDays += perWave
  }

  const targetEnd = waves.length > 1 ? waves[waves.length - 1].end : day0
  const expectedEnd = addDays(day0, expectedDays + 7)
  const extendedBy = waves.filter((w) => w.wave > 0 && Date.parse(w.end) > Date.parse(expectedEnd)).flatMap((w) => w.stepIds)
  const waitingOnSetup = steps.filter((s) => isWork(s) && s.blockers.some((b) => b.kind === 'setup')).length
  const waitingOnSetupQuestions = [...new Set(steps.filter(isWork).flatMap((s) => s.blockers.filter((b) => b.kind === 'setup').map((b) => (b as { questionNumber: number }).questionNumber)))].sort((a, b) => a - b)
  return {
    band,
    bandSource: bandOverride ? 'override' : 'auto',
    activeUsers,
    expectedDays,
    start: day0,
    targetEnd,
    totalDays,
    weeks: Math.max(1, Math.round(totalDays / 7)),
    withinBand: totalDays <= expectedDays + 7,
    verification,
    observation,
    waves,
    waveOf,
    extendedBy,
    waitingOnSetup,
    waitingOnSetupQuestions,
  }
}
