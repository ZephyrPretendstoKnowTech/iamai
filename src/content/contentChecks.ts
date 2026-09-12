// The browser-free half of the walk, in one place.
//
// `npm run walk` runs in CI only, so an expectation that lives inside walk.mjs
// alone is not read until a push. Everything the walk can decide from the
// content file and the renderers — the words a surface is named by, the shape of
// a sentence the engine fills, the verb the pluraliser bends — belongs here
// instead: `contentChecks.test.ts` runs it in `npm test`, and walk.mjs imports
// the same values rather than repeating them. A stale expectation then fails on
// the developer's machine, not in the deploy job.
//
// What stays in the walk: anything that needs a rendered page. The regexes below
// are exported because the walk applies them to the DOM and this module applies
// them to the content that produces it, and the two must be one expectation.
//
// This is deliberately a bounded set — the authorities the walk names and the
// sentences it reads — never a sweep of every product literal.
import { content, stepById } from './content.ts'
import { fillText } from './render.ts'
import * as readinessModel from '../derive/mfaReadiness.ts'

export type Finding = { level: 'P0' | 'P1' | 'P2'; text: string }

const at = (path: string): unknown =>
  path.split('.').reduce<unknown>(
    (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
    content as unknown,
  )

/** The string at a content path, or '' when the path no longer resolves. */
export function textAt(path: string): string {
  const v = at(path)
  return typeof v === 'string' ? v : ''
}

/**
 * The content paths the walk reads as authorities. A key that moves or is
 * renamed turns a walk expectation into a comparison against `undefined`, which
 * the browser walk can only report as a mismatched page. Named here, the move
 * fails in `npm test` instead. An entry ending in `[]` is an array of strings.
 */
export const AUTHORITIES = [
  // The three header tabs, in order (ui/shell/AppShell.tsx).
  'pages.app.shell.tabs.connect',
  'pages.app.shell.tabs.plan',
  'pages.app.shell.tabs.readiness',
  'pages.app.shell.tabs.export',
  'pages.app.shell.tabs.how',
  // MFA Readiness: the summary sentence, its empty-tenant form, the Ready state and the three summary counts.
  'pages.readiness.summary',
  'pages.readiness.summaryNone',
  'pages.readiness.states.ready.title',
  'pages.readiness.states.needsProof.stat',
  'pages.readiness.states.needsSetup.stat',
  'pages.readiness.states.unknown.stat',
  // The two completion gates a report-only policy renders under Done when.
  'shared.policyDoneWhenTracked[]',
  'shared.engine.tracking.windowCloses',
  'shared.engine.tracking.windowClosed',
  'shared.engine.tracking.readyNow',
  'shared.engine.tracking.evidenceToday',
  'shared.engine.tracking.evidenceTodayUnread',
]

/**
 * The expectations the walk applies to a rendered page. The walk reads them off
 * the DOM; the checks below read them off the sentence the content authors, so
 * a rewording that breaks the walk is caught before the push.
 */
export const RE = {
  /** The time gate on a report-only step's Done when (walk: plan.step body). */
  gateTime: /Time: in report-only since .+, the window clos(es|ed) \S.*\d{4}\./,
  /** The evidence gate with today's numbers, in each of its three forms. */
  gateEvidence:
    /Evidence: .+; today (ready now: 0 failures in \d+ days|\d+ failing or interrupted, \d+ of \d+ active people seen in \d+ days|no sign-in records read for this policy, \d+ of \d+ active people seen in \d+ days)\./,
  /** A window that has closed, on the step's time line. */
  gateWindowClosed: /the window closed \S.*\d{4}\./,
  /** The Done when of a row reading Ready · Ready to enforce: the evidence gate says ready now. */
  gateReadyNow: /ready now: 0 failures in \d+ days/,
  /** The readiness summary, in either tense: pluralise() may bend the verb to the count. */
  readinessSummary: /(\d+) of (\d+) (?:is|are) Ready\./,
  /** A tenant with nobody active says so instead, and has no numbers to state. */
  readinessSummaryNone: /No active people to count/,
}

/**
 * The header tabs as the walk reads them off `header.app nav a`, in order.
 *
 * The order is the product's own (task 017): Connect, then the Plan, then the
 * MFA Readiness diagnostic behind it, then Export, then How. The plan is the
 * destination after a scan and the readiness surface reads the people it waits
 * on, so the plan is named first; a header that listed readiness first would
 * put the diagnostic in front of the thing it serves.
 */
export const HEADER_TAB_KEYS = ['connect', 'plan', 'readiness', 'export', 'how'] as const

export function headerTabsLine(): string {
  return HEADER_TAB_KEYS.map((k) => textAt(`pages.app.shell.tabs.${k}`)).join(' · ')
}

/** The three counts MFA Readiness's summary shows beside Ready, in page order (derive/mfaReadiness.ts SUMMARY_STATES). */
export function readinessStatTitles(): string[] {
  return (readinessModel.SUMMARY_STATES ?? []).map((k) => textAt(`pages.readiness.states.${k}.stat`))
}

/** The word on MFA Readiness's every-active-person filter, so the walk can clear one it pressed. */
export function readinessAllWord(): string {
  return textAt('pages.readiness.show.all')
}

// The policy steps whose content carries a "before" line (a setting to change
// before the policy exists) that the step keeps above the translator's portal
// lines: the device-settings toggle, the Intune compliance settings, password
// writeback, the SharePoint access control.
export const BEFORE_STEP_IDS = ['device-registration-mfa', 'require-managed-device', 'user-risk', 'user-risk-medium', 'unmanaged-browser']

/** Each before-step with the lines its content carries; the walk places them on the page. */
export function beforeLines(): { id: string; title: string; lines: string[] }[] {
  return BEFORE_STEP_IDS.map((id) => {
    const s = stepById[id] as { title?: string; whatToDo?: { before?: unknown[] } } | undefined
    const lines = (s?.whatToDo?.before ?? []).filter((l): l is string => typeof l === 'string')
    return { id, title: s?.title ?? id, lines }
  })
}

// The pluraliser conjugates the verb with the count wherever {n} precedes a verb
// (content/render.ts pluralise()): a count of one reads as one, noun and verb. A
// check that hardcodes one tense fails on a count of one, so both are asserted.
const PLURALISER: [string, Record<string, unknown>, string][] = [
  ['{admins} people hold an admin role', { admins: 1 }, '1 person holds an admin role'],
  ['{admins} people hold an admin role', { admins: 3 }, '3 people hold an admin role'],
  ['{n} of them have no passkey or key yet.', { n: 1 }, '1 of them has no passkey or key yet.'],
  ['{n} of them have no passkey or key yet.', { n: 4 }, '4 of them have no passkey or key yet.'],
]

// The two conjugated who-lines the content owns; read from the step so a rewrite
// of the line is checked rather than a copy of it.
const PLURALISED_CONTENT: [string, Record<string, unknown>, string][] = [
  ['admins-phishing-resistant', { admins: 1 }, '1 person holds an admin role'],
  ['admins-phishing-resistant', { admins: 3 }, '3 people hold an admin role'],
  [
    's-check-separate-admin-accounts',
    { n: 1, from: 'Aug 1' },
    '1 person holds a directory role and uses that same account for mail or Teams since Aug 1:',
  ],
]

const leadOf = (id: string): string => {
  const s = stepById[id] as { who?: { lead?: unknown } } | undefined
  return typeof s?.who?.lead === 'string' ? s.who.lead : ''
}

/**
 * Every browser-free finding the walk would otherwise only reach in CI.
 * Same shape as `contentFindings` in scripts/walkContent.mjs: the walk adds each
 * one at its own level, so nothing the walk used to fail on is downgraded here.
 */
export function staticFindings(): Finding[] {
  const out: Finding[] = []
  const add = (text: string): void => {
    out.push({ level: 'P0', text })
  }

  // The authorities still resolve where the walk and the surfaces read them.
  for (const path of AUTHORITIES) {
    if (path.endsWith('[]')) {
      const v = at(path.slice(0, -2))
      if (!Array.isArray(v) || v.length === 0 || v.some((x) => typeof x !== 'string' || !x.trim())) {
        add(`content ${path.slice(0, -2)}: not a non-empty array of strings; a surface authority the walk reads has moved`)
      }
      continue
    }
    if (!textAt(path).trim()) add(`content ${path}: missing or empty; a surface authority the walk reads has moved`)
  }

  // The header names three tabs and no more; a renamed key would read "undefined".
  const tabs = headerTabsLine()
  if (tabs.split(' · ').filter(Boolean).length !== HEADER_TAB_KEYS.length) add(`content pages.app.shell.tabs: the header line reads "${tabs}"; ${HEADER_TAB_KEYS.length} tabs are named`)

  // MFA Readiness's summary counts three states beside Ready, all distinct.
  const groups = readinessStatTitles()
  if (groups.length !== 3 || groups.some((t) => !t) || new Set(groups).size !== 3) {
    add(`content pages.readiness.states: the summary counts read ${JSON.stringify(groups)}; three distinct titles are named`)
  }

  // The readiness summary reads in either tense, and its empty and unknown forms
  // are the sentences the page check looks for.
  for (const [vals, label] of [
    [{ ready: 1, active: 1 }, 'a count of one'],
    [{ ready: 2, active: 3 }, 'a count above one'],
  ] as [Record<string, unknown>, string][]) {
    const got = fillText(textAt('pages.readiness.summary'), vals)
    if (!RE.readinessSummary.test(got)) add(`content pages.readiness.summary: with ${label} it reads "${got}", which the readiness check cannot read`)
  }
  if (fillText(textAt('pages.readiness.summary'), { ready: 1, active: 1 }) === fillText(textAt('pages.readiness.summary'), { ready: 2, active: 3 })) {
    add('content pages.readiness.summary: the sentence does not change with the count; the pluraliser is not bending its verb')
  }
  if (!RE.readinessSummaryNone.test(textAt('pages.readiness.summaryNone'))) {
    add(`content pages.readiness.summaryNone: reads "${textAt('pages.readiness.summaryNone')}", which the readiness check cannot read`)
  }

  // The two completion gates, filled the way the engine fills them.
  const tracked = at('shared.policyDoneWhenTracked')
  const timeLine = Array.isArray(tracked) && typeof tracked[0] === 'string' ? tracked[0] : ''
  const evidenceLine = Array.isArray(tracked) && typeof tracked[1] === 'string' ? tracked[1] : ''
  const DATE = '20 August 2026'
  for (const [key, label] of [['windowCloses', 'a window still open'], ['windowClosed', 'a window that has closed']] as [string, string][]) {
    const got = fillText(timeLine, { reportOnly: '12 Aug', timeGate: fillText(textAt(`shared.engine.tracking.${key}`), { date: DATE }) })
    if (!RE.gateTime.test(got)) add(`content shared.policyDoneWhenTracked[0] with ${label}: reads "${got}", which the report-only time-gate check cannot read`)
  }
  // A row held until the records clear: the step's time line says the window has
  // closed, so the check reads the whole sentence, not the fragment inside it.
  const closed = fillText(timeLine, { reportOnly: '12 Aug', timeGate: fillText(textAt('shared.engine.tracking.windowClosed'), { date: DATE }) })
  if (!RE.gateWindowClosed.test(closed)) add(`content shared.engine.tracking.windowClosed: the time line reads "${closed}", which the held-for-the-records check cannot read`)
  const ready = fillText(textAt('shared.engine.tracking.readyNow'), { n: 14 })
  if (!RE.gateReadyNow.test(ready)) add(`content shared.engine.tracking.readyNow: reads "${ready}", which the ready-now check cannot read`)
  for (const [key, vals, label] of [
    ['readyNow', { n: 14 }, 'no failures'],
    ['evidenceToday', { failures: 2, seen: 3, people: 4, n: 14 }, "today's failures"],
    ['evidenceTodayUnread', { seen: 3, people: 4, n: 14 }, 'no records read'],
  ] as [string, Record<string, unknown>, string][]) {
    const got = fillText(evidenceLine, { reportOnly: '12 Aug', evidenceGate: fillText(textAt(`shared.engine.tracking.${key}`), vals) })
    if (!RE.gateEvidence.test(got)) add(`content shared.policyDoneWhenTracked[1] with ${label}: reads "${got}", which the report-only evidence-gate check cannot read`)
  }

  // The pluraliser, on its own templates and on the two who-lines the content owns.
  for (const [line, vals, want] of PLURALISER) {
    const got = fillText(line, vals)
    if (got !== want) add(`pluraliser: "${line}" with ${JSON.stringify(vals)} reads "${got}", not "${want}"`)
  }
  for (const [id, vals, want] of PLURALISED_CONTENT) {
    const line = leadOf(id)
    if (!line) {
      add(`content ${id}: no who.lead; the conjugated who-line the walk reads has moved`)
      continue
    }
    const got = fillText(line, vals)
    if (got !== want) add(`pluraliser: ${id} who.lead with ${JSON.stringify(vals)} reads "${got}", not "${want}"`)
  }

  // The before lines exist for every step that must render one above its portal lines.
  for (const b of beforeLines()) {
    if (b.lines.length === 0) add(`content ${b.id}: no whatToDo.before line; the setting to change before the policy exists is not above its portal lines`)
  }

  return out
}
