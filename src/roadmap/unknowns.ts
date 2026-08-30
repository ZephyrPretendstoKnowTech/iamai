// What a short observation window cannot see, and the question that closes it
// (observation-and-readiness.md §1, prompt 42 Part 1 items 3-5).
//
// The trade the design makes: windows are short, and the gap between what the
// evidence covers and what the control can break is STATED as an unknown the
// user can close in one click, rather than waited out. Each entry carries the
// fact behind it, because "does anyone travel?" without the reason reads as
// bureaucracy; with the reason it reads as a real risk.
//
// An unanswered question is never a blocker (§5). It renders on the step and in
// the verdict as something the records cannot confirm, so nobody mistakes
// silence for safety.
import type { Step } from './types.ts'

export type UnknownId = 'staleDevice' | 'unmanagedPlatforms' | 'travel' | 'infrequent' | 'shared' | 'riskSparse'

export type Unknown = {
  id: UnknownId
  /** What the window cannot see, with the fact behind it. */
  cannotSee: string
  /** The question the user can answer, or null where there is nothing to ask. */
  question: string | null
}

export const UNKNOWNS: Record<UnknownId, Unknown> = {
  staleDevice: {
    id: 'staleDevice',
    cannotSee:
      'A device that stops reporting is marked non-compliant only after the compliance status validity period, thirty days by default. A laptop back from a month away is blocked with nothing having changed.',
    question: 'Does anyone here go weeks without connecting?',
  },
  unmanagedPlatforms: {
    id: 'unmanagedPlatforms',
    cannotSee: 'Devices Intune cannot mark compliant: Windows Home, some Linux builds, personal machines.',
    question: 'Are personal or unmanaged devices used for work here?',
  },
  travel: {
    id: 'travel',
    cannotSee: 'Travel and roaming. A week of records shows where people were, not where they go.',
    question: 'Does anyone travel or work from another country?',
  },
  infrequent: {
    id: 'infrequent',
    cannotSee: 'People who sign in rarely.',
    question: 'Does anyone sign in less than monthly?',
  },
  shared: {
    id: 'shared',
    cannotSee: 'Shared, kiosk and frontline accounts that cannot hold a personal method.',
    question: 'Are there shared or kiosk accounts?',
  },
  riskSparse: {
    id: 'riskSparse',
    // The one row with no question: there is nothing the user can tell IAMAI
    // that would fill this gap, so asking would be theatre.
    cannotSee: 'Risk detections are sparse. A week may contain none at all, so a clean window is not evidence that the policy does nothing.',
    question: null,
  },
}

/**
 * The unknowns that apply to this step, by what it controls.
 *
 * `infrequent` applies to every grant control, because any of them can stop
 * someone the window never saw. The device and location entries apply only
 * where the control actually depends on that signal.
 */
export function unknownsFor(step: Step): Unknown[] {
  const out: Unknown[] = []
  const family = step.readiness.family
  if (family === 'device') out.push(UNKNOWNS.staleDevice, UNKNOWNS.unmanagedPlatforms)
  if (family === 'location') out.push(UNKNOWNS.travel)
  if (/risk/i.test(step.goalId)) out.push(UNKNOWNS.riskSparse)
  // Any control that can deny access can deny it to someone the window did not
  // see, and to an account that cannot hold a personal method.
  if (step.denies !== false) out.push(UNKNOWNS.infrequent, UNKNOWNS.shared)
  return out
}

/** What the user said, and when. Stored in the plan. */
export type Assertion = {
  id: UnknownId
  answer: 'yes' | 'no'
  at: string
  /** The people or devices named, where the answer was yes and named any. */
  subjects?: string[]
  /** What was done about it, decided when the answer was given. */
  effect: 'carveOut' | 'laterWave' | 'accepted'
}

export const ASSERTION_EFFECT = {
  carveOut: 'Added to this step’s carve-out.',
  laterWave: 'Moved to a later wave, so these people are handled deliberately.',
  accepted: 'Recorded as accepted. It appears in the change record.',
} as const

/** The three things an answer can do, offered at the time it is given (§4). */
export const ASSERTION_CHOICES: { effect: Assertion['effect']; label: string }[] = [
  { effect: 'carveOut', label: 'Carve these people out of this step' },
  { effect: 'laterWave', label: 'Move this step to a later wave' },
  { effect: 'accepted', label: 'Proceed and accept it' },
]

/** Unanswered unknowns, which are stated and never block (§5). */
export function unansweredFor(step: Step, assertions: Assertion[]): Unknown[] {
  const answered = new Set(assertions.map((a) => a.id))
  return unknownsFor(step).filter((u) => !answered.has(u.id))
}
