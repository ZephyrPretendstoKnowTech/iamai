// C13: every "what could go wrong" entry is one risk, one piece of tenant
// evidence, and one source.
//
// The review found two malformed entries: a colon splicing two unrelated facts,
// and evidence attached to the wrong risk. Neither is catchable by reading the
// templates, because both only appear once a real tenant fills them in — so the
// check runs over generated plans.
import assert from 'node:assert/strict'
import test from 'node:test'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'

test('every failure mode is one risk, one piece of evidence, one source', () => {
  for (const f of allFixtures()) {
    const run = runFixture(f)
    for (const step of run.steps) {
      for (const m of step.failureModes) {
        const where = `${f.name}/${step.id}: "${m.title}"`
        assert.ok(m.title.trim().length > 0, `${where}: no risk named`)
        assert.ok(!m.title.includes(':'), `${where}: the risk is spliced with a colon`)
        assert.ok(m.evidence.trim().length > 0, `${where}: no tenant evidence`)
        // One consequence at most, introduced by one colon. Two colons is two
        // unrelated facts wearing one sentence.
        assert.ok((m.evidence.match(/:/g) ?? []).length <= 1, `${where}: evidence splices two facts — ${m.evidence}`)
        assert.ok(m.citation, `${where}: no source`)
      }
    }
  }
})

test('a risk never applies on evidence that says there is nothing to check', () => {
  // The other half of C13: evidence attached to the wrong risk.
  //
  // The first attempt required a number in the evidence. That was wrong: plenty
  // of tenant facts are qualitative ("Temporary Access Pass is not enabled",
  // "no trusted location is confirmed") and rejecting them would push real
  // evidence out to make a test pass.
  //
  // Deliberately not "no two risks share evidence". One tenant fact genuinely
  // bears on several risks at once: 22 people meeting a new prompt cadence is
  // the evidence both for losing unsaved work and for a mis-scoped rule, and a
  // test that forbade that would only teach people to reword one of them.
  for (const f of allFixtures()) {
    const run = runFixture(f)
    for (const step of run.steps) {
      for (const m of step.failureModes.filter((x) => x.applies === 'yes')) {
        const where = `${f.name}/${step.id}: "${m.title}"`
        // A risk cannot both apply and be unjudgeable. Evidence saying there
        // is nothing to check means the entry is unknown, not yes — which is
        // how a risk comes to carry evidence that is not about it.
        assert.doesNotMatch(
          m.evidence,
          /^(no sign-in records|no records|not enough)/i,
          `${where}: applies is "yes" on evidence that says there is nothing to check — ${m.evidence}`,
        )
      }
    }
  }
})
