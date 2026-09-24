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
import { GUIDE_POINTER, METHOD_GUIDES, USER_INSTRUCTION, guideText, methodGuide, reachesTarget } from '../../content/methodGuides.ts'
import type { MethodGuideId } from '../../content/methodGuides.ts'
import { nextCell, panelDevices, panelMethods, whyLine } from './readinessCells.ts'
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
  // The Authenticator procedure the two platforms share is the one Emergency
  // Access uses (owner, 2026-09-24), referenced, not copied: change it once and
  // every guide and step changes. It never sends anyone to aka.ms/mfasetup.
  const create = MG.common.authenticatorCreate
  assert.ok(create && create.length > 20)
  for (const id of ['authenticator-iphone', 'authenticator-android'] as MethodGuideId[]) {
    assert.ok(methodGuide(id).lines.some((l) => l.includes('**Create a passkey**')), `${id}: uses the shared Create a passkey line`)
    assert.ok(!methodGuide(id).lines.some((l) => /aka\.ms\/mfasetup/.test(l)), `${id}: never sends the person to aka.ms/mfasetup`)
    const raw = MG.guides.find((g) => g.id === id)!
    assert.ok(raw.steps.includes('@authenticatorCreate'), `${id}: the content file references the shared line rather than repeating it`)
  }
  // And the closing pair, on every guide that ends by using the method.
  for (const id of ['authenticator-iphone', 'authenticator-android', 'security-key', 'temporary-access-pass', 'prove'] as MethodGuideId[]) {
    const lines = methodGuide(id).lines
    assert.ok(lines.includes(MG.common.useIt.replace('{passkeySignIn}', MG.common.passkeySignIn)), `${id}: ends by using the method`)
    assert.ok(lines.includes(MG.common.scanAgain), `${id}: and by scanning again`)
  }
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

// ---- D. a Temporary Access Pass is a way in, not the end state ----------------

test('a Temporary Access Pass bootstraps and is never a readiness method', () => {
  assert.equal(reachesTarget('temporary-access-pass'), false)
  assert.equal(classOfKind('temporaryAccessPass'), null, 'a pass is not a method readiness weighs')
  const tap = methodGuide('temporary-access-pass')
  // It ends by returning the person to the real target: register, use it, scan.
  assert.ok(tap.lines.some((l) => /registers the passkey or security key/.test(l)), 'it leads to the target method')
  // Using it names the method and how to pick it ({passkeySignIn}, owner 2026-09-24).
  const useIt = MG.common.useIt.replace('{passkeySignIn}', MG.common.passkeySignIn)
  assert.ok(tap.lines.includes(useIt) && tap.lines.includes(MG.common.scanAgain), 'and then to using it and scanning')
  assert.match(useIt, /Face, fingerprint, PIN or security key/, 'the sign-in line says how to pick the passkey')
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

// ---- G. the Plan keeps its own job ---------------------------------------------

// The Plan names the exact procedure where it asks for a passkey (owner,
// 2026-09-24: directions name the method; Emergency Access's steps are the
// model). Every Plan line that creates a passkey in Microsoft Authenticator is
// the one shared line, and none sends anyone to aka.ms/mfasetup to do it.
test('every Plan line that creates an Authenticator passkey is the one shared procedure', () => {
  // Plan lines are read as text (stepLines drops the bold), so the shared line is too.
  const tail = MG.common.authenticatorCreate.split('{passkeyAccount}')[1]!.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  let seen = 0
  for (const name of ['demo', 'mid'] as FixtureName[]) {
    const ctx = ctxFor(name)
    for (const step of runFixture(fixture(name)).steps) {
      for (const line of stepLines(step, ctx)) {
        assert.doesNotMatch(line, /aka\.ms\/mfasetup[^.]*Authenticator|Passkey in Microsoft Authenticator/, `${name}/${step.id}: a second Authenticator passkey procedure`)
        if (!/Create a passkey/.test(line)) continue
        seen++
        assert.ok(line.includes(tail), `${name}/${step.id}: an Authenticator passkey line in other words than the shared one: ${line}`)
      }
    }
  }
  assert.ok(seen > 0, 'the fixtures draw a step that creates an Authenticator passkey')
})

// ---- H. the message the campaign sends -----------------------------------------

test("the campaign email reuses the guidance, states no proof, and does not leave anybody on a pass", () => {
  for (const name of ['demo', 'mid', 'messy'] as FixtureName[]) {
    const ctx = ctxFor(name)
    const step = campaignOf(name)
    const box = copyBoxes(step, ctx).find((b) => b.kind === 'comms')
    if (!box) continue
    assert.doesNotMatch(box.text, /\{[a-zA-Z0-9_:]+\}/, `${name}: no unresolved hole in the email`)
    // A pass is an operator's tool for a person who cannot get in; it is never
    // offered to everybody as the thing to end up with.
    assert.doesNotMatch(box.text, /Temporary Access Pass/, `${name}: the broadcast email does not hand out a pass`)
    // The email asks people to register; it never tells them they are done.
    assert.doesNotMatch(box.text, /you are passkey-ready|already proven/i, `${name}: no claim of proof`)
  }
  // The hole rule is the product's own: a body whose variables are unfilled
  // renders nowhere, the shared reference included.
  assert.ok(whole('{registerPasskeyLine}', {}), 'a shared reference is not a hole')
  assert.equal(fillText('{registerPasskeyLine}', {}), USER_INSTRUCTION, 'and it fills to the one shared sentence')
  assert.equal(fillText('{methodGuidePointer}', {}), GUIDE_POINTER)
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

