import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { HEAD } from './stepHeadings.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { manualEvidenceLines, stepExportView } from './stepExport.ts'
import { stepBodyOf } from './stepBody.ts'
import { planDates } from './stepVars.ts'
import { emailResource, inspectionResource, namedPortalResource } from './stepResources.ts'
import { QUESTION_STEP, answerKey, questionLabels } from '../../roadmap/answers.ts'

/** A shipped tenant's plan and step bodies, with any answers saved on top of its own. */
function opened(name: 'demo' | 'demo-week2' | 'mid', answers: Record<string, string> = {}) {
  const base = fixture(name)
  const f = { ...base, mapping: { ...base.mapping, questionAnswers: { ...(base.mapping.questionAnswers ?? {}), ...answers } } }
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
  return { r, ctx, bodies: new Map(r.steps.map(step => [step.id, stepBodyOf(step, ctx)])) }
}

test('held and completed tasks retain useful copyable resources without placeholder formats or disclaimer banners', () => {
  for (const name of ['demo', 'mid'] as const) {
    const { bodies } = opened(name)
    for (const [id, body] of bodies) {
      assert.equal(body.previewNote, null, id)
      for (const a of body.artifacts) {
        assert.notEqual(a.unavailable, true, `${id}/${a.id}`)
        if (a.id === 'portal' || a.id === 'ps' || a.id === 'json') assert.doesNotMatch(a.text(), /‹[^›]+›/, `${id}/${a.id}: unresolved internal binding`)
        if (a.id === 'portal') assert.doesNotMatch(a.text(), /(?:find it by ID|search by its ID) in Plan settings/, id)
        assert.ok(a.text().trim().length > 20, `${id}/${a.id}`)
        assert.doesNotMatch(a.text(), /This format has no output|This channel is not available|You can copy this guidance|Contains tenant context\. Review before sharing/, `${id}/${a.id}`)
      }
    }
    const emergency = bodies.get('s-prereq-break-glass')!
    assert.ok(emergency.artifacts.some(a => a.id === 'ps'))
    assert.ok(emergency.artifacts.some(a => a.id === 'json'))
    assert.equal(emergency.artifacts.some(a => a.id === 'email'), false)
  }
})

test('guest vendor email is substantive and does not disclose the whole guest directory', () => {
  const { r, ctx } = opened('mid')
  const step = r.steps.find(s => s.id === 's-goal-guests-mfa')!
  const text = emailResource(step, ctx, 'MFA for guests').text()
  assert.match(text, /Subject: Upcoming Guest MFA Requirements/)
  assert.match(text, /coordinate a test/)
  assert.doesNotMatch(text, /Guest accounts in this tenant:/)
})

test('fallback JSON is labelled actual read-only inspection, never a guessed mutation', () => {
  const { r } = opened('demo')
  const step = r.steps.find(s => s.id === 's-prereq-break-glass')!
  const resource = inspectionResource(step, 'json')
  assert.match(resource.note!, /read-only GET requests/)
  const data = JSON.parse(resource.text())
  assert.ok(data.requests.length > 0)
  assert.ok(data.requests.every((r: { method: string }) => r.method === 'GET'))
})

test('MFA preparation retains useful campaign guidance and audience emails without an invented campaign target', () => {
  const body = opened('demo').bodies.get('s-verify-mfa')!
  assert.equal(body.title, 'Prepare Your Team for MFA')
  assert.match(body.artifacts.find(a => a.id === 'portal')!.text(), /Registration campaign/)
  assert.match(body.artifacts.find(a => a.id === 'email')!.text(), /Administrator message/)
  assert.equal(body.artifacts.some(a => a.id === 'json'), false)
  assert.doesNotMatch(body.artifacts.find(a => a.id === 'ps')!.text(), /-Method PATCH/)
})

test('a policy ID in portal instructions includes its actual tenant name', () => {
  const { ctx } = opened('mid')
  const p = ctx.snapshot.config.caPolicies.rows.find(raw => Boolean((raw as { id?: string; displayName?: string }).id && (raw as { displayName?: string }).displayName)) as { id: string; displayName: string }
  const a = namedPortalResource({ id: 'portal', form: 'list', lines: [`Open policy ID ${p.id}.`], text: () => `Open policy ID ${p.id}.`, note: null }, ctx)
  assert.ok(a.text().includes(p.displayName))
  assert.ok(a.text().includes(p.id))
})

