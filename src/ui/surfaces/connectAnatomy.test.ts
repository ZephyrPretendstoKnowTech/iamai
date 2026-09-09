// Task 032 — the approved Connect anatomy, restored.
//
// The question this file answers is the one green tests could not answer
// before: does production Connect have the SHAPE the owner approved, using real
// product state rather than the mockup's? So every assertion is two-sided. It
// reads `docs/design/approved/connect-v3.html` at test time and fails if the
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
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { pages } from '../../content/content.ts'
import { baselineTile, connectStatus, planTile, scanTile } from '../scan/connectView.ts'
import type { ScanInput, Tone } from '../scan/connectView.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const PACK = 'docs/design/approved/connect-v3.html'
const CONNECT = read('src/ui/surfaces/Connect.tsx')
const CSS = read('src/ui/app.css')
const stepsFor = (): string[] => []

// The precondition for every assertion below: the bytes this file reads are the
// owner-approved bytes. src/ui/design-authority.test.ts owns the hash contract
// across all four packs and against the committed git blob; this is only the
// guarantee that THIS file's evidence came from the approved file.
test('the Connect pack this file reads is the approved one, byte for byte', () => {
  const manifest = JSON.parse(read('docs/design/approved/manifest.json')) as { surfaces: { surface: string; path: string; sha256: string }[] }
  const record = manifest.surfaces.find((s) => s.surface === 'connect')
  assert.ok(record, 'the manifest records a Connect surface')
  assert.equal(record.path, PACK)
  assert.equal(createHash('sha256').update(readFileSync(PACK)).digest('hex'), record.sha256, 'the canonical Connect pack changed')
})

// ------------------------------------------------ the anatomy, both sides

