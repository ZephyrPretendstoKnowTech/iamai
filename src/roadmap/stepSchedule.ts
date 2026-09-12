// One scheduling result per step (correction batch 1.1).
//
// The row's When read one day (the day a policy is created in report-only), the
// phase it sat in was chosen by another (the week its enforcement starts), and the
// phase's header by a third (the wave's own placement). So a policy created on
// Sep 15 sat under "Phase 1 · Sep 22–27" reading Sep 15, and a row with a date
// opened onto a rail reading Held. Each surface was right about its own fact and
// the three disagreed.
//
// This module reads the finished plan once and says, for each step: whether it is
// scheduled, being observed, waiting, finished or set aside; the lifecycle
// transition its next milestone is and the day of it; the span of days the plan
// gives it; the phase it belongs to; what it is sequenced after; and whether its
// enforcement is forecast, gated, earned or not in question. The phases the Plan
// draws are read back off the same results (`phasesOf`), so a phase's range holds
// every one of its rows' days by construction.
//
// Readiness gates enforcement, not creation (owner decision, 2026-09-11): a policy
// held only by a readiness threshold, whose create Foundation A hands over as safe
// preparation and which waits on no open decision, keeps its report-only creation
// day. Its enforcement stays gated and undated. Nothing else a hold covers is
// scheduled: a missing object, an unverified way back in, a baseline conflict, a
// decision, a review or unresolved evidence still leaves the step waiting.
//
// What the schedule placed is kept on the step (`basis`); everything else is read
// from the step as it is now (`scheduleOf`), so a step that changes after the plan
// was settled never reads a day it no longer has.
//
// Pure: no DOM, no network.
import type { Step } from './types.ts'
import type { Schedule, WaveSchedule } from './schedule.ts'
import { holdOf } from './holds.ts'
import type { HoldKind } from './holds.ts'
import { implementationOffered } from './operations.ts'

/**
 * Where a step stands in the schedule:
 *
 * - `complete`: delivered; nothing left to schedule;
 * - `setAside`: skipped by the operator;
 * - `scheduled`: its next milestone is placed on a day;
 * - `observing`: deployed in report-only and being watched towards its review;
 * - `waiting`: it cannot take its next step, and nothing schedules what it waits
 *   on — a prerequisite, a decision, a review, a conflict, evidence. The one
 *   meaning of Waiting on the Plan: the tile, the Status group and the undated
 *   group all count this and nothing else.
 */
export type ScheduleClass = 'complete' | 'setAside' | 'scheduled' | 'observing' | 'waiting'

/** The lifecycle transition, or the preparation work, the step's scheduled day is for. */
export type ScheduledTransition = 'prepare' | 'decide' | 'verify' | 'createReportOnly' | 'change' | 'enforce' | 'review'

/**
 * What the step's enforcement is worth now:
 * `none` (no enforcement in question), `forecast` (projected by the roadmap),
 * `gated` (held behind a readiness threshold; undated), `earned` (Foundation B's
 * evidence supports it).
 */
export type EnforcementReadiness = 'none' | 'forecast' | 'gated' | 'earned'

/** What the finished plan's schedule decided about a step, kept so the rest can be read from the step as it is now. */
export type ScheduleBasis = {
  /** Where the schedule placed the step, whether or not the placement was later withdrawn. */
  placed: { start: string; end: string } | null
  /** The wave the plan still carries it in. */
  wave: number | null
  /** The wave its withdrawn enforcement was forecast in, while that wave stands. */
  forecastWave: number | null
  /** Each standing wave's first day, in plan order. */
  waveStarts: { wave: number; start: string }[]
  /** The steps it is sequenced after: its hard dependencies in the schedule's graph. */
  after: string[]
  /** It waits on a step whose own decision is still open. */
  decisionOpen: boolean
}

export type StepSchedule = {
  class: ScheduleClass
  transition: ScheduledTransition | null
  /** The day of the next milestone; null where nothing dates it. */
  at: string | null
  /** The days the plan gives the step: its next milestone to the end of the rollout the schedule placed for it. */
  range: { start: string; end: string } | null
  /** The phase (wave number) the step belongs to; null where it belongs to none. */
  wave: number | null
  /** The earliest day the schedule placed the step on; null where it placed it nowhere. */
  earliest: string | null
  enforcement: EnforcementReadiness
  /** What holds the step (roadmap/holds.ts), or null. */
  hold: HoldKind | null
  /** The steps it is sequenced after. */
  after: string[]
  /** What the schedule decided, or null on a step no finished plan settled. */
  basis: ScheduleBasis | null
}

