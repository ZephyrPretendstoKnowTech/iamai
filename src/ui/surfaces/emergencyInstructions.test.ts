// Every Implementation Task of the four Establish Emergency Access steps, in
// every fixture: one opening shape, each value and account named in the step
// that uses it, and none of the vague stand-ins the fact blocks used to cover.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepBodyOf } from './stepBody.ts'
import { emergencyTaskSteps } from './emergencyAccountTasks.ts'
import type { EmergencyAccountTask } from './emergencyAccountTasks.ts'
import { emergencyVerificationTasksOf } from './emergencyVerificationTasks.ts'
import type { StepVarContext } from './stepVars.ts'
import { affectedPasskeysByProposedChange, REGISTERED_METHODS_UNREAD } from '../../roadmap/passkeyCompatibility.ts'

const ENTRA = 'Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **'
const KEEP = 'Keep your working administrator session open.'

function profileTenant(): Fixture {
  const value = structuredClone(fixture('demo'))
  const current = { id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, defaultPasskeyProfile: 'default', includeTargets: [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: ['default'] }], excludeTargets: [],
    passkeyProfiles: [{ id: 'default', name: 'Default passkey profile', passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'registrationOnly', keyRestrictions: { isEnforced: false, enforcementType: 'block', aaGuids: [] } }] }
  value.snapshot.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ authenticationMethodConfigurations: [current] }] }
  return value
}

const CASES: [string, () => Fixture][] = [
  ['demo', () => structuredClone(fixture('demo'))],
  ['demo-week2', () => structuredClone(fixture('demo-week2'))],
  ['small', () => structuredClone(fixture('small'))],
  ['no exclusions answer', () => noExclusionsAnswer(fixture('small'))],
  ['passkey profile', profileTenant],
  // Both emergency accounts without a passkey, a new tenant's usual case. No
  // fixture reached it, and the passkey procedure there merged the session
  // reminder into its account list and ended "for each account listed above".
  ['both accounts need a passkey', () => {
    const value = structuredClone(fixture('demo-week2'))
    for (const id of value.mapping.breakGlassUserIds) value.snapshot.authMethods[id] = []
    return value
  }],
]

/** Each step's tasks, as ContentStep and CleanupStep project them. */
function tasksOf(value: Fixture): Map<string, EmergencyAccountTask[]> {
  const run = runFixture(value)
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const out = new Map<string, EmergencyAccountTask[]>()
  for (const id of ['s-prereq-break-glass', 's-prereq-exclusion-group', 's-prereq-passkey-settings']) {
    const step = run.steps.find(row => row.id === id)
    if (step) out.set(id, stepBodyOf(step, ctx).emergencyAccountTasks?.tasks ?? [])
  }
  if (run.schedule.cleanup) out.set('cleanup-drill', emergencyVerificationTasksOf(run.schedule.cleanup).tasks)
  return out
}

/** Every rendering of a task: each method variant, or the task itself. */
const renderings = (task: EmergencyAccountTask): string[][] => (task.variants?.length ? task.variants.map(variant => variant.id) : [null]).map(variant => emergencyTaskSteps(task, variant))

test('every emergency task opens the same way and says nothing vague', () => {
  for (const [name, make] of CASES) {
    for (const [stepId, tasks] of tasksOf(make())) {
      assert.equal(tasks.length > 0, true, `${name} ${stepId} has tasks`)
      for (const task of tasks) for (const steps of renderings(task)) {
        const where = `${name} · ${stepId} · ${task.title}`
        const text = steps.join('\n')
        // The Entra admin center is always the linked opening, never a variant of it.
        for (const line of steps) if (/^Open .*Microsoft Entra admin center.*\*\*Entra ID/.test(line)) assert.ok(line.startsWith(ENTRA), `${where}: "${line}"`)
        // A working-session reminder is its own first step, never merged into another.
        assert.ok(!steps.some(line => line.startsWith(KEEP) && line !== KEEP), `${where}: merged session reminder`)
        if (steps.includes(KEEP)) assert.equal(steps[0], KEEP, `${where}: the reminder leads`)
        // No reference to a fact block, no conditional the scan already answered, no stand-in for a known name.
        assert.doesNotMatch(text, /values above|listed above|shown above|For a legacy configuration|For an identified|the intended policy|established correction|IAMAI discovered|in the intended tenant|Keep the working/, where)
        // One bold run per portal path.
        assert.doesNotMatch(text, /\*\* → \*\*/, `${where}: split path`)
      }
    }
  }
})