test('the pack draws one contiguous flow and a separate destination, and so does production', () => {
  const pack = read(PACK)
  // The pack: one `.flow` panel whose `.step` is a three-zone grid, and a
  // `.ready` destination panel that is NOT inside it.
  assert.match(pack, /\.flow\s*\{[^}]*border-radius/, 'the pack no longer draws a flow panel')
  assert.match(pack, /\.step\s*\{[^}]*grid-template-columns:\s*46px minmax\(0,1fr\) auto/, "the pack's step is no longer a three-zone row")
  assert.match(pack, /\.ready\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\) auto/, 'the pack no longer draws a separate ready destination')
  assert.ok(pack.indexOf('</section>\n\n    <section class="ready"') > 0 || /<\/section>\s*<section class="ready"/.test(pack), 'the pack no longer puts the destination outside the flow')

  // Production: the same three shapes, on its own selectors.
  assert.match(CONNECT, /<div className="connect-flow row-group">/, 'production draws no flow container')
  assert.match(CSS, /\.connect-step \{[^}]*grid-template-columns: 46px minmax\(0, 1fr\) auto;/, "production's step is not the pack's three-zone row")
  assert.match(CSS, /\.connect-destination \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto;/, 'production draws no destination panel')
  // The steps sit on the one flow panel. A step that took a background and a
  // border of its own would be the card stack this task replaced.
  const stepRule = CSS.slice(CSS.indexOf('.connect-step {'), CSS.indexOf('.connect-step .n {'))
  assert.doesNotMatch(stepRule, /background|border(?!-)/, 'a flow step gained a box of its own; the flow is one panel')
  // The legacy composition is gone from the product, not merely unused. The
  // comments are stripped: the history of what this replaced is allowed to be
  // written down, a rule that still draws it is not.
  assert.equal(CSS.replace(/\/\*[\s\S]*?\*\//g, '').includes('.step-tile'), false, 'the legacy independent-card rules are still in app.css')
  assert.equal(CONNECT.includes('step-tile'), false, 'Connect still renders the legacy card class')
})

test('the action zone is the step\'s third track, and no action is stacked under the copy', () => {
  assert.match(read(PACK), /\.actions\s*\{[^}]*justify-content:flex-end/, 'the pack no longer right-aligns a step action')
  // Every step's buttons go through the Step component's action slot.
  assert.match(CONNECT, /<div className="connect-step-actions">\{actions\}<\/div>/, 'the step has no action zone')
  const body = CONNECT.slice(CONNECT.indexOf('function SignedOut('), CONNECT.indexOf('function useAuthorUpdate('))
  assert.equal(/className="actions"/.test(body), false, 'a step still stacks its buttons under its copy')
  // An empty zone collapses rather than holding the row open.
  assert.match(CSS, /\.connect-step-actions:empty \{\s*display: none;/, 'an actionless step still reserves its action zone')
})

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

test('the mockup-only state switch did not ship', () => {
  // The pack carries a two-button switch so the owner could see both states.
  // It is scaffolding, and production has no authorized equivalent.
  assert.match(read(PACK), /class="state-switch"/, "the pack's state switch is gone, so this guard has nothing to guard against")
  for (const [name, src] of [['Connect.tsx', CONNECT], ['app.css', CSS]] as const) {
    assert.equal(/state-switch|Mockup state|signedOutBtn|readyBtn/.test(src), false, `${name} shipped the design pack's mockup state control`)
  }
})

// ------------------------------------------------ real state, not filler

test('the Plan destination is tinted only when the plan is really ready, and offers no way on before then', () => {
  // The tint is a modifier the ready state sets, not the panel.
  assert.match(CONNECT, /const ready = tile\.kind === 'ready'/, 'the destination decides its treatment from something other than the plan state')
  assert.match(CONNECT, /`connect-destination\$\{ready \? ' ready' : ''\}`/, 'the ready treatment is not gated on the ready state')
  assert.match(CSS, /\.connect-destination\.ready \{/, 'the ready treatment is not a modifier')
  const base = CSS.slice(CSS.indexOf('.connect-destination {'), CSS.indexOf('.connect-destination.ready {'))
  assert.doesNotMatch(base, /--accent-soft|var\(--accent\)/, 'the plain destination already carries the ready panel’s brand tint')

  // And the gate itself is the plan's, unchanged: only the ready state offers a
  // way into the plan, and the waiting state offers nothing at all.
  assert.deepEqual(planTile({ kind: 'waiting' }).actions, [], 'the waiting destination offers a way into the plan')
  assert.deepEqual(planTile({ kind: 'ready', at: '2026-09-08T00:00:00Z', counts: null }).actions.map((a) => a.label), ['Open the plan →'])
  assert.equal(planTile({ kind: 'last', at: '2026-09-02T00:00:00Z' }).actions.some((a) => a.label === 'Open the plan →'), false, 'a scan with gaps offers the plan as though it were fresh')
})

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
  const others: ScanInput[] = [{ kind: 'ready' }, { kind: 'sample' }, { kind: 'scanning', lane: 'people', elapsed: '8s' }, { kind: 'gaps', unread: ['policies'], lastScan: null }]
  for (const input of others) {
    assert.equal(scanTile(input).meta, undefined, `the ${input.kind} scan state carries counts`)
  }
  // The counts are read from the one authority for each, never computed here.
  assert.match(CONNECT, /import \{ facts, stepFacts \} from '\.\.\/\.\.\/derive\/facts\.ts'/, 'Connect no longer reads its counts from derive/facts.ts')
  assert.match(CONNECT, /people: facts\(snapshot, mapping\)\.active/, 'the active-people count is not the one denominator')
  assert.match(CONNECT, /steps: steps\.steps/, 'the step count is not the one the Plan header shows')
})

test('the baseline card carries the loaded package and invents no credential', () => {
  assert.match(read(PACK), /class="baseline-card"/, 'the pack no longer nests a baseline card')
  const t = baselineTile({ name: 'Jon Hope — Defense in Depth', policyCount: 38, loading: null, update: null, stepsFor })
  // Every value on the card is the package's own.
  assert.equal(t.card?.name, 'Jon Hope — Defense in Depth')
  assert.equal(t.card?.source, '38 policies · pinned version')
  // The pack draws a credential pill beside the name. Production leaves it
  // unfilled: a credential badge is a claim, and the one credential IAMAI
  // states belongs to the author of ONE package rather than to the region.
  assert.equal(/class(Name)?="cred"|Microsoft MVP/.test(CONNECT), false, 'Connect renders a credential badge')
  assert.equal(CSS.includes('.cred'), false, 'app.css draws a credential badge')
  // Nothing anywhere in Connect's words asserts a verification, a release state
  // or an endorsement, and no generated attribution or tagline was introduced.
  const words = JSON.stringify(pages.connect)
  for (const claim of ['Built by Jon Hope', 'verified', 'Verified', 'certified', 'Certified', 'endorsed', 'official release', 'v1.0']) {
    assert.equal(words.includes(claim), false, `Connect's words claim "${claim}"`)
  }
  assert.equal(/Built by |tagline/.test(CONNECT), false, 'Connect renders a generated attribution or tagline')
})

// ------------------------------------------------ accessibility and responsive

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

test('Connect takes its own pack’s display size and its own breakpoint', () => {
  const pack = read(PACK)
  assert.match(pack, /h1\{font:700 40px/, "the pack's h1 is no longer 40px")
  assert.match(pack, /@media\(max-width:760px\)\{[\s\S]*?h1\{font-size:33px\}/, "the pack's narrow h1 is no longer 33px")
  assert.match(CSS, /\.surface\.connect h1 \{\s*--display-size: var\(--d-3\);/, 'Connect does not read its pack’s display size')
  const narrow = CSS.slice(CSS.indexOf('@media (max-width: 760px) {'))
  assert.match(narrow, /--display-size: var\(--d-7\);/, 'Connect does not reduce its heading at the pack’s breakpoint')
  // The pack's narrow step: two zones, the action moving under the copy in the
  // content column rather than detaching from its step.
  assert.match(pack, /@media\(max-width:760px\)\{[\s\S]*?\.step\{grid-template-columns:36px 1fr\}/, "the pack's narrow step is no longer two zones")
  assert.match(narrow, /\.connect-step \{\s*grid-template-columns: 36px minmax\(0, 1fr\);/, 'production keeps three zones at the narrow width')
  assert.match(narrow, /\.connect-step-actions \{\s*grid-column: 2;/, 'the action detaches from its step at the narrow width')
  assert.match(narrow, /\.connect-destination \{\s*grid-template-columns: minmax\(0, 1fr\);/, 'the destination does not become one column')
  // Connect adds no navigation of its own; the header's collapse stays the shell's.
  assert.equal(/header\.app/.test(narrow.slice(0, narrow.indexOf('\n}\n'))), false, 'Connect restyles the shared header at its own breakpoint')
})

test('Demo renders the production Connect surface, not one of its own', () => {
  // One Connect surface module in the product, and the demo reaches it through
  // the same route the real tenant does.
  const app = read('src/ui/App.tsx')
  assert.match(app, /<Connect\b/, 'App no longer renders the Connect surface')
  assert.equal(/DemoConnect|ConnectDemo/.test(app + CONNECT + CSS), false, 'a Demo-only Connect surface exists')
  // The demo's difference is its DATA and its two Microsoft actions, both
  // decided inside the one component.
  assert.match(CONNECT, /isDemo\(\) \? sampleTile\(/, 'the demo no longer reuses the production account step')
  assert.equal(/connect-flow|connect-step|connect-destination/.test(read('src/ui/demoMode.ts')), false, 'demo mode draws Connect anatomy of its own')
})
