// MFA method guidance, content deduplication, and the action a person is offered
// (task 014; Step 7).
//
// Two things are being protected here.
//
// One source. The passkey, security-key, Windows Hello and Temporary Access
// Pass instructions are written once, in shared.methodGuides, and read through
// content/methodGuides.ts by the text the help desk copies, by the campaign
// step's What-to-do and by the campaign email. Four hand-written versions of the
// same flow is the failure this file exists to catch, so the assertions are on
// the shared keys and the material actions, not on the prose word for word.
//
// One evidence authority. What a person is asked to do follows their readiness
// (scoring/phishingResistant.ts, worded by surfaces/readinessCells.ts) and
// nothing else: somebody with a qualifying method is asked to prove it, never
// to register another; somebody whose evidence could not be read is asked to
// scan again; somebody Ready with Windows Hello is only recommended a passkey;
// and no guidance moves a state, a proof, a count or an emergency-access
// classification.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import type { ReadinessState } from '../../scoring/phishingResistant.ts'
import { classOfKind } from '../../scoring/phishingResistant.ts'
import { content, shared } from '../../content/content.ts'
import { fillText, whole } from '../../content/render.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { GUIDE_POINTER, METHOD_GUIDES, PASSKEY_TARGET, TENANT_PREREQUISITE, USER_INSTRUCTION, guideText, methodGuide, reachesTarget } from '../../content/methodGuides.ts'
import type { MethodGuideId } from '../../content/methodGuides.ts'
import { actionOf, detailOf, methodsCell } from './readinessCells.ts'
import { copyBoxes, stepLines } from './stepExport.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

const TENANTS: FixtureName[] = ['demo', 'getiamai', 'mid', 'messy', 'hostile']
const CAMPAIGN = 's-verify-mfa'
const MG = (shared as Record<string, unknown>).methodGuides as {
  target: string
  prereq: string
  pointer: string
  userInstruction: string
  guest: string
  common: Record<string, string>
  guides: { id: string; title: string; steps: string[]; then?: string[]; learn: { url: string } }[]
}

const ctxFor = (name: FixtureName): StepVarContext => {
  const f = fixture(name)
  const r = runFixture(f)
  return { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start) }
}
const campaignOf = (name: FixtureName) => runFixture(fixture(name)).steps.find((s) => s.id === CAMPAIGN)!
const SURFACE = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')

// ---- A. one content source ----------------------------------------------------

test('every guide resolves from the content file, and a line two guides share is written once', () => {
  assert.ok(METHOD_GUIDES.length >= 6, 'the five method guides and the proof guide')
  for (const g of METHOD_GUIDES) {
    assert.ok(g.lines.length > 0, `${g.id}: has instructions`)
    for (const l of g.lines) {
      assert.ok(l.trim().length > 0, `${g.id}: no empty line`)
      // A "@key" reference resolved to a real shared line rather than rendering raw.
      assert.doesNotMatch(l, /^@/, `${g.id}: an unresolved shared reference reached the guide`)
      assert.doesNotMatch(l, /\{[a-zA-Z0-9_:]+\}/, `${g.id}: no unfilled variable in guidance`)
    }
  }
  // The one line the two Authenticator platforms share is the same string, not
  // two copies of it: change it once and both guides change.
  const shared_ = MG.common.addPasskey
  assert.ok(shared_ && shared_.length > 20)
  for (const id of ['authenticator-iphone', 'authenticator-android'] as MethodGuideId[]) {
    assert.ok(methodGuide(id).lines.includes(shared_), `${id}: uses the shared "add sign-in method" line`)
    const raw = MG.guides.find((g) => g.id === id)!
    assert.ok(raw.steps.includes('@addPasskey'), `${id}: the content file references the shared line rather than repeating it`)
  }
  // And the closing pair, on every guide that ends by using the method.
  for (const id of ['authenticator-iphone', 'authenticator-android', 'security-key', 'temporary-access-pass', 'prove'] as MethodGuideId[]) {
    const lines = methodGuide(id).lines
    assert.ok(lines.includes(MG.common.useIt), `${id}: ends by using the method`)
    assert.ok(lines.includes(MG.common.scanAgain), `${id}: and by scanning again`)
  }
})

