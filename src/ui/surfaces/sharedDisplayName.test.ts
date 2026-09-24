// Nadia §3 item 10 (persona round 4). getiamai holds two accounts named Kai Brown:
// an administrator (a member) and a guest. Prepare Your Team for MFA listed the
// admin as "Kai Brown" — "Admins not yet ready: Kai Brown." — and its AI Info
// "- Kai Brown", because the (guest) marker told the guest apart and left the
// member bare; the portal finds both accounts by that name. The dormant-account
// review named the guest "Kai Brown (user3@…)" by its own composition, without
// the marker the rest of the product gave it. Two conventions, and an
// administrator could not tell which Kai Brown to help register.
//
// One rule now (names.ts personLabels): every account whose display name another
// shares carries its sign-in address, a guest among them keeps its marker, and the
// account lists a package hands over read the same rule with the address always.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepBodyOf } from './stepBody.ts'
import { planDates } from './stepVars.ts'
import { packageBindings } from './stepPackage.ts'
import { stepContract } from './stepContract.ts'
import { handoffPreview } from './mfaHandoffPreview.ts'
import { scoredPeople } from '../../derive/mfaReadiness.ts'
import { stepMfaHold } from '../../derive/stepMfaReadiness.ts'
import { applyManualReviews } from '../../roadmap/manualWork.ts'
import type { Step } from '../../roadmap/types.ts'

const f = fixture('getiamai')
const r = runFixture(f, {}, null, f.snapshot.asOf)
const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
const kai = f.snapshot.users.filter((u) => u.displayName === 'Kai Brown')
const member = kai.find((u) => u.userType === 'member')!
const guest = kai.find((u) => u.userType === 'guest')!
const everyLine = (id: string): string[] => {
  const b = stepBodyOf(r.steps.find((s) => s.id === id)!, ctx)
  return [...b.artifacts.map((a) => a.text()), ...b.whoFull.flatMap((w) => [w.lead, ...w.names])].flatMap((t) => t.split('\n'))
}

test('Prepare Your Team for MFA names the Kai Brown it means by the account a person can find', () => {
  // The premise: getiamai holds a member and a guest named Kai Brown.
  assert.equal(kai.length, 2)
  assert.ok(member && guest)
  const lines = everyLine('s-verify-mfa')
  const named = lines.filter((l) => /Kai Brown/.test(l))
  assert.ok(named.length > 0, 'the admin is named on the step')
  for (const line of named) {
    assert.ok(line.includes(`Kai Brown (${member.userPrincipalName})`), `bare or wrong Kai Brown: ${line}`)
    assert.doesNotMatch(line, /Kai Brown(?! \()/, `a Kai Brown with nothing to tell which: ${line}`)
  }
})

test('the dormant-account review names the guest Kai Brown as every other surface does', () => {
  const step = r.steps.find((s) => s.id === 's-check-dormant-accounts')!
  const summary = String(packageBindings(step, ctx, stepContract(step, ctx))['people.affected.summary'])
  assert.ok(summary.includes(`Kai Brown (guest, ${guest.userPrincipalName})`), summary)
  assert.equal(r.input.names!.label(guest.id), `Kai Brown (guest, ${guest.userPrincipalName})`)
  // A name nobody shares keeps its address in an account list, as it always did.
  const alex = f.snapshot.users.find((u) => u.displayName === 'Alex Morgan')!
  assert.ok(summary.includes(`Alex Morgan (${alex.userPrincipalName})`), summary)
  for (const line of everyLine('s-check-dormant-accounts').filter((l) => /Kai Brown/.test(l))) assert.match(line, /Kai Brown \(guest, /, line)
})

// Review of Nadia §3 item 10. The rule reached the step text and the name
// directory, and other consumers still named a person `displayName ??
// userPrincipalName` on their own. The MFA handoff under the admin step
// previewed the administrator by the bare name, and under the MFA, admin portal,
// guest and device-registration steps previewed the guest the same way, without
// even its marker: which Kai Brown to help register, again. The account picker a
// separate-admin-accounts review is recorded with offered the bare name too, and
// ManualReviewForm draws an option with no second line; the per-user MFA finding
// listed the accounts still enabled by the bare name.
test('the MFA handoff, the review picker and the per-user MFA finding name a shared Kai Brown by the account', () => {
  const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
  const previewed = new Set<string>()
  for (const step of r.steps) {
    const hold = stepMfaHold(step, scored)
    if (!hold) continue
    for (const person of handoffPreview(step, hold.ids, f.snapshot)) {
      assert.notEqual(person.name, 'Kai Brown', `${step.id}: a bare Kai Brown in the handoff preview`)
      if (person.id === member.id) assert.equal(person.name, `Kai Brown (${member.userPrincipalName})`, step.id)
      if (person.id === guest.id) assert.equal(person.name, `Kai Brown (guest, ${guest.userPrincipalName})`, step.id)
      if (person.id === member.id || person.id === guest.id) previewed.add(step.id)
    }
  }
  // The premise: the admin step previews the member, three more preview the guest.
  // The admin-portal step no longer does: it is written from the pinned policy
  // (q-pin), whose source contradicts itself, so it hands over no MFA policy.
  assert.ok(previewed.has('s-goal-admins-phishing-resistant') && previewed.size >= 4, [...previewed].join(', '))

  const options = r.steps.flatMap((step) => (step.manualReview?.fields ?? []).flatMap((field) => (field.key === 'accountIds' ? (field.options ?? []) : [])))
  const kaiOptions = options.filter((o) => o.value === member.id || o.value === guest.id)
  assert.ok(kaiOptions.length > 0, 'the premise: a review picker offers a Kai Brown')
  for (const o of kaiOptions) assert.equal(o.label, r.input.names!.label(o.value), 'the picker names the account as the directory does')
  assert.ok(kaiOptions.every((o) => o.label !== 'Kai Brown'), kaiOptions.map((o) => o.label).join('; '))
  // A name nobody shares stays bare, as it always did.
  const alex = f.snapshot.users.find((u) => u.displayName === 'Alex Morgan')!
  for (const o of options.filter((x) => x.value === alex.id)) assert.equal(o.label, 'Alex Morgan')

  // The per-user MFA finding, with both accounts still enabled for per-user MFA.
  const perUser = structuredClone(r.steps.find((st) => st.id === 's-prereq-per-user-mfa')!) as Step
  const snapshot = { ...f.snapshot, perUserMfa: { [member.id]: { state: 'enabled' as const, reason: null }, [guest.id]: { state: 'enforced' as const, reason: null } } }
  applyManualReviews([perUser], snapshot)
  const detail = perUser.configurationFindings?.find((x) => x.key === 'per-user-mfa')?.detail ?? ''
  assert.ok(detail.includes(`Kai Brown (${member.userPrincipalName})`) && detail.includes(`Kai Brown (guest, ${guest.userPrincipalName})`), detail)
})
