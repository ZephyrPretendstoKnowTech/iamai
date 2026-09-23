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
// scan again; somebody Ready is only recommended the seamless option; and no
// guidance moves a state, a proof, a count or an emergency-access
// classification.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import type { ReadinessState } from '../../scoring/phishingResistant.ts'
import { classOfKind, isReady } from '../../scoring/phishingResistant.ts'
import { content, pages, shared } from '../../content/content.ts'
import { fillText, whole } from '../../content/render.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { GUIDE_POINTER, METHOD_GUIDES, PASSKEY_TARGET, TENANT_PREREQUISITE, USER_INSTRUCTION, guideText, methodGuide, reachesTarget } from '../../content/methodGuides.ts'
import type { MethodGuideId } from '../../content/methodGuides.ts'
import { classWord, deviceChips, methodsCell, nextCell, panelDevices, panelMethods, whyLine, deviceNoun } from './readinessCells.ts'
import { copyBoxes, stepLines } from './stepExport.ts'
import { rescanLinesOf } from './stepInstructions.ts'
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
const SURFACE = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8').replace(/\r\n/g, '\n')

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

// ---- B. the next step follows the evidence ------------------------------------

test('the next step a person is offered follows their readiness, the panel agrees with it, and nothing else decides it', () => {
  const N = (pages.readiness as unknown as { next: { none: string } }).next
  const seen = new Set<ReadinessState>()
  for (const name of TENANTS) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    for (const row of v.rows) {
      const where = `${name}/${row.user.id}`
      if (row.state === null) {
        assert.equal(nextCell(row), '', `${where}: an account the page does not count is asked for nothing`)
        assert.equal(whyLine(row), '', `${where}: and told no reason`)
        continue
      }
      seen.add(row.state)
      const rd = row.readiness!
      const next = nextCell(row)
      assert.match(next, /\S/, `${where}: a counted person with no next step`)
      assert.match(whyLine(row), /\S/, `${where}: a counted person with no reason`)
      if (isReady(row.state)) {
        assert.ok(rd.qualifying.length > 0, `${where}: Ready holds a qualifying method`)
        assert.ok(rd.devices.length > 0 && rd.devices.every((d) => d.proof !== null), `${where}: Ready is confirmed on every device used`)
        assert.equal(rd.next.kind, 'none', `${where}: the baseline asks nothing more of somebody Ready`)
        // Seamless is a recommendation for somebody Ready, never a requirement.
        if (row.state === 'seamless') assert.equal(next, N.none, `${where}: nothing to do`)
        else assert.ok(rd.recommended === null || rd.recommended.kind === 'seamless', `${where}: Ready is only recommended the seamless option`)
      } else if (row.state === 'confirm') {
        // A qualifying method is registered. The next step is to confirm it, never to register another one.
        assert.ok(rd.qualifying.length > 0, `${where}: the method is registered`)
        assert.ok(['confirm', 'returnConfirm', 'replaceKey'].includes(rd.next.kind), `${where}: confirm, not register (${rd.next.kind})`)
        assert.doesNotMatch(next, /^Set up/, `${where}: confirm, not register`)
      } else if (row.state === 'device') {
        assert.ok(rd.qualifying.length > 0, `${where}: confirmed on one device`)
        // The next step is on the device that signs in without it: confirm a credential they hold that works there, set one up, or update the phone.
        assert.ok(['addDevice', 'confirm', 'updateOs'].includes(rd.next.kind), `${where}: the next step is the device that signs in without it (${rd.next.kind})`)
        const gapOs = (rd.next as { os?: string | null }).os
        assert.ok(rd.devices.some((d) => d.proof === null && d.os === gapOs), `${where}: the next step names a device with no confirmed sign-in`)
        assert.ok(rd.devices.some((d) => d.proof !== null) && rd.devices.some((d) => d.proof === null), `${where}: confirmed on one device and not another`)
      } else if (row.state === 'method') {
        assert.equal(rd.qualifying.length, 0, `${where}: no qualifying method`)
        // A guest already holding Microsoft Authenticator is told what they use, never to set it up again.
        if (row.guest && (row.methods ?? []).includes('authenticator')) assert.doesNotMatch(next, /^Set up/, `${where}: a guest who holds Authenticator`)
        else assert.match(next, /^(Set up|Restore) /, `${where}: set up, or restore what disappeared`)
      } else if (row.state === 'blocked') {
        assert.equal(rd.next.kind, 'waitSetup', `${where}: waits on the tenant`)
      } else {
        // The evidence could not be read: no setup path is guessed at; the next scan reads it.
        assert.equal(rd.next.kind, 'rescan', `${where}: unknown stays unknown`)
        assert.doesNotMatch(next, /^Set up/, `${where}: an unread person is told to set nothing up`)
      }
    }
  }
  // Blocked by setup needs a tenant setting none of these fixtures carries; the scoring's own tests hold it.
  assert.deepEqual([...seen].sort(), ['confirm', 'device', 'method', 'ready', 'seamless', 'unknown'], 'the sweep saw every state the fixtures hold')
})