test('the help-desk text is the guidance, not a second version of it', () => {
  for (const g of METHOD_GUIDES) {
    const text = guideText(g.id)
    assert.ok(text.includes(g.title), `${g.id}: the copy names the method`)
    for (const l of g.lines) assert.ok(text.includes(l), `${g.id}: the copy carries the guide's line`)
    assert.ok(text.includes(g.learn.url), `${g.id}: and the Microsoft page`)
    // Nothing about a person travels with it: the operator hands somebody the
    // steps, never a name from the table.
    assert.doesNotMatch(text, /@[a-z0-9.-]+\.[a-z]{2,}/i, `${g.id}: no address in the copied guidance`)
  }
})

test('the Plan and the campaign email reference the shared lines rather than repeating them', () => {
  const cs = content.steps.find((s) => s.id === CAMPAIGN) as Record<string, any>
  const steps = (cs.whatToDo.steps ?? []) as string[]
  assert.ok(steps.includes('{methodGuidePointer}'), 'the Plan step references the one pointer')
  const comms = cs.comms as Record<string, string>
  for (const key of ['body', 'bodyMfaInPlace']) {
    assert.ok(comms[key].includes('{registerPasskeyLine}'), `comms.${key}: references the one end-user sentence`)
  }
  // Rendered, both come out as the shared line itself. On a tenant whose plan
  // dates the enforcement the email warns of: the demo's is held
  // (roadmap/holds.ts), and an email with no day to name is not written.
  const ctx = ctxFor('mid')
  const step = campaignOf('mid')
  const lines = stepLines(step, ctx)
  assert.ok(lines.includes(GUIDE_POINTER), 'the Plan step renders the pointer')
  assert.ok(lines.some((l) => l.includes(USER_INSTRUCTION)), 'the email renders the shared end-user sentence')
  const box = copyBoxes(step, ctx).find((b) => b.kind === 'comms')!
  assert.ok(box.text.includes(USER_INSTRUCTION), 'and the copy box carries the same sentence')
})

// ---- B. the action follows the evidence ---------------------------------------

test('the action a person is offered follows their readiness, the detail agrees with it, and nothing else decides it', () => {
  const seen = new Set<ReadinessState>()
  for (const name of TENANTS) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    for (const row of v.rows) {
      const a = actionOf(row)
      const where = `${name}/${row.user.id}`
      if (row.state === null) {
        assert.equal(a, null, `${where}: an account the page does not count is asked for nothing`)
        continue
      }
      seen.add(row.state)
      const rd = row.readiness!
      const d = detailOf(row)!
      if (row.state === 'ready') {
        assert.ok(rd.qualifying.length > 0 && rd.proof.length > 0, `${where}: Ready holds a qualifying method and its proof`)
        if (rd.hasPasskey) assert.equal(a, null, `${where}: nothing to do`)
        else assert.deepEqual([a?.text, a?.recommended], ['Add passkey', true], `${where}: a passkey is only recommended`)
        assert.equal(d.next[0], 'No baseline action.', `${where}: the baseline asks for nothing`)
      } else if (row.state === 'needsProof') {
        // A qualifying method is registered. The action is to prove it, never to register another one.
        assert.ok(rd.qualifying.length > 0, `${where}: the method is registered`)
        assert.notEqual(a?.text, 'Set up passkey', `${where}: prove, not register`)
        if (rd.missing.length > 0) {
          assert.equal(a?.text, `Test ${rd.missing[0]}`, `${where}: test the platform in use`)
          // The detail's Next is the same action as the row's, with or without proof elsewhere.
          assert.match(d.next[0], new RegExp(`from ${rd.missing[0]}`), `${where}: the detail's Next disagrees with the row ("${d.next[0]}")`)
        } else {
          assert.match(a?.text ?? '', /^Sign in with /, `${where}: use it once`)
          assert.match(d.next[0], /^Sign in once with /, `${where}: the detail's Next disagrees with the row`)
        }
      } else if (row.state === 'needsSetup') {
        assert.equal(rd.qualifying.length, 0, `${where}: no qualifying method`)
        assert.match(a?.text ?? '', /^(Set up passkey|Restore )/, `${where}: set up, or restore what disappeared`)
      } else {
        // The evidence could not be read: no setup path is guessed at; the action is to read it.
        assert.equal(a?.text, 'Retry scan', `${where}: unknown stays unknown`)
        assert.equal(d.rescan, true)
      }
    }
  }
  assert.deepEqual([...seen].sort(), ['needsProof', 'needsSetup', 'ready', 'unknown'], 'the sweep saw all four states')
})

