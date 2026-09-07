// MFA remediation guidance and content deduplication (task 014).
//
// Two things are being protected here.
//
// One source. The passkey, security-key, Windows Hello and Temporary Access
// Pass instructions are written once, in shared.methodGuides, and read through
// content/methodGuides.ts by MFA Readiness's panel, by the text the help desk
// copies out of it, by the campaign step's What-to-do and by the campaign
// email. Four hand-written versions of the same flow is the failure this file
// exists to catch, so the assertions are on the shared keys and the material
// actions, not on the prose word for word.
//
// One evidence authority. Remediation follows the group task 002's evidence put
// a person in (derive/mfaReadiness.ts) and nothing else: somebody with a
// registered passkey is asked to use it, not to register a second one; somebody
// whose methods this scan could not read is asked for nothing; Windows Hello
// and a Temporary Access Pass are offered without being called the target; and
// no remediation moves a rung, a proof, a lifecycle or an emergency-access
// classification.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import type { ReadinessGroup } from '../../derive/mfaReadiness.ts'
import { hasPortablePhishingResistant, methodsOf, rungOf, windowsHelloOnly } from '../../derive/ladder.ts'
import { content, shared } from '../../content/content.ts'
import { fillText, whole } from '../../content/render.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import {
  GUIDE_POINTER,
  METHOD_GUIDES,
  PASSKEY_TARGET,
  TENANT_PREREQUISITE,
  USER_INSTRUCTION,
  guideText,
  guidesOf,
  methodGuide,
  reachesTarget,
  remediationFor,
} from '../../content/methodGuides.ts'
import type { MethodGuideId } from '../../content/methodGuides.ts'
import { nextStateWord } from './readinessCells.ts'
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

test('the help-desk text is the guidance on screen, not a second version of it', () => {
  for (const g of METHOD_GUIDES) {
    const text = guideText(g.id)
    assert.ok(text.includes(g.title), `${g.id}: the copy names the method`)
    for (const l of g.lines) assert.ok(text.includes(l), `${g.id}: the copy carries the line the panel shows`)
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
  // Rendered, both come out as the shared line itself.
  const ctx = ctxFor('demo')
  const step = campaignOf('demo')
  const lines = stepLines(step, ctx)
  assert.ok(lines.includes(GUIDE_POINTER), 'the Plan step renders the pointer')
  assert.ok(lines.some((l) => l.includes(USER_INSTRUCTION)), 'the email renders the shared end-user sentence')
  const box = copyBoxes(step, ctx).find((b) => b.kind === 'comms')!
  assert.ok(box.text.includes(USER_INSTRUCTION), 'and the copy box carries the same sentence')
})

// ---- B. the action follows the evidence ---------------------------------------

test('the remediation a person is offered is the group their evidence put them in, and nothing else', () => {
  const seen = new Set<ReadinessGroup>()
  for (const name of TENANTS) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    for (const row of v.rows) {
      const r = remediationFor(row.group, row)
      if (row.group === null) {
        assert.equal(r.kind, 'none', `${name}/${row.user.id}: an account the campaign does not count is asked for nothing`)
        assert.deepEqual(guidesOf(r), [])
        continue
      }
      seen.add(row.group)
      if (row.group === 'ready') {
        // Proven rung 5: the page-level target is met and no setup is offered.
        assert.equal(row.rung, 5, `${name}/${row.user.id}: passkey-ready is rung 5`)
        assert.equal(r.kind, 'none', `${name}/${row.user.id}: nothing to set up`)
        assert.deepEqual(guidesOf(r), [])
        assert.equal(nextStateWord(row), '', 'and nothing is asked in the row')
      } else if (row.group === 'needsProof') {
        // A passkey or security key is in the inventory. The action is to use
        // it, never to register another one.
        assert.ok(hasPortablePhishingResistant(methodsOf(f.snapshot, row.user.id)), `${name}/${row.user.id}: the method is registered`)
        assert.equal(r.kind, 'prove', `${name}/${row.user.id}: prove, not register`)
        assert.deepEqual(guidesOf(r), ['prove'])
        for (const id of guidesOf(r)) assert.notEqual(id, 'authenticator-iphone')
      } else if (row.group === 'needsPasskey') {
        // Nothing of the kind in the inventory: registration guidance applies.
        assert.equal(hasPortablePhishingResistant(methodsOf(f.snapshot, row.user.id)), false, `${name}/${row.user.id}: none registered`)
        assert.equal(r.kind, 'setUp')
        assert.ok(guidesOf(r).includes('authenticator-iphone') && guidesOf(r).includes('security-key'))
      } else {
        // Unreadable methods: the state stays unknown and no setup path is
        // guessed at. The page's own scan is the action.
        assert.equal(r.kind, 'unknown', `${name}/${row.user.id}: unknown stays unknown`)
        assert.deepEqual(guidesOf(r), [], 'no guessed setup guidance over evidence nobody could read')
      }
    }
  }
  assert.deepEqual([...seen].sort(), ['needsPasskey', 'needsProof', 'ready', 'unknown'], 'the sweep saw all four states')
})