test('a registered method with no confirmed sign-in is asked to be confirmed, on the row and in the panel', () => {
  const P = (pages.readiness as unknown as { panel: { proofNow: { none: string }; now: string } }).panel
  let seen = 0
  for (const name of TENANTS) {
    const f = fixture(name)
    for (const row of readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows) {
      const rd = row.readiness
      if (row.state !== 'confirm' || !rd || rd.next.kind !== 'confirm') continue
      seen++
      // The method keeps its capitals mid-sentence, and the device is named where one is known.
      const W = pages.readiness as unknown as { next: { confirm: string; confirmOn: string }; methodsInline: Record<string, string> }
      assert.equal(nextCell(row), rd.next.os ? fillText(W.next.confirmOn, { method: W.methodsInline[rd.next.cls], device: deviceNoun(rd.next.os) }) : fillText(W.next.confirm, { method: W.methodsInline[rd.next.cls] }))
      assert.doesNotMatch(nextCell(row), /windows hello/, 'never a lower-cased product name')
      // Every device in use reads Not confirmed, on the chip and in the panel's Now.
      for (const c of deviceChips(row).chips) assert.equal(c.word, (pages.readiness as unknown as { chip: { notConfirmed: string } }).chip.notConfirmed)
      for (const d of panelDevices(row)) assert.deepEqual(d.facts.find(([k]) => k === P.now)?.[1], P.proofNow.none)
    }
  }
  assert.ok(seen > 0, 'the fixtures hold somebody with a registered method and no confirmed sign-in')
})

test('a row holding two qualifying methods names both', () => {
  const f = fixture('demo')
  const both = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.find((r) => r.readiness?.qualifying.includes('passkey') && r.readiness.qualifying.includes('windowsHello'))
  assert.ok(both, 'the demo has somebody with a passkey and Windows Hello')
  assert.equal(methodsCell(both).main, 'Passkey and Windows Hello')
})

test('the surface offers the next step the readiness gives, and the panel reads the same row', () => {
  assert.match(SURFACE, /<div className="next-step">\s*\{nextCell\(r\)\}/, 'the row reads the one next-step authority')
  // Only counted people are in a group; an account the page does not count is in the rail, asked for nothing.
  assert.match(SURFACE, /rows: view\.rows\.filter\(\(r\) => r\.state === s && matches\(r\)\)/)
  assert.match(SURFACE, /useState<string \| null>\(null\)/, 'the panel is closed by default')
  assert.match(SURFACE, /const openRow = openId === null \? null : \(view\?\.rows\.find\(\(r\) => r\.user\.id === openId\) \?\? null\)/, 'the panel reads the same row the Details was on')
  assert.match(SURFACE, /<strong>\{nextCell\(openRow\)\}<\/strong>\s*<p>\{whyLine\(openRow\)\}<\/p>/, "the panel's next step is not the row's")
})

// ---- C. Windows Hello is phishing-resistant, where it signs in -----------------