test('a qualifying method with platforms in use and no proof anywhere is asked to test a platform, in the row and in the detail', () => {
  let seen = 0
  for (const name of TENANTS) {
    const f = fixture(name)
    for (const row of readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows) {
      const rd = row.readiness
      if (row.state !== 'needsProof' || !rd || rd.proof.length > 0 || rd.missing.length === 0) continue
      seen++
      assert.equal(actionOf(row)?.text, `Test ${rd.missing[0]}`)
      const d = detailOf(row)!
      assert.match(d.why[0], /No phishing-resistant sign-in is in the records IAMAI holds/)
      assert.match(d.next[0], /^Complete one phishing-resistant sign-in from /, `the detail says "${d.next[0]}"`)
    }
  }
  assert.ok(seen > 0, 'the fixtures hold somebody with a qualifying method, platforms in use and no proof')
})

test('a row holding two qualifying methods names both the way the reference does', () => {
  const f = fixture('demo')
  const both = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.find((r) => r.readiness?.qualifying.includes('passkey') && r.readiness.qualifying.includes('windowsHello'))
  assert.ok(both, 'the demo has somebody with a passkey and Windows Hello')
  assert.equal(methodsCell(both).main, 'Passkey + Windows Hello')
})

test('the surface offers the action only where readiness earns one, and the detail reads the same row', () => {
  assert.match(SURFACE, /const a = actionOf\(r\)/, 'the row control reads the one action authority')
  assert.match(SURFACE, /if \(!a\) return <span className="no-action" aria-hidden="true">&mdash;<\/span>/, 'nothing to do is a mark, not a control')
  assert.match(SURFACE, /useState<string \| null>\(null\)/, 'the detail is closed by default')
  assert.match(SURFACE, /const detail = openRow \? detailOf\(openRow\) : null/, 'the detail reads the same row the action was on')
})

// ---- C. Windows Hello is phishing-resistant; the passkey stays a recommendation

test('Windows Hello satisfies the baseline where it was proven, and the passkey guide and recommendation are unchanged', () => {
  // The guide's own target is the portable passkey, which Windows Hello is not.
  assert.equal(reachesTarget('windows-hello'), false)
  const hello = methodGuide('windows-hello')
  assert.ok(!hello.lines.includes(MG.common.scanAgain), 'no "scan again and you are passkey-ready" ending')
  assert.ok(hello.lines.some((l) => /does not reach the passkey target/.test(l)), 'the guide says so in words')
  const f = fixture('demo')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  // Ready with Windows Hello and no passkey: nothing required, a passkey recommended.
  const helloReady = v.rows.filter((r) => r.state === 'ready' && r.readiness?.hasPasskey === false && r.readiness.qualifying.includes('windowsHello'))
  assert.ok(helloReady.length > 0, 'the demo has somebody Ready with Windows Hello and no passkey')
  for (const row of helloReady) {
    assert.equal(actionOf(row)?.recommended, true)
    assert.equal(detailOf(row)?.next[0], 'No baseline action.')
  }
  // Windows Hello proven on Windows and a phone in use: asked to prove the phone, never told they hold nothing.
  const helloElsewhere = v.rows.filter((r) => r.state === 'needsProof' && r.readiness?.qualifying.length === 1 && r.readiness.qualifying[0] === 'windowsHello' && r.readiness.missing.length > 0)
  assert.ok(helloElsewhere.length > 0, 'the demo has a Windows Hello person seen on another platform')
  for (const row of helloElsewhere) assert.match(actionOf(row)?.text ?? '', /^Test /)
})

