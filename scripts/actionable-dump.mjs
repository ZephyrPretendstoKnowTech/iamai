// Every actionable panel the product draws inside a step body, per step, per
// fixture. "Actionable" means a control that records something a person decides
// or types — not the chrome every step carries (the channel tabs, Copy, Defer,
// Doesn't apply here, Scan to update the plan), and not a disclosure.
//
// Read-only: it runs the same producers the screen runs and counts what they
// project. Nothing here judges; the judging is the owner's.
//
//   node scripts/actionable-dump.mjs
import fs from 'node:fs'
import { fixture } from '../src/roadmap/fixtures/index.ts'
import { SNAPSHOT_FIXTURES } from '../src/testing/stepSnapshots.ts'
import { runFixture } from '../src/roadmap/fixtures/run.ts'
import { stepBodyOf } from '../src/ui/surfaces/stepBody.ts'
import { contentStepFor } from '../src/content/stepTitle.ts'
import { usesDecisionAnatomy } from '../src/roadmap/stepGroups.ts'
import { ANSWERED_IN } from '../src/roadmap/direction.ts'

const byStep = new Map()
for (const name of SNAPSHOT_FIXTURES) {
  const f = fixture(name)
  const r = runFixture(f)
  for (const step of r.steps) {
    const ctx = {
      snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names?.label(id) ?? id,
      signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups,
      reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
    }
    let body
    try { body = stepBodyOf(step, ctx) } catch { continue }
    const cs = contentStepFor(step) ?? {}
    const d = cs.decision ?? null
    const panels = []
    if (usesDecisionAnatomy(step.id)) panels.push({ kind: 'direction-questions', entries: (step.directionQuestions ?? []).length })
    if (ANSWERED_IN[step.id]) panels.push({ kind: 'answered-elsewhere', entries: 0 })
    else if (step.dormantChoices?.length) panels.push({ kind: 'per-account-dropdowns', entries: step.dormantChoices.length })
    else if (body.decides && d) {
      const opts = Array.isArray(d.options) ? d.options.length : 0
      panels.push({ kind: 'decision', entries: opts, picker: !!(d.pickerSource || d.pickerRow || d.multi), question: !!d.question, strict: !!d.strict })
    }
    if (step.manualReview) panels.push({ kind: 'workflow-check-form', entries: (step.manualReview.fields ?? []).length })
    if (step.id === 's-prereq-passkey-settings') panels.push({ kind: 'aaguid-adder', entries: 0 })
    const confirms = [...(body.readiness?.tiles ?? []), ...(body.readiness?.satisfied ?? [])].filter((t) => t.confirm !== undefined)
    if (confirms.length) panels.push({ kind: 'tile-confirm', entries: confirms.length })
    if (panels.length === 0) continue
    const prev = byStep.get(step.id) ?? { step: step.id, title: body.title, kind: cs.kind ?? null, fixtures: [], panels: [] }
    prev.fixtures.push(name)
    for (const p of panels) if (!prev.panels.some((q) => q.kind === p.kind && q.entries === p.entries)) prev.panels.push(p)
    byStep.set(step.id, prev)
  }
}
const rows = [...byStep.values()].sort((a, b) => a.step.localeCompare(b.step))
fs.writeFileSync('docs/qa/actionable-dump.json', JSON.stringify(rows, null, 1) + '\n')
console.log(`${rows.length} steps draw an actionable panel`)
for (const r of rows) console.log(`${r.step.padEnd(36)} ${String(r.kind).padEnd(9)} ${r.panels.map((p) => `${p.kind}(${p.entries})`).join(' + ')}`)
