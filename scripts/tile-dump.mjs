// Every Tasks Remaining card the product can draw, as it draws it, for the V1
// audit's pass 1 (docs/plans/v1-audit-plan.md section 1). Read-only: it renders
// each fixture's plan through the same producers the screen uses
// (ui/surfaces/stepBody.ts, policyTasks.ts, emergencyReadiness.ts) and prints
// the card's parts. Nothing is composed here, and no judgement is made.
//
//   node scripts/tile-dump.mjs            -> docs/qa/tile-dump.json
//   node scripts/tile-dump.mjs --text     -> the same, as readable lines
import fs from 'node:fs'
import path from 'node:path'
import { fixture } from '../src/roadmap/fixtures/index.ts'
import { SNAPSHOT_FIXTURES } from '../src/testing/stepSnapshots.ts'
import { runFixture } from '../src/roadmap/fixtures/run.ts'
import { stepBodyOf } from '../src/ui/surfaces/stepBody.ts'
import { cardWordsOf, drawsTaskAnatomy, policyBarOf, policySubjectsOf, taskSubjectOf } from '../src/ui/surfaces/policyTasks.ts'
import { emergencySubjectsOf } from '../src/ui/surfaces/emergencyReadiness.ts'

const NAMES = SNAPSHOT_FIXTURES
const out = []
for (const name of NAMES) {
  const f = fixture(name)
  const r = runFixture(f)
  for (const step of r.steps) {
    const ctx = {
      snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names?.label(id) ?? id,
      signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups,
      reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
    }
    let body
    try { body = stepBodyOf(step, ctx) } catch (e) { out.push({ fixture: name, step: step.id, error: String(e) }); continue }
    const own = drawsTaskAnatomy(step.id)
    const cards = own
      ? policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks, taskSubjectOf(step, body.eyebrow, body.title), cardWordsOf(step)?.check ?? null)
      : body.emergencyAccountTasks?.accounts ?? emergencySubjectsOf(body.readiness, body.emergencyAccountTasks)
    out.push({
      fixture: name,
      step: step.id,
      title: body.title,
      eyebrow: body.eyebrow,
      lane: body.laneView?.lane ?? null,
      substatus: body.laneView?.substatus ?? null,
      state: `${body.contract.state.word}${body.contract.state.stage ? ` / ${body.contract.state.stage}` : ''}`,
      bar: own ? policyBarOf(cards) : body.readiness.bar.main,
      tasks: (body.emergencyAccountTasks?.tasks ?? []).map((t) => t.title),
      cards: cards.map((c) => ({
        key: c.key,
        subject: c.heading,
        of: c.upn ?? null,
        remaining: c.remainingCount ?? null,
        check: c.title,
        says: c.detail ?? '',
        action: c.instruction ?? '',
        link: c.link?.label ?? null,
        completed: c.completed,
        satisfied: c.satisfied,
      })),
    })
  }
}

const dir = 'docs/qa'
fs.mkdirSync(dir, { recursive: true })
if (process.argv.includes('--text')) {
  const lines = []
  for (const row of out) {
    if (row.error) { lines.push(`## ${row.fixture} / ${row.step} — ERROR ${row.error}`); continue }
    lines.push(`## ${row.fixture} / ${row.step} — ${row.title}`)
    lines.push(`   eyebrow: ${row.eyebrow} | lane: ${row.lane} · ${row.substatus} | state: ${row.state}`)
    lines.push(`   bar: ${row.bar}`)
    lines.push(`   tasks: ${row.tasks.join(' | ') || '(none)'}`)
    for (const c of row.cards) {
      lines.push(`   - [${c.satisfied ? 'satisfied' : 'open'}] ${c.subject}${c.of ? ` (${c.of.replace(/\n/g, ', ')})` : ''}`)
      lines.push(`     remaining: ${c.remaining ?? '-'} | check: ${c.check}`)
      if (c.says) lines.push(`     says: ${c.says}`)
      if (c.action) lines.push(`     action: ${c.action}`)
      if (c.link) lines.push(`     link: ${c.link}`)
      if (c.completed.length) lines.push(`     completed: ${c.completed.join(' ; ')}`)
    }
    lines.push('')
  }
  fs.writeFileSync(path.join(dir, 'tile-dump.txt'), lines.join('\n'))
  console.log(`${out.length} steps -> ${dir}/tile-dump.txt`)
} else {
  fs.writeFileSync(path.join(dir, 'tile-dump.json'), JSON.stringify(out, null, 1) + '\n')
  console.log(`${out.length} steps -> ${dir}/tile-dump.json`)
}