// ---- D. a Temporary Access Pass is a way in, not the end state ----------------

test('a Temporary Access Pass bootstraps and is never a readiness method', () => {
  assert.equal(reachesTarget('temporary-access-pass'), false)
  assert.equal(classOfKind('temporaryAccessPass'), null, 'a pass is not a method readiness weighs')
  const tap = methodGuide('temporary-access-pass')
  // It ends by returning the person to the real target: register, use it, scan.
  assert.ok(tap.lines.some((l) => /registers the passkey or security key/.test(l)), 'it leads to the target method')
  assert.ok(tap.lines.includes(MG.common.useIt) && tap.lines.includes(MG.common.scanAgain), 'and then to using it and scanning')
  assert.ok(tap.lines.some((l) => /never where they stay/.test(l)), 'and says it is not where the person stays')
  // The admin half describes the Microsoft action, and says IAMAI does none of it.
  assert.ok(tap.lines.some((l) => /Authentication Administrator role/.test(l)), 'the permission the operator needs')
  assert.ok(tap.lines.some((l) => /IAMAI issues nothing itself/.test(l)), 'and that IAMAI issues nothing')
})

test('the pass guide tells the operator to make it one-time, and names the role an administrator needs', () => {
  // A pass is only one-time and short-lived because the operator chose those
  // settings. The guide asks for them; it does not assert them as given.
  const tap = methodGuide('temporary-access-pass')
  const oneTime = tap.lines.filter((l) => /one-time/i.test(l))
  assert.ok(oneTime.some((l) => /Set it to one-time use/.test(l)), `an instruction to select one-time use (${oneTime.join(' | ')})`)
  assert.ok(oneTime.some((l) => /lifetime|expir/i.test(l)), 'and to keep the lifetime short')
  assert.ok(!tap.lines.some((l) => /it is one-time and short-lived/i.test(l)), 'never stated as a property the pass simply has')
  // The role split: an administrator's methods need the privileged role, so a
  // guide that named only the ordinary role would fail on the people who most
  // need remediating.
  const roles = tap.lines.filter((l) => /Authentication Administrator/.test(l))
  assert.ok(roles.some((l) => /Privileged Authentication Administrator/.test(l)), 'the privileged role is named')
  assert.ok(roles.some((l) => /administrator needs Privileged/.test(l)), 'and it is the one an administrator needs')
  assert.ok(roles.some((l) => /ordinary user needs the Authentication Administrator/.test(l)), 'the ordinary role is scoped to ordinary users')
})

test('a guest is told, in one shared sentence, why this tenant issues them no Temporary Access Pass', () => {
  // This tenant cannot issue a guest a pass: their authentication methods are
  // their home tenant's. The campaign says so in words.
  assert.match(MG.guest, /own tenant|home tenant/, 'the sentence sends the operator to the home tenant that owns the guest')
  const risks = (contentStepFor(campaignOf('demo')) as Record<string, any>).more.risks as { text: string }[]
  assert.ok(risks.some((r) => r.text === '{guestNoTap}'), 'the campaign references the shared sentence rather than retyping it')
  assert.equal(fillText('{guestNoTap}', {}), MG.guest, 'and it fills to that sentence')
  assert.ok(whole('{guestNoTap}', {}), 'a shared reference is not a hole')
  // A guest who needs a method is asked for a passkey, never handed a pass.
  for (const name of TENANTS) {
    const f = fixture(name)
    for (const row of readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows) {
      if (row.guest && row.state === 'needsSetup') assert.doesNotMatch(actionOf(row)?.text ?? '', /Temporary Access Pass/, `${name}/${row.user.id}: a guest is offered no pass`)
    }
  }
})

