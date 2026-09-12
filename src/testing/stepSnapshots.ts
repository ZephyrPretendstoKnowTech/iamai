// Per-step snapshots (A3): what every step of every fixture plan reads on the
// Plan — its lane, substatus, reason line, tenant-fact chip, badge, readiness
// bar, rail, section headings, Readiness tiles, implementation channels and When
// column — computed the way the Plan computes them and written down, one file
// per step under docs/qa/step-snapshots/<fixture>/<stepId>.json.
//
// The committed files are the record; scripts/step-snapshots.mjs writes them and
// src/testing/stepSnapshots.test.ts regenerates them in memory and diffs. A
// change to the engine, the content or a package that moves a step's reading
// shows up as a named step and a named field, never as a surprise on screen.
//
// Deterministic: the fixture's own clock (snapshot.asOf) stamps the tracking,
// the plan starts on runFixture's fixed day, and dates are formatted in UTC so
// the files agree between a laptop and the CI runner. Nothing here reads the
// run date.
//
// Pure: no DOM, no network.
import { fixture } from '../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { cleanupComplete } from '../roadmap/cleanupDone.ts'
import { cleanupEntry } from '../ui/surfaces/cleanupExport.ts'
import type { Step } from '../roadmap/types.ts'
import { setDisplayTimeZone } from '../copy/dates.ts'
import { boardReasonOf, boardWhenOf, laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from '../ui/surfaces/planBoard.ts'
import { laneReadings } from '../ui/surfaces/planLanes.ts'
import { badgeLabel, factOf, railOf } from '../ui/surfaces/stepContract.ts'
import type { LaneView, PrerequisiteBlocker } from '../ui/surfaces/stepContract.ts'
import { planDates } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { channelTabsOf, headingsOf, stepBodyOf } from '../ui/surfaces/stepBody.ts'

/** Where the committed snapshots live, relative to the repository root. */
export const SNAPSHOT_DIR = 'docs/qa/step-snapshots'

/** The fixtures snapshotted (reference/fixtures.md): the demo's two visits and the six synthetic tenants that reach every lane. */
export const SNAPSHOT_FIXTURES: readonly FixtureName[] = ['demo', 'demo-week2', 'small', 'mid', 'large', 'messy', 'midflight', 'hostile']

/** One step's reading, as the Plan draws it. */
export type StepSnapshot = {
  lane: string
  substatus: string | null
  reason: string | null
  fact: string | null
  badge: string
  bar: string
  rail: string
  headings: string[]
  tiles: { label: string; state: string }[]
  channels: string[]
  when: string
}

/** The fields of a snapshot, in file order: the diff names one of these. */
export const SNAPSHOT_FIELDS: readonly (keyof StepSnapshot)[] = ['lane', 'substatus', 'reason', 'fact', 'badge', 'bar', 'rail', 'headings', 'tiles', 'channels', 'when']

/** The display time zone the snapshots are formatted in, so the files agree on every machine. */
const SNAPSHOT_TIME_ZONE = 'UTC'

/**
 * Every step of the fixture's plan, snapshotted, keyed by step id. The plan is
 * runFixture's (the property tests' chain) with the fixture's own clock, and the
 * board is composed as Plan.tsx composes it: the Cleanup rows the Plan draws
 * join the lane readings, and each step's contract is built under the board's
 * lane view with the engine's blockers and the prerequisite labels (A1b).
 */
export function stepSnapshotsOf(name: FixtureName): Record<string, StepSnapshot> {
  setDisplayTimeZone(SNAPSHOT_TIME_ZONE)
  try {
    const f = fixture(name)
    return snapshotsOf(f, runFixture(f, {}, null, f.snapshot.asOf))
  } finally {
    setDisplayTimeZone(null)
  }
}

function snapshotsOf(f: Fixture, r: ReturnType<typeof runFixture>): Record<string, StepSnapshot> {
  const steps = r.steps
  const answers = f.mapping.breakGlassAnswers ?? null
  const cleanup = (r.schedule.cleanup?.rows ?? []).filter((row) => cleanupEntry(row.kind) !== null).map((row) => ({ id: `cleanup-${row.kind}`, complete: cleanupComplete(row, answers) }))
  const readings = laneReadings(steps, cleanup)
  const titleOf = (id: string): string | null => {
    const s = steps.find((x) => x.id === id)
    return s ? s.plainTitle || s.title : null
  }
  const prerequisiteLabel = prerequisiteLabelFor(readings)
  const nameOf = (id: string): string => r.input.names!.label(id)
  const dates = planDates(steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const out: Record<string, StepSnapshot> = {}
  for (const step of [...steps].sort((a, b) => a.id.localeCompare(b.id))) {
    const reading = readings.get(step.id)
    const lane: LaneView = reading ? laneViewOf(reading, titleOf) : laneViewFor(step, steps, titleOf)
    const blockers: PrerequisiteBlocker[] = readinessBlockersOf(reading, titleOf)
    const waveStart = waveStartOf(step)
    const ctx: StepVarContext = {
      snapshot: f.snapshot,
      mapping: f.mapping,
      nameOf,
      signature: 'IT',
      operatorId: f.operatorId,
      now: f.snapshot.asOf,
      ...dates,
      reportOnlyAt: step.reportOnlyAt ?? null,
      scheduledOn: waveStart,
      groups: f.groups,
      directory: r.input.directory,
      naming: r.coverage.organisation.naming,
    }
    out[step.id] = snapshotOf(step, ctx, lane, blockers, prerequisiteLabel, waveStart)
  }
  return out
}

function snapshotOf(step: Step, ctx: StepVarContext, lane: LaneView, blockers: PrerequisiteBlocker[], prerequisiteLabel: (id: string) => string | null, waveStart: string | null): StepSnapshot {
  const b = stepBodyOf(step, ctx, { lane, blockers, prerequisiteLabel })
  return {
    lane: lane.lane,
    substatus: lane.substatus,
    reason: boardReasonOf(step),
    fact: factOf(step),
    badge: badgeLabel(b.contract),
    bar: b.readiness.bar.main,
    rail: railOf(b.contract).metric,
    headings: headingsOf(b),
    tiles: b.readiness.tiles.map((t) => ({ label: t.label, state: t.value })),
    channels: channelTabsOf(b.artifacts).map((t) => String(t.label)),
    when: boardWhenOf(step, waveStart),
  }
}

/** The file a step's snapshot is written to, relative to the repository root. */
export function snapshotPath(name: FixtureName, stepId: string): string {
  return `${SNAPSHOT_DIR}/${name}/${stepId}.json`
}

/** The snapshot as it is written: the fields in order, two-space indented, one trailing newline. */
export function snapshotText(s: StepSnapshot): string {
  const ordered: Record<string, unknown> = {}
  for (const k of SNAPSHOT_FIELDS) ordered[k] = s[k]
  return `${JSON.stringify(ordered, null, 2)}\n`
}
