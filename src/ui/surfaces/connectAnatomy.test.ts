// Task 032 — the approved Connect anatomy, restored.
//
// The question this file answers is the one green tests could not answer
// before: does production Connect have the SHAPE the owner approved, using real
// product state rather than the mockup's? So every assertion is two-sided. It
// reads `docs/design/approved/anatomy/connect-v3.html` at test time and fails if the
// pack stops drawing the thing production claims to have restored; and it reads
// production and fails if production stops drawing it.
//
// What this file does not re-prove, because one authority already owns it: the
// canonical hashes and bytes (src/ui/design-authority.test.ts); the token
// system and AA (src/ui/tokens.test.ts); focus, forced colours and reduced
// motion (src/ui/accessibility.test.ts); shared-vs-surface primitives
// (src/ui/primitives.test.ts); the four stages' words and button weights
// (src/ui/scan/connectView.test.ts); the stage order and the routing
// (src/ui/surfaces/publicTrust.test.ts); the demo's isolation
// (src/ui/demo.test.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { connectStatus, scanTile } from '../scan/connectView.ts'
import type { ScanInput, Tone } from '../scan/connectView.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const PACK = 'docs/design/approved/anatomy/connect-v3.html'
const CONNECT = read('src/ui/surfaces/Connect.tsx')
const CSS = read('src/ui/app.css')

// ------------------------------------------------ the status strip is a projection

test('the status strip says one of two things, and both come from the stages themselves', () => {
  assert.match(read(PACK), /\.status-bar\s*\{/, 'the pack no longer draws a status strip')
  const stage = (title: string, state: string, tone: Tone = null) => ({ title, state, tone })
  const four = [stage('Sign in', 'no tenant connected'), stage('Baseline', 'selected', 'done'), stage('Scan', 'not started'), stage('Plan', 'after the scan')]

  // Nothing left to do: the one place Connect says it is ready to plan.
  const ready = connectStatus([true, true, true, true], four)
  assert.equal(ready.title, 'Ready to plan')
  assert.equal(ready.tone, 'done')

  // Otherwise the strip IS the current stage — its title, its own state line,
  // its tone. It reads nothing the step beside it does not already say.
  for (const [i, done] of [[0, [false, false, false, false]], [1, [true, false, false, false]], [2, [true, true, false, false]], [3, [true, true, true, false]]] as const) {
    const s = connectStatus(done, four)
    assert.equal(s.title, `Next: ${four[i].title}`, `stage ${i} is the one with the next action`)
    assert.equal(s.text, four[i].state, `stage ${i}'s quiet line is that stage's own state`)
    assert.equal(s.tone, four[i].tone, `stage ${i}'s indicator is that stage's own tone`)
  }
  // The strip's meaning is a word, and its dot is decoration.
  assert.match(CONNECT, /<span className=\{`dot\$\{status\.tone \? ` \$\{status\.tone\}` : ''\}`\} aria-hidden="true" \/>/, 'the status dot is not marked decorative')
  assert.match(CONNECT, /<strong>\{status\.title\}<\/strong>/, 'the strip carries no state title in words')
})

// ------------------------------------------------ real state, not filler

test('the scan step draws its counts only when a real scan produced them', () => {
  assert.match(read(PACK), /class="meta"/, 'the pack no longer draws a scan meta row')
  const at = '2026-09-08T00:00:00Z'
  assert.equal(scanTile({ kind: 'complete', at }).meta, undefined, 'the scan step invented counts with nothing behind them')
  assert.equal(scanTile({ kind: 'complete', at, counts: null }).meta, undefined, 'the scan step drew a count row before the plan computed')
  const meta = scanTile({ kind: 'complete', at, counts: { people: 18, policies: 38, steps: 27 } }).meta
  assert.deepEqual(meta, [
    { value: '18', label: 'active people' },
    { value: '38', label: 'baseline policies' },
    { value: '27', label: 'plan steps' },
  ])
  // No other scan state fills the row: an incomplete scan must never read as complete.
  const others: ScanInput[] = [{ kind: 'ready' }, { kind: 'sample' }, { kind: 'scanning', lane: 'people', elapsed: '8s' }, { kind: 'gaps', gaps: [{ source: 'policies' }], unread: [{ source: 'policies', partial: false, refused: false }], lastScan: null }]
  for (const input of others) {
    assert.equal(scanTile(input).meta, undefined, `the ${input.kind} scan state carries counts`)
  }
  // The counts are read from the one authority for each, never computed here.
  assert.match(CONNECT, /import \{ facts, stepFacts \} from '\.\.\/\.\.\/derive\/facts\.ts'/, 'Connect no longer reads its counts from derive/facts.ts')
  assert.match(CONNECT, /people: facts\(snapshot, mapping\)\.active/, 'the active-people count is not the one denominator')
  assert.match(CONNECT, /steps: steps\.steps/, 'the step count is not the one the Plan header shows')
})

// ------------------------------------------------ accessibility

test('no state on Connect is carried by colour alone', () => {
  // Every tone the step can take is set beside a word: the state line, or the
  // Next marker on the current step.
  assert.match(CONNECT, /\{stage === 'current' && <span className="next">\{W\.next\}<\/span>\}/, 'the current step carries no word marker')
  // And the marker is beside the heading, not inside it. A heading carries the
  // step's title and its state and nothing else: a marker within the h2 joins
  // the heading's own text, so the step reads "Scan not started Next" to a
  // screen reader and to anything that reads the heading (the walk read exactly
  // that on five fixtures after task 032's rebuild).
  const heads = CONNECT.match(/<h2[^>]*>[\s\S]*?<\/h2>/g) ?? []
  assert.ok(heads.length > 0, 'Connect renders no headings')
  for (const h of heads) assert.equal(h.includes('className="next"'), false, `a heading carries the Next marker in its own text: ${h}`)
  assert.match(CONNECT, /<div className="connect-step-head">/, 'the step heading and its marker no longer share a row')
  assert.ok(CSS.includes('.connect-step-head'), 'the step heading row is not drawn')
  assert.match(CONNECT, /<span className=\{`state\$\{stateTone \? ` \$\{stateTone\}` : ''\}`\}>\{state\}<\/span>/, 'the step state is not rendered as a word')
  // The numbered badge's colour classes exist only alongside those words.
  for (const cls of ['.connect-step.done .n', '.connect-step.stop .n', '.connect-step.wait .n']) {
    assert.ok(CSS.includes(cls), `${cls} is gone; the step badge no longer carries its state`)
  }
  // Native disclosure semantics, not a div that opens.
  assert.match(CONNECT, /<details>/, 'a Connect disclosure stopped being a native details element')
  // Locked means disabled, not faded: the baseline picker is held while a scan
  // runs by the control's own disabled state.
  assert.match(CONNECT, /disabled=\{locked\}/, 'the held baseline control is no longer programmatically disabled')
  // And a step ahead of the current one is not dimmed, because production's
  // steps ahead stay usable — the pack's `.locked{opacity:.55}` is a state
  // production does not have.
  assert.equal(/\.connect-step\.ahead[^{]*\{[^}]*opacity/.test(CSS), false, 'a live step is dimmed with opacity')
})