// ---- E / F. the platforms, and the security key --------------------------------

test('both Authenticator platforms are guided, and they differ where the Microsoft steps differ', () => {
  const ios = methodGuide('authenticator-iphone')
  const android = methodGuide('authenticator-android')
  assert.notEqual(ios.title, android.title, 'the operator can tell them apart')
  assert.match(ios.title, /iPhone/)
  assert.match(android.title, /Android/)
  assert.ok(ios.lines.some((l) => /App Store/.test(l)) && android.lines.some((l) => /Google Play/.test(l)), 'each names its own store')
  assert.ok(ios.lines.some((l) => /Face ID/.test(l)), 'iOS confirms the way iOS confirms')
  assert.ok(android.lines.some((l) => /screen lock/.test(l)), 'Android confirms the way Android does')
  // Different where they differ, shared where they do not.
  assert.notDeepEqual(ios.lines, android.lines)
  assert.ok(ios.lines.filter((l) => android.lines.includes(l)).length >= 3, 'the common steps are shared, not retyped')
})

test('the security-key guide is concise, and carries no vendor or raw identifier', () => {
  const key = methodGuide('security-key')
  assert.ok(key.lines.length <= 6, `four or so lines, not a manual (${key.lines.length})`)
  const text = guideText('security-key')
  // The recorded Microsoft Authenticator AAGUIDs belong to the administrative
  // method-settings step; they are not end-user setup instructions.
  assert.doesNotMatch(text, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, 'no raw AAGUID in end-user steps')
  assert.doesNotMatch(text, /yubi|feitian|solokey|token2|idmelon/i, 'no vendor-specific assumption')
  // And no guide anywhere carries one.
  for (const g of METHOD_GUIDES) assert.doesNotMatch(guideText(g.id), /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, `${g.id}: no identifier in guidance`)
  // The two AAGUIDs stay exactly where they were, in the method-settings step.
  const settings = content.steps.find((s) => s.id === 's-prereq-passkey-settings') as Record<string, any>
  assert.ok(JSON.stringify(settings.whatToDo).includes('{aaguidAndroid}'), 'the administrative step still carries them')
})

// ---- G. the Plan keeps its own job ---------------------------------------------

test('the campaign step hands person-level setup to MFA Readiness and keeps its policy work', () => {
  // GetIAMAI for the tenant whose MFA waits on readiness: on the demo nothing the
  // plan dates gives the readiness line its enrol-by day (roadmap/holds.ts).
  for (const name of ['getiamai', 'mid', 'messy'] as FixtureName[]) {
    const step = campaignOf(name)
    const ctx = ctxFor(name)
    const lines = stepLines(step, ctx)
    const text = lines.join('\n')
    // The handoff.
    assert.ok(lines.includes(GUIDE_POINTER), `${name}: the step points at MFA Readiness`)
    // The policy consequence and the counts that decide it are still there.
    assert.ok(text.includes('Enforcement should change nothing for anyone'), `${name}: the consequence stands`)
    assert.ok(/\d+ (?:people|person) with /.test(text), `${name}: the people the campaign has to reach, counted`)
    assert.ok(/Require Phishing-Resistant MFA for Admins waits on each/.test(text), `${name}: what waits on it`)
    assert.ok(text.includes('Every admin is Ready for phishing-resistant MFA.'), `${name}: and the admin completion gate`)
    // The readiness the plan waits on, where this scan measured one at all.
    if (name !== 'messy') {
      assert.ok(/readiness \d+%/.test(text), `${name}: the readiness the plan waits on`)
      assert.ok(text.includes('Readiness reaches 90% of active people'), `${name}: the readiness completion gate`)
    }
    // And the long per-method manual is not back: no guide's instruction list
    // renders inline on the step.
    for (const g of METHOD_GUIDES) {
      const inline = g.lines.filter((l) => text.includes(l))
      assert.ok(inline.length === 0, `${name}: ${g.id} renders inline on the Plan (${inline[0] ?? ''})`)
    }
  }
})

