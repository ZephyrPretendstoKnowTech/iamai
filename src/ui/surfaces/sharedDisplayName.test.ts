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

test('the premise: getiamai holds a member and a guest named Kai Brown, and the member is an admin not yet ready', () => {
  assert.equal(kai.length, 2)
  assert.ok(member && guest)
  assert.ok(r.steps.some((s) => s.id === 's-verify-mfa'))
})

test('Prepare Your Team for MFA names the Kai Brown it means by the account a person can find', () => {
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