test('Step 1: configuring an existing account names the account and only the change it needs', () => {
  const value = structuredClone(fixture('demo-week2'))
  const [first, second] = value.mapping.breakGlassUserIds
  const user = value.snapshot.users.find(row => row.id === first)!
  user.userPrincipalName = 'emergency@example.com'
  const steps = tasksOf(value).get('s-prereq-break-glass')!.find(task => task.id === 'configure-account')!.steps
  const text = steps.join('\n')
  assert.ok(steps.some(line => line.startsWith('Open **emergency@example.com**, select **Properties → Edit properties**')), text)
  assert.doesNotMatch(text, /No selected account currently needs configuration|Account enabled|Global Administrator → Add assignments/)
  assert.ok(!text.includes(value.snapshot.users.find(row => row.id === second)!.userPrincipalName!))
})

// NEW-Nadia-D12. The configuration procedure said it was not needed and the
// create procedure never did: with two verified accounts selected, the printed
// plan and the task list offered "Create an emergency account" as work beside
// the one task that remained. It says so where the selection holds two or more
// accounts, every one read as cloud-only — and nowhere a new account is needed.
test('Step 2: nothing wrong reads as nothing to change, with the group named', () => {
  const tasks = tasksOf(structuredClone(fixture('demo-week2'))).get('s-prereq-exclusion-group')!
  const membership = tasks.find(task => task.id === 'manage-emergency-membership')!.steps
  assert.ok(membership.includes('No membership change is needed.'))
  const exclusions = tasks.find(task => task.id === 'configure-policy-exclusions')!.steps
  assert.ok(exclusions.some(line => /^Every policy that must exclude \*\*.+\*\* already does\. To add it to another policy:$/.test(line)), exclusions.join('\n'))
})

test('Step 3: review uses the portal’s field names; affected accounts are named; registration changes are inline', () => {
  const legacy = tasksOf(structuredClone(fixture('small'))).get('s-prereq-passkey-settings')!
  const review = legacy.find(task => task.id === 'inspect-passkey-settings')!.steps
  assert.ok(review.includes('Check **Enforce attestation**: No → Yes.'), review.join('\n'))
  assert.ok(review.includes('Check **Restrict specific keys**: Block → Allow.'))
  const profile = tasksOf(profileTenant()).get('s-prereq-passkey-settings')!
  const profileReview = profile.find(task => task.id === 'inspect-passkey-settings')!.steps
  assert.ok(profileReview.includes('Check **Behavior**: Block → Allow.'), profileReview.join('\n'))

  const value = structuredClone(fixture('small'))
  const row = value.snapshot.config.authMethodsPolicy.rows[0] as Record<string, any>
  const fido = row.fido2Configuration ?? row.authenticationMethodConfigurations.find((c: Record<string, unknown>) => String(c.id).toLowerCase() === 'fido2')
  fido.isSelfServiceRegistrationAllowed = false
  const registration = tasksOf(value).get('s-prereq-passkey-settings')!.find(task => task.id === 'make-passkey-registration-available')!.steps
  assert.deepEqual(registration.slice(0, 2), [`${ENTRA}Entra ID → Authentication methods → Policies → Passkey (FIDO2) → Enable and target**.`, 'Set **Allow self-service set up** to **Yes**.'])
  assert.ok(registration.includes('Preserve unrelated inclusions and exclusions. Select **Save**.'))
})