test('the surface offers the action only where the evidence earns one', () => {
  const src = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  // The cell decides from the remediation, which decides from the group.
  assert.match(src, /remediationFor\(r\.group, r\)/, 'the row control reads the one remediation authority, person and all')
  assert.match(src, /kind === 'none' \|\| kind === 'unknown'/, 'ready and unknown get the state word and no control')
  // The panel is not on screen until a person's Next step is pressed.
  assert.match(src, /useState<OpenGuide \| null>\(null\)/, 'the panel is closed by default')
  assert.match(src, /remediationFor\(row\.group, row\)/, 'the panel reads the same authority as the row')
})

// ---- C. Windows Hello is not the passkey target -------------------------------

test('Windows Hello is offered and is never the passkey target', () => {
  assert.equal(reachesTarget('windows-hello'), false)
  const set = remediationFor('needsPasskey', { guest: false })
  assert.equal(set.kind, 'setUp')
  if (set.kind !== 'setUp') return
  assert.ok(!set.guides.includes('windows-hello'), 'not among the methods that reach the target')
  assert.ok(set.other.includes('windows-hello'), 'and still reachable, under its own line')
  const hello = methodGuide('windows-hello')
  // It must not end on the sentence that says a scan will read it as proven:
  // it never reaches rung 5, so that ending would be a false promise.
  assert.ok(!hello.lines.includes(MG.common.scanAgain), 'no "scan again and you are passkey-ready" ending')
  assert.ok(hello.lines.some((l) => /does not reach the passkey target/.test(l)), 'the guide says so in words')
  // And the person: Windows Hello only is rung 3, never passkey-ready.
  const f = fixture('demo')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const helloOnly = v.rows.filter((r) => r.active && windowsHelloOnly(r.viability!))
  assert.ok(helloOnly.length > 0, 'the demo has a Windows Hello only person')
  for (const row of helloOnly) {
    assert.equal(row.rung, 3, 'the canonical rung is untouched')
    assert.notEqual(row.group, 'ready', 'and they are not complete for the page target')
    assert.equal(remediationFor(row.group, row).kind, 'setUp', 'they are asked for a passkey or key')
  }
})

// ---- D. a Temporary Access Pass is a way in, not the end state ----------------