test('no Plan step anywhere renders the shared setup guidance inline', () => {
  const guideLines = new Set(METHOD_GUIDES.flatMap((g) => g.lines))
  for (const name of ['demo', 'mid'] as FixtureName[]) {
    const ctx = ctxFor(name)
    for (const step of runFixture(fixture(name)).steps) {
      for (const line of stepLines(step, ctx)) {
        assert.ok(!guideLines.has(line), `${name}/${step.id}: a shared guidance line is rendered on the Plan`)
      }
    }
  }
})

// ---- H. the message the campaign sends -----------------------------------------

test("the campaign email reuses the guidance, states no proof, and does not leave anybody on a pass", () => {
  for (const name of ['demo', 'mid', 'messy'] as FixtureName[]) {
    const ctx = ctxFor(name)
    const step = campaignOf(name)
    const box = copyBoxes(step, ctx).find((b) => b.kind === 'comms')
    if (!box) continue
    assert.ok(box.text.includes(USER_INSTRUCTION), `${name}: the email carries the shared sentence`)
    assert.doesNotMatch(box.text, /\{[a-zA-Z0-9_:]+\}/, `${name}: no unresolved hole in the email`)
    // A pass is an operator's tool for a person who cannot get in; it is never
    // offered to everybody as the thing to end up with.
    assert.doesNotMatch(box.text, /Temporary Access Pass/, `${name}: the broadcast email does not hand out a pass`)
    // The email asks people to register; it never tells them they are done.
    assert.doesNotMatch(box.text, /you are passkey-ready|already proven/i, `${name}: no claim of proof`)
  }
  // The hole rule is the product's own: a body whose variables are unfilled
  // renders nowhere, the shared reference included.
  const cs = content.steps.find((s) => s.id === CAMPAIGN) as Record<string, any>
  assert.equal(whole(cs.comms.body, {}), false, 'the body still needs the tenant it names')
  assert.ok(whole('{registerPasskeyLine}', {}), 'a shared reference is not a hole')
  assert.equal(fillText('{registerPasskeyLine}', {}), USER_INSTRUCTION, 'and it fills to the one shared sentence')
  assert.equal(fillText('{methodGuidePointer}', {}), GUIDE_POINTER)
})

test('the help-desk lines the campaign keeps are exceptions, not a setup manual', () => {
  const ctx = ctxFor('demo')
  const box = copyBoxes(campaignOf('demo'), ctx).find((b) => b.kind === 'helpDesk')!
  assert.ok(box.text.length > 0)
  for (const g of METHOD_GUIDES) for (const l of g.lines) assert.ok(!box.text.includes(l), `${g.id}: not duplicated into the help-desk box`)
})

// ---- I. the official source ----------------------------------------------------