test('team export preserves historical manual outcomes with named accounts and no completion upgrade', () => {
  const { r, ctx } = opened('demo')
  const step = structuredClone(r.steps.find(s => s.id === 's-prereq-break-glass')!)
  const id = ctx.snapshot.users[0].id
  step.manualReview = { basis: 'new', confirmedAt: null, readyToConfirm: true, verification: 'changed', record: { at: '2026-09-14', basis: 'old', outcome: 'passed', accountIds: [id], workflow: 'Guest sign-in', testedAt: '2026-09-13', reference: 'CHG-10', exceptionRemoved: false } }
  const text = manualEvidenceLines(step, ctx).join('\n')
  assert.match(text, /Configuration changed; review needed/)
  assert.ok(text.includes(ctx.nameOf(id)))
  assert.match(text, /Outcome: Successful/)
  assert.match(text, /Temporary exception removed: No/)
  assert.match(text, /CHG-10/)
  assert.equal(step.manualReview.confirmedAt, null)
})


test('readable manual evidence includes scoped context, named network and prerequisite confirmation', () => {
  const { r, ctx } = opened('demo')
  const step = structuredClone(r.steps[0])
  step.manualReview = { basis: 'current', confirmedAt: '2026-09-14', readyToConfirm: true, verification: 'current', fields: [
    { key: 'contextId', label: 'Authentication Context', type: 'text', required: true },
    { key: 'networkId', label: 'Named Network Tested', type: 'select', required: true, options: [{ value: 'network-id', label: 'Office' }] },
    { key: 'configurationVerified', label: 'Recovery Prerequisites Verified', type: 'checkbox', required: true },
  ], record: { at: '2026-09-14', basis: 'current', contextId: 'c1', networkId: 'network-id', configurationVerified: false } }
  const text = manualEvidenceLines(step, ctx).join('\n')
  assert.match(text, /Authentication Context: c1/)
  assert.match(text, /Named Network Tested: Office \(network-id\)/)
  assert.match(text, /Recovery Prerequisites Verified: No/)
})

test('Inforcer has specific copyable app guidance and owner communication without Azure-management content', () => {
  const f = fixture('demo')
  f.mapping.workflowAnswers = { ...(f.mapping.workflowAnswers ?? {}), inforcer: 'yes' }
  f.mapping.facetOverrides.inforcer = { on: true, reason: 'confirmed in use' }
  f.mapping.workflowConfirmedAt = f.snapshot.asOf
  f.snapshot.appSignInSummary.push({ appId: '708861da-226e-4d65-a57a-24128df64524', signInCount: 1 })
  const r = runFixture(f)
  const step = r.steps.find(s => s.id === 's-goal-inforcer-mfa')!
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const body = stepBodyOf(step, ctx)
  assert.equal(body.title, 'Require MFA for Inforcer Access')
  const portal = body.artifacts.find(a => a.id === 'portal')!
  assert.match(portal.text(), /708861da-226e-4d65-a57a-24128df64524/)
  assert.match(body.artifacts.find(a => a.id === 'email')!.text(), /unattended job/)
  for (const artifact of body.artifacts) {
    assert.ok(artifact.text().length > 30)
    assert.doesNotMatch(artifact.text(), /Azure management|Azure portal|CLI|This format has no output/)
  }
})

test('legacy inventory and app-password owner emails describe the concrete coordination work', () => {
  const { r, ctx } = opened('demo')
  const legacy = emailResource({ ...r.steps[0], id: 's-ladder-legacy-auth-inventory' }, ctx, '').text()
  const passwords = emailResource({ ...r.steps[0], id: 's-ladder-app-passwords' }, ctx, '').text()
  assert.match(legacy, /actual protocol.*infrequent run schedules.*test window/)
  assert.match(passwords, /supported replacement.*removing the old credential/)
})


test('session email speaks to affected users; admin-only and undefined emails are absent', () => {
  const { bodies } = opened('demo')
  const session = bodies.get('s-goal-all-users-no-persistence')!
  const email = session.artifacts.find(a => a.id === 'email')!
  assert.match(email.text(), /sign in again when you reopen your browser/)
  assert.doesNotMatch(email.text(), /Accounts to review|We are reviewing limit|test or change window/)
  for (const id of ['s-goal-admin-session', 's-prereq-auth-strength']) assert.equal(bodies.get(id)!.artifacts.some(a => a.id === 'email'), false)
})

// Verify the delivered artifact, not only the view-model instructions.
test('removed workflow forms do not leave recording instructions in copied guidance', () => {
  const { bodies } = opened('demo')
  for (const id of ['s-goal-block-auth-transfer', 's-goal-token-protection']) {
    const body = bodies.get(id)!
    assert.ok(body, id)
    for (const artifact of body.artifacts) assert.doesNotMatch(artifact.text(), /Verify the workflow:|Record the account, application\/device path, date and result/)
  }
})