test('a Temporary Access Pass bootstraps and never becomes passkey-ready', () => {
  assert.equal(reachesTarget('temporary-access-pass'), false)
  const set = remediationFor('needsPasskey', { guest: false })
  if (set.kind !== 'setUp') throw new Error('needs a passkey offers setup')
  assert.ok(!set.guides.includes('temporary-access-pass'), 'not among the methods that reach the target')
  assert.ok(set.other.includes('temporary-access-pass'), 'offered as the way in')
  const tap = methodGuide('temporary-access-pass')
  // It ends by returning the person to the real target: register, use it, scan.
  assert.ok(tap.lines.some((l) => /registers the passkey or security key/.test(l)), 'it leads to the target method')
  assert.ok(tap.lines.includes(MG.common.useIt) && tap.lines.includes(MG.common.scanAgain), 'and then to using it and scanning')
  assert.ok(tap.lines.some((l) => /never where they stay/.test(l)), 'and says it is not where the person stays')
  // The admin half describes the Microsoft action, and says IAMAI does none of it.
  assert.ok(tap.lines.some((l) => /Authentication Administrator role/.test(l)), 'the permission the operator needs')
  assert.ok(tap.lines.some((l) => /IAMAI issues nothing itself/.test(l)), 'and that IAMAI issues nothing')
  // A pass changes no rung: the ladder reads registered methods and records, and
  // a pass is neither.
  const f = fixture('demo')
  for (const row of readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows) {
    if (!row.active) continue
    assert.equal(row.rung, rungOf(row.viability!), `${row.user.id}: the rung is the ladder's, before and after any guidance`)
  }
})