test('every guide ends on one official Microsoft page, and the page renders no guide of its own', () => {
  for (const g of METHOD_GUIDES) {
    assert.match(g.learn.url, /^https:\/\/learn\.microsoft\.com\//, `${g.id}: an official Microsoft page`)
    assert.doesNotMatch(g.learn.url, /blog|medium|github\.io/, `${g.id}: not a vendor blog`)
  }
  // MFA Readiness's detail is Why and Next (Step 7): no bibliography, no guide panel.
  assert.doesNotMatch(SURFACE, /methodGuide\(|guideText\(|learn\.url|RemediationPanel/, 'the page renders a guide of its own')
})

// ---- J. no new authority, and no way to write ----------------------------------

test('guidance changes no readiness, no count and no emergency-access classification', () => {
  for (const name of TENANTS) {
    const f = fixture(name)
    const before = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    // Ask for every action, every detail and every guide: none of it touches the
    // evidence, because none of it is evidence.
    for (const row of before.rows) {
      actionOf(row)
      detailOf(row)
    }
    for (const g of METHOD_GUIDES) guideText(g.id)
    const after = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    assert.deepEqual(
      after.rows.map((r) => [r.user.id, r.state, r.active, r.kind]),
      before.rows.map((r) => [r.user.id, r.state, r.active, r.kind]),
      `${name}: the evidence is unmoved`,
    )
    assert.deepEqual(after.counts, before.counts, `${name}: and so are the counts`)
    // A confirmed emergency-access account is not an employee passkey campaign
    // target and is offered no action (task 001).
    for (const id of f.mapping.breakGlassUserIds) {
      const row = before.rows.find((x) => x.user.id === id)
      if (!row) continue
      assert.equal(row.kind, 'emergency', `${name}/${id}: still classified emergency access`)
      assert.equal(row.state, null)
      assert.equal(actionOf(row), null, `${name}/${id}: no campaign action attached`)
    }
  }
})

test('the guidance layer reads the tenant and writes nothing', () => {
  const src = readFileSync('src/content/methodGuides.ts', 'utf8')
  // No Graph client, no store, no mutation: it is content and a lookup.
  assert.doesNotMatch(src, /graph\/|msal|fetch\(|idb|localStorage/, 'the guidance module reaches nothing outside the content file')
  assert.doesNotMatch(SURFACE, /POST|PATCH|DELETE|graphFetch/, 'the page submits nothing to a tenant')
  // And the guidance says what a person does in Microsoft's own portals, never
  // what IAMAI will do for them.
  for (const g of METHOD_GUIDES) assert.doesNotMatch(guideText(g.id), /IAMAI (issues|registers|creates|sets) (?!nothing)/, `${g.id}: IAMAI performs nothing`)
})

test('the target and the tenant prerequisite are said once, outside every guide', () => {
  assert.equal(PASSKEY_TARGET, MG.target)
  assert.equal(TENANT_PREREQUISITE, MG.prereq)
  // The one-line explanation lives outside the guides, so no guide carries a
  // "why passkeys matter" preamble of its own.
  for (const g of METHOD_GUIDES) {
    assert.ok(!g.lines.includes(PASSKEY_TARGET), `${g.id}: the target is stated once, above`)
    assert.ok(!g.lines.includes(TENANT_PREREQUISITE), `${g.id}: and so is the prerequisite`)
  }
  // The target is phishing-resistant MFA, not a passkey (Step 7).
  assert.match(MG.target, /phishing-resistant/)
  // MFA Readiness's page carries neither: its summary sub-line says what Ready means.
  assert.doesNotMatch(SURFACE, /PASSKEY_TARGET|TENANT_PREREQUISITE/)
})

test('the step content the guidance replaced is gone, and its meaning is not', () => {
  const cs = contentStepFor(campaignOf('demo')) as Record<string, any>
  const steps = (cs.whatToDo.steps as string[]).join('\n')
  // The four per-state setup blocks the step used to carry.
  for (const gone of ['Add sign-in method → Passkey → in Microsoft Authenticator', 'Never seen or possibly broken', 'read it to them by phone']) {
    assert.ok(!steps.includes(gone), `the long setup line "${gone}" is not back on the Plan`)
  }
  // What it must not have lost: the pass for somebody with no way in, the phone
  // number that comes off after, the admins' harder requirement, and the scan.
  assert.ok(/Temporary Access Pass/.test(steps), 'a person with no method still gets a way in')
  assert.ok(/remove the phone number as a sign-in method/.test(steps), 'the phone number still comes off')
  assert.ok(/hardware security key/.test(steps), "the admins' requirement stands")
  assert.ok(/the record shows it on the next scan/.test(steps), 'and the step still ends on the evidence')
})