test('Windows Hello satisfies the baseline on the computer it signs in on, and the passkey guide is unchanged', () => {
  // The guide's own target is the portable passkey, which Windows Hello is not.
  assert.equal(reachesTarget('windows-hello'), false)
  const hello = methodGuide('windows-hello')
  assert.ok(!hello.lines.includes(MG.common.scanAgain), 'no "scan again and you are passkey-ready" ending')
  assert.ok(hello.lines.some((l) => /does not reach the passkey target/.test(l)), 'the guide says so in words')
  const f = fixture('demo')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  // Windows Hello alone, and only a Windows computer in use: Ready, nothing required.
  const helloOnly = v.rows.filter((r) => r.state !== null && r.readiness?.qualifying.length === 1 && r.readiness.qualifying[0] === 'windowsHello')
  const helloReady = helloOnly.filter((r) => isReady(r.state!))
  assert.ok(helloReady.length > 0, 'the demo has somebody Ready with Windows Hello alone')
  for (const row of helloReady) {
    assert.equal(row.readiness!.next.kind, 'none')
    assert.ok(row.readiness!.devices.every((d) => d.os === 'Windows'), `${row.user.id}: Windows Hello is Ready only where Windows is all they use`)
  }
  // Windows Hello confirmed on Windows and a phone in use: asked to add the phone, never told they hold nothing.
  const helloElsewhere = helloOnly.filter((r) => r.state === 'device')
  assert.ok(helloElsewhere.length > 0, 'the demo has a Windows Hello person who also signs in on a phone')
  for (const row of helloElsewhere) {
    assert.equal(row.readiness!.next.kind, 'addDevice')
    assert.match(nextCell(row), /^Add /)
    assert.doesNotMatch(nextCell(row), /^Set up/)
  }
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
  // MFA Readiness counts guests with everyone else (owner, 2026-09-19): a guest
  // row is never offered a pass, nor asked to set up a passkey, which guests
  // can't use yet; Microsoft Authenticator is what it asks for.
  let guests = 0
  for (const name of TENANTS) {
    const f = fixture(name)
    for (const row of readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows) {
      if (!row.guest || !row.active) continue
      guests++
      assert.notEqual(row.state, null, `${name}/${row.user.id}: an active guest is counted`)
      assert.doesNotMatch(nextCell(row), /Temporary Access Pass|passkey in|phone passkey|Windows Hello|security key on/, `${name}/${row.user.id}: a guest is asked for nothing a guest can't use`)
    }
  }
  assert.ok(guests > 0, 'the fixtures hold an active guest')
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
    assert.ok(text.includes('Help people set up the sign-in methods'), `${name}: preparation purpose`)
    // mfa-everyone-spec.md §4 C9: Completion Criteria is split so each line says
    // one thing — the cohort, the administrator gate, the support list.
    assert.ok(text.includes('Everyone in this step has a registered MFA method they can use'), `${name}: exact preparation cohort`)
    assert.ok(text.includes('Every administrator has a phishing-resistant method'), `${name}: stronger administrator requirement`)
    assert.ok(text.includes('The people who still need help are identified and on the support list'), `${name}: who is still owed help`)
    assert.doesNotMatch(text, /Readiness reaches 90%/, 'preparation cannot mask people without a suitable method')
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
  // MFA Readiness's person panel is the next step, the devices and the methods (prompt 62): no bibliography, no guide panel.
  assert.doesNotMatch(SURFACE, /methodGuide\(|guideText\(|learn\.url|RemediationPanel/, 'the page renders a guide of its own')
})

// ---- J. no new authority, and no way to write ----------------------------------

test('guidance changes no readiness, no count and no emergency-access classification', () => {
  for (const name of TENANTS) {
    const f = fixture(name)
    const before = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    // Ask for every next step, every reason, every panel and every guide: none
    // of it touches the evidence, because none of it is evidence.
    for (const row of before.rows) {
      nextCell(row)
      whyLine(row)
      panelDevices(row)
      panelMethods(row)
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
      assert.equal(nextCell(row), '', `${name}/${id}: no campaign action attached`)
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
  // MFA Readiness's page carries neither: the answer's definition line says what Ready means.
  assert.doesNotMatch(SURFACE, /PASSKEY_TARGET|TENANT_PREREQUISITE/)
})

test('the step content the guidance replaced is gone, and its meaning is not', () => {
  const campaign = campaignOf('demo')
  const cs = contentStepFor(campaign) as Record<string, any>
  // The steps as a readable tenant reads them: the promise that the next scan
  // shows the evidence follows them from whatToDo.rescan, and is left out only
  // where the source it is read from was refused (R4-20).
  const steps = [...(cs.whatToDo.steps as string[]), ...rescanLinesOf(campaign, cs).steps].join('\n')
  // The four per-state setup blocks the step used to carry.
  for (const gone of ['Add sign-in method → Passkey → in Microsoft Authenticator', 'Never seen or possibly broken', 'read it to them by phone']) {
    assert.ok(!steps.includes(gone), `the long setup line "${gone}" is not back on the Plan`)
  }
  // What it must not have lost: the pass for somebody with no way in, the phone
  // number that comes off after, the admins' harder requirement, and the scan.
  assert.ok(/Temporary Access Pass/.test(steps), 'a person with no method still gets a way in')
  // Editorial batch C: an older method is retired only through the approved change, after recovery is checked.
  assert.ok(/Retire an older method only through the approved method-policy change, after checking recovery needs/.test(steps), 'the phone number still comes off, safely')
  assert.ok(/hardware security key/.test(steps), "the admins' requirement stands")
  assert.ok(/the record shows it on the next scan/.test(steps), 'and the step still ends on the evidence')
})
