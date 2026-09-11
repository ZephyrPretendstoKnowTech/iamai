// The Plan usability pass (owner, 2026-09-11): the toolbar is one control family;
// the opened step's prose uses its main column; the schedule starts today and
// deploys from the next eligible workday; every row reads When and Impact; the
// header is progress tiles.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { effectiveFirstDeployment, proposedFirstDeployment, proposedStart } from '../../derive/planStart.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import { dateSpan } from '../../copy/dates.ts'
import { boardWhenOf } from './planBoard.ts'
import { rowWho } from './rowWho.ts'
import { reached } from '../../derive/population.ts'
import { effectsOf } from '../../roadmap/strand.ts'
import { holdWaitsOn } from '../../roadmap/stateReason.ts'
import { isHeld } from '../../roadmap/holds.ts'

const CSS = readFileSync('src/ui/app.css', 'utf8')

/** The declarations of the first top-level rule whose selector list is exactly `selector`. */
function rule(selector: string): string {
  const at = CSS.indexOf(`\n${selector} {`)
  assert.ok(at >= 0, `no rule ${selector}`)
  return CSS.slice(CSS.indexOf('{', at) + 1, CSS.indexOf('}', at))
}

// ------------------------------------------------------------ toolbar and width

test('the Group by segments are one control: no gap, no inline padding, no margin, the control height, equal widths', () => {
  const group = rule('.plan-controls .tabs.view-tabs')
  for (const d of ['gap: 0', 'padding: 0', 'margin: 0', 'height: var(--control)', 'grid-auto-columns: minmax(0, 1fr)', 'border-radius: var(--radius-control)']) assert.ok(group.includes(d), `the segmented group lacks ${d}`)
  const segment = rule('.plan-controls .tabs.view-tabs .tab')
  for (const d of ['justify-content: center', 'align-items: center', 'text-align: center', 'height: 100%', 'font-size: var(--t-2)']) assert.ok(segment.includes(d), `a segment lacks ${d}`)
  // The selected segment is filled, and nothing inside the group leaves a strip before the first cell.
  assert.match(rule(".plan-controls .tabs.view-tabs .tab[aria-selected='true']"), /background: var\(--brand-soft\)/)
  // Search and the focus toggles share the height and the radius.
  for (const sel of ['.plan-search input', '.plan-controls .focus']) {
    const r = rule(sel)
    assert.ok(r.includes('height: var(--control)') && r.includes('border-radius: var(--radius-control)'), `${sel} is not the same control`)
  }
  // The clipped group draws the focus indicator inside the segment, so it is never cut off.
  assert.match(rule('.plan-controls .tabs.view-tabs .tab:focus-visible'), /outline-offset: -2px/)
})