// A step whose target the engine resolves to no operation — already enforced, or
// unresolvable — still drew the portal channel, and its instruction sent the
// operator to compare the tenant's policies "with the configuration listed on this
// step". Such a step lists no configuration: its JSON is a read-only GET and its
// Implementation section says nothing is generated. The instruction pointed at
// nothing, and the five administrators put the step down rather than guess.
test('a read-only policy instruction names the matched policy and the criteria it is checked against, never an absent listing', () => {
  for (const name of ['demo-week2', 'mid'] as const) {
    const { r, bodies } = opened(name)
    let checked = 0
    for (const [id, body] of bodies) {
      const portal = body.artifacts.find(a => a.id === 'portal')
      if (!portal) continue
      const text = portal.text()
      assert.doesNotMatch(text, /configuration listed on this step/, id)
      const step = r.steps.find(x => x.id === id)!
      const matched = (step.tracking?.members ?? []).filter(m => m.policyName)
      if (!/the policy IAMAI matched to this step/.test(text)) continue
      checked++
      assert.ok(matched.length > 0, id)
      for (const m of matched) {
        assert.ok(text.includes(m.policyName!), `${id}: ${m.policyName} is not named`)
        assert.ok(m.policyId === null || text.includes(m.policyId), `${id}: ${m.policyId} is not named`)
      }
      assert.match(text, /Completion Criteria on this step/, id)
    }
    assert.ok(checked > 0, `${name}: no step reached the read-only instruction`)
  }
})

// The other half: a step with nothing matched cannot name a policy, so it asks for
// a review of the policies that affect it and points nowhere.
test('a read-only policy instruction with nothing matched asks for a review and claims no listing', () => {
  const { r, bodies } = opened('demo')
  const step = r.steps.find(x => x.id === 's-goal-admin-portals-protected')!
  assert.equal((step.tracking?.members ?? []).filter(m => m.policyName).length, 0)
  const text = bodies.get(step.id)!.artifacts.find(a => a.id === 'portal')!.text()
  assert.match(text, /Review the policies that affect Block the Admin Portals for Non-Admins: their assignments, conditions, access controls and current state./)
  assert.doesNotMatch(text, /listed on this step|matched to this step/)
})

// R4-29 (Marcus D10), third part. With "None" saved for "Does anyone use device
// code sign-in for CLI tools, IoT devices, or display-limited devices?", the
// step's workflow check still opened on "Identify the legitimate tools or devices
// using device code. Move each required workflow…" as if nothing had been
// answered: the saved answer reached the lane's condition (planLanes.ts) and
// nothing the person reads. The check says what they recorded now.
//
// The check itself stays, on every answer. The decision's own effect line asks
// for None once each workflow has been moved off device code, so None is also
// the answer saved when there ARE moved workflows to test; and a quiet
// device-code report can miss infrequent use. Dropping the check on None would
// take away the one test of the answer before the block stops what it missed.
test('a saved None on the device code decision is stated in the workflow check, which still checks it', () => {
  const DC = QUESTION_STEP.deviceCode
  const key = answerKey(DC, questionLabels(DC).decision!)
  const LEAD = 'You recorded that nothing uses device code sign-in.'
  for (const [option, stated] of [[null, false], ['None', true], ['Yes', false]] as const) {
    const { r, ctx, bodies } = opened('mid', option === null ? {} : { [key]: option })
    const portal = bodies.get(DC)?.artifacts.find(a => a.id === 'portal')?.text() ?? ''
    const exported = stepExportView(r.steps.find(s => s.id === DC)!, ctx).whatToDo.join('\n')
    for (const [where, text] of [['portal', portal], ['export', exported]] as const) {
      assert.equal(text.includes(LEAD), stated, `${option ?? 'unsaved'} / ${where}: ${text}`)
      assert.match(text, /Move each required workflow to an alternative supported by that tool/, `${option ?? 'unsaved'} / ${where}: the check itself is gone`)
    }
  }
})

// The heading over those checks was an English literal in stepResources.ts,
// written on the line d081ad8a rewrote, directly above the content-keyed lead.
// It reads the step's headings now, the one place a section title is written.
test('the workflow checks are headed by the headings\' own line, never a literal in the code', () => {
  const { bodies } = opened('mid')
  const portal = bodies.get(QUESTION_STEP.deviceCode)?.artifacts.find(a => a.id === 'portal')?.text() ?? ''
  assert.ok(portal.split('\n').includes(HEAD.verifyWorkflow), portal)
  assert.doesNotMatch(readFileSync('src/ui/surfaces/stepResources.ts', 'utf8'), /['"`]Verify the workflow:/)
})