test('a guest is offered no Temporary Access Pass, and is told why', () => {
  // This tenant cannot issue a guest a pass: their authentication methods are
  // their home tenant's. The campaign has always said so in words; the panel
  // now behaves that way, from the row's own guest classification.
  const guest = remediationFor('needsPasskey', { guest: true })
  if (guest.kind !== 'setUp') throw new Error('a guest who needs a passkey is still offered setup')
  assert.ok(!guidesOf(guest).includes('temporary-access-pass'), 'no pass to issue, so no guide to issue one')
  assert.ok(guest.guides.includes('authenticator-iphone') && guest.guides.includes('authenticator-android') && guest.guides.includes('security-key'), 'the target methods stay: a guest registers them at home')
  assert.equal(guest.note, MG.guest, 'and the panel says why, in the shared sentence')
  assert.match(MG.guest, /own tenant|home tenant/, 'which sends the operator to the home tenant that owns the guest')
  // The member's offer is untouched.
  assert.ok(guidesOf(remediationFor('needsPasskey', { guest: false })).includes('temporary-access-pass'))
  // Real guests, from the tenants that have them: same answer, from the row.
  let seen = 0
  for (const name of TENANTS) {
    const f = fixture(name)
    for (const row of readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows) {
      if (!row.guest || row.group !== 'needsPasskey') continue
      seen++
      const r = remediationFor(row.group, row)
      assert.ok(!guidesOf(r).includes('temporary-access-pass'), `${name}/${row.user.id}: a guest is offered no pass`)
      assert.ok(guidesOf(r).includes('security-key'), `${name}/${row.user.id}: and still has a way to the target`)
    }
  }
  assert.ok(seen > 0, 'the fixtures have an active guest who needs a passkey')
  // The sentence is written once: the campaign's risk line references it.
  const risks = (contentStepFor(campaignOf('demo')) as Record<string, any>).more.risks as { text: string }[]
  assert.ok(risks.some((r) => r.text === '{guestNoTap}'), 'the campaign references the shared sentence rather than retyping it')
  assert.equal(fillText('{guestNoTap}', {}), MG.guest, 'and it fills to that sentence')
  assert.ok(whole('{guestNoTap}', {}), 'a shared reference is not a hole')
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
  for (const name of ['demo', 'mid', 'messy'] as FixtureName[]) {
    const step = campaignOf(name)
    const ctx = ctxFor(name)
    const lines = stepLines(step, ctx)
    const text = lines.join('\n')
    // The handoff.
    assert.ok(lines.includes(GUIDE_POINTER), `${name}: the step points at MFA Readiness`)
    // The policy consequence and the counts that decide it are still there.
    assert.ok(text.includes('Enforcement should change nothing for anyone'), `${name}: the consequence stands`)
    assert.ok(/\d+ people at /.test(text), `${name}: the people the campaign has to reach, counted`)
    assert.ok(/Require Phishing-Resistant MFA for Admins waits on each/.test(text), `${name}: what waits on it`)
    assert.ok(text.includes('Every admin has a passkey or a security key registered.'), `${name}: and the admin completion gate`)
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

test('every guide ends on one official Microsoft page', () => {
  for (const g of METHOD_GUIDES) {
    assert.match(g.learn.url, /^https:\/\/learn\.microsoft\.com\//, `${g.id}: an official Microsoft page`)
    assert.doesNotMatch(g.learn.url, /blog|medium|github\.io/, `${g.id}: not a vendor blog`)
  }
  // The panel offers the link and does not write the address itself.
  const src = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.match(src, /href=\{guide\.learn\.url\}/, 'the link is the content file\'s')
})

// ---- J. no new authority, and no way to write ----------------------------------

test('remediation changes no rung, no proof, no group and no emergency-access classification', () => {
  for (const name of TENANTS) {
    const f = fixture(name)
    const before = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    // Ask for every remediation, every guide and every copy: none of it touches
    // the evidence, because none of it is evidence.
    for (const row of before.rows) {
      const r = remediationFor(row.group, row)
      for (const id of guidesOf(r)) guideText(id)
    }
    const after = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    assert.deepEqual(
      after.rows.map((r) => [r.user.id, r.rung, r.group, r.active, r.kind]),
      before.rows.map((r) => [r.user.id, r.rung, r.group, r.active, r.kind]),
      `${name}: the evidence is unmoved`,
    )
    assert.deepEqual(after.groups, before.groups, `${name}: and so are the counts`)
    // A confirmed emergency-access account is not an employee passkey campaign
    // target and is offered no bulk remediation (task 001).
    for (const id of f.mapping.breakGlassUserIds) {
      const row = before.rows.find((x) => x.user.id === id)
      if (!row) continue
      assert.equal(row.kind, 'emergency', `${name}/${id}: still classified emergency access`)
      assert.equal(row.group, null)
      assert.deepEqual(guidesOf(remediationFor(row.group, row)), [], `${name}/${id}: no campaign guidance attached`)
    }
  }
})

test('the guidance layer reads the tenant and writes nothing', () => {
  const src = readFileSync('src/content/methodGuides.ts', 'utf8')
  // No Graph client, no store, no mutation: it is content and a lookup.
  assert.doesNotMatch(src, /graph\/|msal|fetch\(|idb|localStorage/, 'the guidance module reaches nothing outside the content file')
  const panel = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.doesNotMatch(panel, /POST|PATCH|DELETE|graphFetch/, 'the panel submits nothing to a tenant')
  // The one thing the panel does with a guide is put its text on the clipboard,
  // through the export guard every other copy goes through.
  assert.match(panel, /exportClipboard\(guideText\(guide\.id\), REDACTED\)/, 'the copy goes through the export guard')
  // And the guidance says what a person does in Microsoft's own portals, never
  // what IAMAI will do for them.
  for (const g of METHOD_GUIDES) assert.doesNotMatch(guideText(g.id), /IAMAI (issues|registers|creates|sets) (?!nothing)/, `${g.id}: IAMAI performs nothing`)
})

test('the panel says the target and the tenant prerequisite once, and not inside each guide', () => {
  assert.equal(PASSKEY_TARGET, MG.target)
  assert.equal(TENANT_PREREQUISITE, MG.prereq)
  // The one-line explanation lives outside the guides, so no guide carries a
  // "why passkeys matter" preamble of its own.
  for (const g of METHOD_GUIDES) {
    assert.ok(!g.lines.includes(PASSKEY_TARGET), `${g.id}: the target is stated once, above`)
    assert.ok(!g.lines.includes(TENANT_PREREQUISITE), `${g.id}: and so is the prerequisite`)
  }
  // The surface renders both once, above the choices.
  const src = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.equal(src.split('PASSKEY_TARGET').length - 1, 2, 'imported and rendered once')
  assert.equal(src.split('TENANT_PREREQUISITE').length - 1, 2)
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