test('Step 3: affected passkeys name the accounts to prepare', () => {
  for (const [, make] of CASES) {
    const value = make()
    const run = runFixture(value)
    const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
    const step = run.steps.find(row => row.id === 's-prereq-passkey-settings')
    if (!step) continue
    const task = stepBodyOf(step, ctx).emergencyAccountTasks!.tasks.find(row => row.id === 'prepare-affected-passkeys')!
    const projection = affectedPasskeysByProposedChange(value.snapshot, value.mapping, value.groups)
    // Whatever it names from what was read, it says where that is not everything:
    // demo withholds the restrictions over one account while another account's
    // registered methods were not read, and the line said nothing of that.
    const also = / Some users’ registered authentication methods were not readable\. The planned settings may stop passkeys on those accounts too\.$/
    const named = task.required || /could not tell whether the planned settings affect/.test(task.steps[0])
    if (named) assert.equal(also.test(task.steps[0]), projection.coverage.includes(REGISTERED_METHODS_UNREAD), task.steps[0])
    const first = named ? task.steps[0].replace(also, '') : task.steps[0]
    // Or the accounts the allow list would leave without a passkey it allows,
    // named, with what each keeps — or why the restrictions are withheld
    // (roadmap/passkeyRestrictions.ts; Jordan D13). Either way, by name.
    if (task.required) assert.match(first, /^Keep the existing working method available while preparing each affected account: \*\*.+\*\*\.$|would stop the passkeys on [0-9,]+ accounts?, or IAMAI could not judge them: \*\*|Key restrictions stay off for now: they would lock out [0-9,]+ accounts? — \*\*|The passkey settings are applied\. IAMAI could not judge the passkeys on [0-9,]+ accounts?: \*\*/)
    // Three readings, not two. "Could not judge" is not "not affected", and
    // saying the second over the first is an unhedged all-clear before a change
    // that enforces attestation and a model allow-list: on one tenant it was
    // said over thirty-five accounts whose key model the scan had never read,
    // four lines under a tile saying "Existing passkeys affected · Could not
    // verify".
    else if (/could not tell whether the planned settings affect/.test(first)) assert.match(first, /passkeys on [0-9]+ accounts?, because it could not read their key model/)
    // Nor is nobody found affected in what was read an all-clear where not
    // everything was read: demo-week2 holds an account whose registered methods
    // were not read, and the task said "No existing passkey is affected" there
    // under a tile reading "Could not verify". It says what it did not read.
    else if (projection.state !== 'known') assert.match(first, /^IAMAI could not tell whether the planned settings stop any existing passkey\. .*(could not be compared exactly|were not readable)\./)
    else assert.equal(first, 'No existing passkey is affected by the planned settings. Keep the existing working method available while preparing an account.')
  }
})

test('Step 4: a verified account reads its sign-in time once; a completed step says so in its rail', async () => {
  const { readFileSync } = await import('node:fs')
  const journey = readFileSync('src/roadmap/emergencyJourney.ts', 'utf8')
  assert.match(journey, /const value = current \? verifiedAt!/)
  assert.doesNotMatch(journey, /Signed in after configuration/)
  const cleanup = readFileSync('src/ui/surfaces/CleanupStep.tsx', 'utf8')
  assert.match(cleanup, /sub: row\.done \? 'Every selected account is verified\.' : 'Verify every selected account after the final configuration is observed\.'/)
})

test('Step 2 Entra text lists each policy missing the group exclusion by name (foundation audit A1)', async () => {
  const { emergencyImplementation } = await import('./emergencyImplementation.ts')
  let listed = 0
  for (const [name, make] of CASES) {
    const value = make()
    const run = runFixture(value)
    const step = run.steps.find(row => row.id === 's-prereq-exclusion-group')
    if (!step) continue
    const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
    const text = emergencyImplementation(step, ctx) ?? ''
    const missing = (step.configurationFindings ?? []).find(f => f.key === 'group-policies')?.items?.filter(i => i.label === 'Group exclusion' && i.outcome !== 'pass') ?? []
    assert.doesNotMatch(text, /^- (Mode|Group exclusion) — /m, `${name}: a bullet names the check, not the policy`)
    for (const item of missing) {
      assert.ok(text.includes(`${item.subjectLabel} — `), `${name}: ${item.subjectLabel} is not listed`)
      listed++
    }
  }
  assert.ok(listed > 0, 'no case has a policy missing the group exclusion: the premise is untested')
})