const time = (iso: string): number => Date.parse(iso)
const earlier = (a: string, b: string): string => (time(b) < time(a) ? b : a)
const later = (a: string, b: string): string => (time(b) > time(a) ? b : a)

/** What the finished plan's schedule decided about one step. */
export function basisOf(step: Step, schedule: Schedule, byId: ReadonlyMap<string, Step>): ScheduleBasis {
  const placed = schedule.placement?.placed[step.id] ?? null
  const forecast = schedule.forecastOnly?.[step.id]?.wave ?? null
  return {
    placed: placed ? { start: placed.start, end: placed.end } : null,
    wave: schedule.waveOf[step.id] ?? null,
    forecastWave: forecast !== null && schedule.waves.some((w) => w.wave === forecast) ? forecast : null,
    waveStarts: schedule.waves.map((w) => ({ wave: w.wave, start: w.start })),
    after: (schedule.graph[step.id] ?? []).filter((d) => d.kind === 'hard').map((d) => d.stepId),
    decisionOpen: step.blockers.some((b) => b.kind === 'step' && byId.get(b.stepId)?.state.condition === 'needs-decision'),
  }
}

/**
 * True when a readiness threshold is all that holds a policy that is not deployed,
 * Foundation A hands over its create as safe preparation, and no open decision can
 * still change what that policy is: its report-only creation keeps its day while
 * its enforcement waits (owner decision, 2026-09-11). Only a settled plan says so.
 */
export function createsWhileGated(step: Step, basis: ScheduleBasis | null): boolean {
  if (basis === null || basis.decisionOpen) return false
  if (step.kind !== 'create' || step.state.lifecycle !== 'not-deployed') return false
  return holdOf(step)?.kind === 'readiness' && implementationOffered(step)
}

/** The last standing wave, in plan order, that has begun by `at`; wave 0 where none has. */
function waveContaining(basis: ScheduleBasis, at: string): number {
  let pick = 0
  for (const w of basis.waveStarts) if (time(w.start) <= time(at)) pick = w.wave
  return pick
}

/** The one scheduling result for a step, read from the step as it is now over what the schedule decided. */
export function stepScheduleOf(step: Step, basis: ScheduleBasis | null): StepSchedule {
  const hold = holdOf(step)
  const placed = basis?.placed ?? null
  const base = { hold: hold?.kind ?? null, after: basis?.after ?? [], earliest: placed?.start ?? null, basis }
  const none = { transition: null, at: null, range: null, wave: null } as const
  if (step.status === 'done') return { ...base, ...none, class: 'complete', enforcement: 'none' }
  if (step.status === 'skipped' || step.state.setAside) return { ...base, ...none, wave: basis?.wave ?? null, class: 'setAside', enforcement: 'none' }
  const policy = step.kind === 'create' || step.kind === 'adjust'
  if (hold !== null) {
    if (step.reportOnlyAt && createsWhileGated(step, basis)) {
      // Creation is day-0 work by the scheduler's own definition (schedule.ts
      // WaveSchedule: wave 0 holds foundations and report-only creation).
      return { ...base, class: 'scheduled', transition: 'createReportOnly', at: step.reportOnlyAt, range: { start: step.reportOnlyAt, end: step.reportOnlyAt }, wave: 0, enforcement: 'gated' }
    }
    return { ...base, ...none, class: 'waiting', enforcement: policy ? 'gated' : 'none' }
  }
  const wave = basis?.wave ?? null
  const byDay = (at: string | null): number | null => (basis !== null && at !== null ? waveContaining(basis, at) : null)
  const span = (at: string | null, w: number | null): Pick<StepSchedule, 'at' | 'range' | 'wave'> => ({
    at,
    range: at === null ? null : { start: at, end: placed ? later(at, placed.end) : at },
    wave: w,
  })
  if (!policy) {
    const transition: ScheduledTransition = step.state.condition === 'needs-decision' ? 'decide' : step.kind === 'prerequisite' ? 'prepare' : 'verify'
    return { ...base, ...span(placed?.start ?? null, wave), class: 'scheduled', transition, enforcement: 'none' }
  }
  const lifecycle = step.state.lifecycle
  if (lifecycle === 'report-only') {
    // Watched towards its review day. A window that has closed on records that do
    // not clear it is an evidence hold (above), so an open window is all this is.
    const readyOn = step.tracking?.readyOn ?? null
    const closed = readyOn !== null && step.tracking?.noticedAt != null && time(readyOn) <= time(step.tracking.noticedAt)
    const at = closed ? null : readyOn
    // Its enforcement was taken off the plan (roadmap/forecast.ts): it belongs to
    // the phase that enforcement was forecast in while that phase stands, else the
    // phase its review day falls in.
    return { ...base, at, range: at === null ? null : { start: at, end: at }, wave: wave ?? basis?.forecastWave ?? byDay(at), class: 'observing', transition: 'review', enforcement: 'forecast' }
  }
  if (lifecycle === 'ready-to-enforce') {
    const at = step.events?.enforce.at ?? placed?.start ?? null
    return { ...base, ...span(at, wave ?? byDay(at)), class: 'scheduled', transition: 'enforce', enforcement: 'earned' }
  }
  if (step.kind === 'create' && lifecycle !== 'enforced') {
    return { ...base, ...span(step.reportOnlyAt ?? null, wave), class: 'scheduled', transition: 'createReportOnly', enforcement: 'forecast' }
  }
  // A change to a policy the tenant already has lands on the day the schedule placed it.
  const at = step.events?.enforce.at ?? step.rings[0]?.plannedStart ?? placed?.start ?? null
  return { ...base, ...span(at, wave), class: 'scheduled', transition: 'change', enforcement: 'forecast' }
}

