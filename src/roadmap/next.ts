// "Do this next" (prompt 30 §2): one to three items for a person with two
// hours, chosen in order: unblocked prerequisites other steps wait on, safe
// steps with nobody affected, the readiness work that unblocks the most
// steps, then the best value-to-disruption step that is ready. Never a
// blocked step. Pure.
import { NEXT } from '../copy/next.ts'
import { absoluteDate } from '../copy/dates.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import type { Schedule } from './schedule.ts'
import type { Step } from './types.ts'

export type NextItem = {
  kind: 'blocker' | 'prerequisite' | 'safeToday' | 'readiness' | 'ready'
  stepId: string
  title: string
  why: string
  touches: string
  minutes: number
}

export type NextCard = {
  items: NextItem[]
  /** When nothing is available: the date something changes, and why. */
  waiting: string | null
  /** Steps that became enforced since the previous scan, to lead with. */
  completed: string[]
}

/** Minutes of admin work to carry out a step (the basis: portal clicks per kind, plus a minute per person to set up). */
export function effortMinutes(step: Step): number {
  switch (step.kind) {
    case 'prerequisite':
      return 10
    case 'verify':
      return 30 + Math.max(0, step.population.total - step.population.active) * 0 + Math.round((step.impact.match(/\d+/)?.[0] ? Number(step.impact.match(/\d+/)![0]) : 0) * 3)
    case 'recurring':
      return 15
    case 'adjust':
      return 10
    default:
      return 15 + Math.min(30, step.rings.length * 5)
  }
}

export function doThisNext(
  steps: Step[],
  schedule: Schedule,
  viability: MfaViability[],
  nameOf: (id: string) => string,
  previousStatus: Record<string, string> | null,
  now: string = new Date().toISOString(),
): NextCard {
  const work = steps.filter((s) => s.status !== 'done' && s.status !== 'skipped')
  const waitedOn = new Map<string, number>()
  for (const s of work) for (const b of s.blockedBy) waitedOn.set(b, (waitedOn.get(b) ?? 0) + 1)
  const items: NextItem[] = []
  const touches = (s: Step): string => {
    if (s.population.total === 0) return NEXT.touches.nobody
    if (s.population.total < 4) return NEXT.touches.named(s.population.ids.map(nameOf).join(', '))
    return NEXT.touches.people(s.population.total)
  }

  // (a0) validation blockers: while the way back in is unverified, nothing else
  // is the right thing to start (validation-rules.md §2).
  for (const s of work.filter((x) => x.validationBlocker && x.status === 'ready')) {
    if (items.length >= 3) break
    items.push({
      kind: 'blocker',
      stepId: s.id,
      title: s.plainTitle || s.title,
      why: NEXT.why.blocker(waitedOn.get(s.id) ?? 0),
      touches: NEXT.touches.nobody,
      minutes: effortMinutes(s),
    })
  }
  // (a) unblocked prerequisites that other steps wait on
  const prereqs = work
    .filter((s) => s.kind === 'prerequisite' && s.status === 'ready' && !s.validationBlocker)
    .sort((a, b) => (waitedOn.get(b.id) ?? 0) - (waitedOn.get(a.id) ?? 0))
  for (const s of prereqs) {
    if (items.length >= 3) break
    items.push({ kind: 'prerequisite', stepId: s.id, title: s.plainTitle || s.title, why: NEXT.why.prerequisite(waitedOn.get(s.id) ?? 0), touches: NEXT.touches.nobody, minutes: effortMinutes(s) })
  }
  // (b) safe-today steps with nobody affected
  for (const s of work.filter((x) => x.safeToday && x.status !== 'blocked')) {
    if (items.length >= 3) break
    items.push({ kind: 'safeToday', stepId: s.id, title: s.plainTitle || s.title, why: NEXT.why.safeToday(effortMinutes(s)), touches: touches(s), minutes: effortMinutes(s) })
  }
  // (c) the readiness work that unblocks the most steps
  if (items.length < 3) {
    const verify = work.find((s) => s.kind === 'verify')
    const needSetup = viability.filter((v) => v.enabled && v.activity === 'active' && (v.mfa === 'none' || v.mfa === 'unverified'))
    const unblocks = work.filter((s) => s.blockers.some((b) => b.kind === 'readiness') && (s.readiness.family === 'mfa' || s.readiness.family === 'guest')).length
    if (verify && verify.status === 'ready' && needSetup.length > 0 && unblocks > 0) {
      const names = needSetup.slice(0, 3).map((v) => nameOf(v.userId)).join(', ')
      items.push({ kind: 'readiness', stepId: verify.id, title: verify.plainTitle || verify.title, why: NEXT.why.readiness(needSetup.length, unblocks), touches: needSetup.length <= 3 ? names : NEXT.touches.people(needSetup.length), minutes: 5 * needSetup.length })
    }
  }
  // (d) the highest value-to-disruption step that is ready
  if (items.length < 3) {
    const ready = work
      .filter((s) => s.status === 'ready' && (s.kind === 'create' || s.kind === 'adjust') && !items.some((i) => i.stepId === s.id))
      .sort((a, b) => (b.score?.priority ?? 0) - (a.score?.priority ?? 0))
    for (const s of ready) {
      if (items.length >= 3) break
      items.push({ kind: 'ready', stepId: s.id, title: s.plainTitle || s.title, why: NEXT.why.ready, touches: touches(s), minutes: effortMinutes(s) })
    }
  }

  // Nothing available: say when that changes.
  let waiting: string | null = null
  if (items.length === 0) {
    const nowMs = Date.parse(now)
    const candidates: { at: string; why: string }[] = []
    if (Date.parse(schedule.observation.end) > nowMs) candidates.push({ at: schedule.observation.end, why: NEXT.observationEnds })
    if (schedule.verification.days > 0 && Date.parse(schedule.verification.end) > nowMs) candidates.push({ at: schedule.verification.end, why: NEXT.campaignEnds })
    for (const s of work) {
      const ring = s.rings.find((r) => r.actualStart && !r.actualEnd)
      if (ring && Date.parse(ring.plannedEnd) > nowMs) candidates.push({ at: ring.plannedEnd, why: NEXT.soakEnds })
      if (s.events?.enforce && Date.parse(s.events.enforce.at) > nowMs) candidates.push({ at: s.events.enforce.at, why: NEXT.noticeEnds })
    }
    candidates.sort((a, b) => a.at.localeCompare(b.at))
    waiting = candidates[0] ? NEXT.nothingUntil(absoluteDate(candidates[0].at), candidates[0].why) : NEXT.nothing
  }

  const completed = previousStatus ? steps.filter((s) => s.status === 'done' && previousStatus[s.id] !== undefined && previousStatus[s.id] !== 'done').map((s) => s.plainTitle || s.title) : []
  return { items, waiting, completed }
}