test('Why, Done when and the Implementation copy are not held to the 72ch prose cap inside the opened step', () => {
  assert.match(CSS, /\.step \.step-main p,\n\.step \.step-main ul,\n\.step \.step-main ol \{\n\s*max-width: none;/)
  // The site-wide measure still governs every other surface.
  assert.match(CSS, /\.surface p,\n\.surface ul,\n\.surface ol \{[^}]*max-width: var\(--measure\)/)
})

// ------------------------------------------------------------ scheduling

test('a first plan starts today, and its first deployment is the next eligible workday; a saved day stands', () => {
  assert.equal(proposedStart(null, new Date('2026-09-11T09:00:00Z')), '2026-09-11T12:00:00.000Z')
  // Friday → Monday; Tuesday → Wednesday; a weekend start is its Monday, and deployment the Tuesday after.
  assert.equal(proposedFirstDeployment('2026-09-11T12:00:00.000Z'), '2026-09-14T12:00:00.000Z')
  assert.equal(proposedFirstDeployment('2026-09-15T12:00:00.000Z'), '2026-09-16T12:00:00.000Z')
  assert.equal(proposedFirstDeployment('2026-09-12T12:00:00.000Z'), '2026-09-15T12:00:00.000Z')
  // A day the operator saved stands while it is not before the start; one before it is refused.
  assert.equal(effectiveFirstDeployment('2026-09-14T12:00:00.000Z', { firstDeployment: '2026-09-21T12:00:00.000Z' }), '2026-09-21T12:00:00.000Z')
  assert.equal(effectiveFirstDeployment('2026-09-14T12:00:00.000Z', { firstDeployment: '2026-09-01T12:00:00.000Z' }), '2026-09-15T12:00:00.000Z')
  // A plan started before the setting existed keeps deploying from its start.
  assert.equal(effectiveFirstDeployment('2026-09-14T12:00:00.000Z', { startedAt: '2026-09-14T08:00:00.000Z' }), '2026-09-14T12:00:00.000Z')
  // The hook never writes over a saved start, and Start anchors the first deployment with it.
  const hook = readFileSync('src/ui/surfaces/planData.ts', 'utf8')
  assert.match(hook, /const startDate = saved\?\.startDate \?\? \(snapshot \? proposedStart\(/)
  assert.match(hook, /startDate: effectiveStart, firstDeployment: effectiveFirstDeployment\(effectiveStart, p\)/)
})

test('moving the first deployment or the start moves report-only creation, the phases and every date downstream', () => {
  const f = fixture('small')
  const base = runFixture(f)
  const later = runFixture(f, { firstDeployment: '2026-09-15T12:00:00.000Z' })
  const first = (r: typeof base): string => Object.values(r.schedule.reportOnlyAt ?? {}).sort()[0]
  assert.equal(first(base).slice(0, 10), '2026-08-31', 'the fixture creates on its start without a first deployment')
  assert.equal(first(later).slice(0, 10), '2026-09-15', 'report-only creation did not follow the first deployment')
  assert.equal(later.schedule.waves[0].start, base.schedule.waves[0].start, 'preparation moved with the first deployment; it begins on the start')
  const wave1 = (r: typeof base): string => r.schedule.waves.find((w) => w.wave >= 1)!.start
  assert.ok(wave1(later) > wave1(base), 'the first enforcement phase did not move downstream')
  assert.ok(later.schedule.verification.start.slice(0, 10) >= '2026-09-15', 'the registration window opened before the first deployment')
  const moved = runFixture(f, { startDate: '2026-10-05T12:00:00.000Z' })
  assert.equal(moved.schedule.waves[0].start.slice(0, 10), '2026-10-05')
  assert.ok(wave1(moved) > wave1(base), 'a later start did not move the phases')
})

test('a phase reads its span compactly: one day, within a month, across months, across years', () => {
  assert.equal(dateSpan('2026-09-11T12:00:00.000Z', '2026-09-11T12:00:00.000Z'), 'Sep 11')
  assert.equal(dateSpan('2026-09-11T12:00:00.000Z', '2026-09-16T12:00:00.000Z'), 'Sep 11–16')
  assert.equal(dateSpan('2026-09-29T12:00:00.000Z', '2026-10-03T12:00:00.000Z'), 'Sep 29–Oct 3')
  assert.equal(dateSpan('2026-12-29T12:00:00.000Z', '2027-01-04T12:00:00.000Z'), 'Dec 29, 2026–Jan 4, 2027')
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /dates: dateSpan\(w\.start, w\.end\)/, 'the numbered phases do not read their span')
  assert.match(plan, /date: cannotFinish \? WHEN\.notScheduled : dateSpan\(cleanupPhase\.start, cleanupPhase\.end\)/)
  assert.match(plan, /key: 'held', label: HELD\.heading, date: placedSpan\(heldRows\)/, 'the waiting group has no timeline')
})

// ------------------------------------------------------------ WHEN and Impact

const RUNS = (['small', 'demo', 'demo-week2', 'messy'] as const).map((name) => ({ name, r: runFixture(fixture(name)) }))

test('every row reads a When value: a date, a reason, what it waits on, Complete or Not scheduled — never blank', () => {
  let complete = 0
  let waits = 0
  let dated = 0
  for (const { name, r } of RUNS) {
    const byId = new Map(r.steps.map((s) => [s.id, s]))
    const titleOf = (id: string): string | null => {
      const s = byId.get(id)
      return s ? s.plainTitle || s.title : null
    }
    for (const s of r.steps as Step[]) {
      const wi = r.schedule.waveOf?.[s.id]
      const when = boardWhenOf(s, wi !== undefined ? (r.schedule.waves[wi]?.start ?? null) : null, titleOf)
      assert.notEqual(when.trim(), '', `${name}/${s.id}: a blank When`)
      if (s.status === 'done') {
        assert.equal(when, 'Complete', `${name}/${s.id}`)
        complete += 1
      }
      if (isHeld(s) && holdWaitsOn(s).length > 0 && !/reaches|held until/.test(when)) {
        assert.match(when, /^After /, `${name}/${s.id}: a hold that names the step it waits on reads "${when}"`)
        waits += 1
      }
      if (/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(when)) dated += 1
    }
  }
  assert.ok(complete > 0 && waits > 0 && dated > 0, `complete ${complete}, waits ${waits}, dated ${dated}`)
})

test('every row reads an Impact value: people, No user impact, Configuration only, or Not established — never blank, never zero for unknown', () => {
  const seen = new Set<string>()
  for (const { name, r } of RUNS) {
    const nameOf = (id: string): string => r.input.names!.label(id)
    for (const s of r.steps as Step[]) {
      const impact = rowWho(s, nameOf)
      assert.notEqual(impact.trim(), '', `${name}/${s.id}: a blank Impact`)
      const pop = reached(s)
      if (pop === null) {
        assert.equal(impact, 'Not established', `${name}/${s.id}`)
        seen.add('unknown')
      } else if ((pop.activeIds ?? pop.ids).length === 0) {
        assert.match(impact, effectsOf(s) === null ? /^Configuration only/ : /^No user impact/, `${name}/${s.id}`)
        seen.add(effectsOf(s) === null ? 'configuration' : 'none')
      } else {
        assert.doesNotMatch(impact, /^(No user impact|Configuration only|Not established)/, `${name}/${s.id}`)
        seen.add('known')
      }
    }
  }
  for (const k of ['unknown', 'configuration', 'known']) assert.ok(seen.has(k), `no fixture row shows the ${k} impact case`)
  assert.equal(readFileSync('src/derive/whoLine.ts', 'utf8').includes("'nobody affected'"), false, 'the awkward "nobody affected" is still a row word')
})

// ------------------------------------------------------------ header

test('the Plan header is four progress tiles and a how-to link, not a generated sentence', () => {
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.equal(plan.includes('headerLine1('), false, 'the Plan still composes the status sentence')
  assert.match(plan, /<dl className="plan-progress-tiles" aria-label=\{PP\.progress\.label\}>/)
  for (const key of ['steps', 'inPlace', 'waiting', 'remaining']) assert.match(plan, new RegExp(`key: '${key}', label: PP\\.progress\\.${key}`))
  assert.match(plan, /aria-expanded=\{showHow\} aria-controls=\{PLAN_HOW_ID\}/)
  const content = JSON.parse(readFileSync('docs/design/content.json', 'utf8')) as { pages: { plan: { howTo: { items: string[] }; progress: Record<string, string> } } }
  assert.equal(content.pages.plan.howTo.items.length, 5)
  assert.deepEqual([content.pages.plan.progress.steps, content.pages.plan.progress.inPlace, content.pages.plan.progress.waiting, content.pages.plan.progress.remaining], ['Steps', 'In place', 'Waiting', 'Remaining'])
})