/** The step's scheduling result, read from the step as it is now over what the finished plan decided. */
export function scheduleOf(step: Step): StepSchedule {
  return stepScheduleOf(step, step.scheduled?.basis ?? null)
}

/** A step's one dated event, as an export books it: what the day is for, and the days it spans. */
export type ScheduledEvent = { transition: ScheduledTransition; start: string; end: string }

/**
 * The dated event a step hands to an export (the calendar, a Dates line): its
 * scheduling result's next milestone and the days the plan gives it, or null
 * where nothing dates it — finished, set aside, waiting, or undated. A readiness-
 * gated create is its report-only creation day and nothing of its enforcement; a
 * policy being watched is its review day. No export dates a step any other way.
 */
export function scheduledEventOf(step: Step): ScheduledEvent | null {
  const s = scheduleOf(step)
  if ((s.class !== 'scheduled' && s.class !== 'observing') || s.transition === null || s.at === null) return null
  // A decision is the operator's to make and keeps its own word, never a day (the
  // Plan rail, stepContract.ts railOf): no export books it.
  if (s.transition === 'decide') return null
  // Creation and review are one day's work; a rollout (a change, an enforcement, a
  // preparation) runs to the end of the span the plan gives it.
  const single = s.transition === 'createReportOnly' || s.transition === 'review'
  return { transition: s.transition, start: s.at, end: single ? s.at : (s.range?.end ?? s.at) }
}

/** True where the Plan draws the row in a phase: open work, not a floor recommendation and not one the operator said does not apply. */
const drawnInPhase = (s: Step): boolean => s.status !== 'done' && !s.floor && !s.doesntApply

/**
 * The phases the Plan draws, read off the steps' own results: each wave with the
 * steps whose result places them in it — the wave's own order first — and a range
 * from the wave's placement widened to hold every one of their scheduled spans.
 * A phase never carries a step whose day it does not contain.
 */
export function phasesOf(steps: readonly Step[], schedule: Schedule): WaveSchedule[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  return schedule.waves.map((w) => {
    const inWave = (s: Step | undefined): s is Step => s !== undefined && s.scheduled?.wave === w.wave
    const ids = w.stepIds.filter((id) => inWave(byId.get(id)))
    for (const s of steps) if (inWave(s) && !ids.includes(s.id)) ids.push(s.id)
    let start = w.start
    let end = w.end
    for (const id of ids) {
      const s = byId.get(id)!
      const r = s.scheduled?.range
      if (!r || !drawnInPhase(s)) continue
      start = earlier(start, r.start)
      end = later(end, r.end)
    }
    return { ...w, start, end, days: Math.round((time(end) - time(start)) / 86_400_000), stepIds: ids }
  })
}

/** Writes every step's result and the phases onto the finished plan. Idempotent. */
export function settleSchedule(steps: readonly Step[], schedule: Schedule): void {
  const byId = new Map(steps.map((s) => [s.id, s]))
  for (const s of steps) s.scheduled = stepScheduleOf(s, basisOf(s, schedule, byId))
  schedule.phases = phasesOf(steps, schedule)
}
