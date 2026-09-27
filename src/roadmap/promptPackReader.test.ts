// The prompt pack is the implementer's (owner, 2026-09-27; F-077, F-129): the
// manager's document is the printed briefing, so no prompt summarises the plan
// for a business owner, and no step reaches the implementer's prompt cut off
// mid-instruction.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { setDisplayTimeZone } from '../copy/dates.ts'
import { PROMPTS } from '../copy/comms.ts'
import { cleanupExportViews } from '../ui/surfaces/cleanupExport.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import type { Step } from './types.ts'
import { clipWhole, PROMPT_BLOCK_MAX, promptPack, stepContext } from './prompts.ts'

test('a long block stops after its last whole instruction, and says the rest is in the Plan', () => {
  const instructions = Array.from({ length: 80 }, (_, i) => `${i + 1}. Open the portal and select item number ${i + 1} before saving it`).join(' | ')
  assert.ok(instructions.length > PROMPT_BLOCK_MAX)
  const cut = clipWhole(instructions)
  assert.ok(cut.endsWith(PROMPTS.truncated))
  const kept = cut.slice(0, -PROMPTS.truncated.length)
  assert.ok(instructions.startsWith(kept))
  assert.match(instructions.slice(kept.length), /^ \| \d+\. /, 'the cut fell inside an instruction')
  assert.match(PROMPTS.truncated, /the rest is in the Plan/)
  // A body with no break in reach is still bounded where it must be.
  const solid = 'A'.repeat(PROMPT_BLOCK_MAX + 500)
  assert.equal(clipWhole(solid), 'A'.repeat(PROMPT_BLOCK_MAX) + PROMPTS.truncated)
  assert.equal(clipWhole('short'), 'short')
})

test('on the demo the pack has no business-owner prompt, and every long step reaches Explain this plan whole to its last instruction', () => {
  setDisplayTimeZone('UTC')
  try {
    const f = fixture('demo')
    const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
    const ctx = (s: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[s.id] ?? null, naming: r.coverage.organisation.naming })
    const view = (s: Step) => stepExportView(s, ctx(s))
    const pack = promptPack({ view, tenant: 'Contoso', steps: r.steps, schedule: r.schedule, changeRecord: '', announcement: null, cleanup: cleanupExportViews(r.schedule.cleanup) })
    assert.deepEqual(pack.map((p) => p.title), ['Explain this plan'])
    assert.ok(pack.every((p) => !/business owner/i.test(p.prompt)), 'a prompt still writes for the business owner')
    const explain = pack[0].prompt
    const long = r.steps.filter((s) => stepContext(s, view).length > PROMPT_BLOCK_MAX)
    assert.ok(long.length >= 3, 'the demo has fewer long steps than this checks')
    for (const s of long) {
      const body = stepContext(s, view)
      const kept = clipWhole(body).slice(0, -PROMPTS.truncated.length)
      assert.ok(explain.includes(kept + PROMPTS.truncated), `${view(s).title} is not in the prompt as cut`)
      assert.match(body.slice(kept.length), /^(\n| \| )/, `${view(s).title} is cut mid-instruction`)
    }
  } finally {
    setDisplayTimeZone(null)
  }
})
