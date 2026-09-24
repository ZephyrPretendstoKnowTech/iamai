// Cycle 2 (C02, C06): a correction keeps the policy's state and the script is called.
//
// Ten policy packages corrected an existing policy by first PATCHing an enabled one
// to Report-only (`StageForCorrection`), refused any access-affecting correction
// while it was On, and drew the script as a bare template nothing called. An
// operator following them turned off enforcement to fix an exclusion. The script is
// now invoked with IAMAI's whole target and the policy it corrects, the state is
// never written by a correction, and every channel says what saving does to a
// policy that is On. Body and call lines are read together.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { CHANGED_FIELDS_BINDING } from './protocol.ts'
import { projectImplementation } from './project.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
/** Sample ids, never a tenant's. */
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const TARGET = { displayName: "Sample - O'Brien policy", conditions: { users: { includeUsers: ['All'], excludeGroups: [ID(1)] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['block'] }, sessionControls: null }
const LITERAL = `'${JSON.stringify(TARGET).replaceAll("'", "''")}'`

const bindings = (extra: Record<string, unknown>): Record<string, unknown> => ({
  'policy.target.displayName': TARGET.displayName,
  'policy.target.conditions': TARGET.conditions,
  'policy.target.grantControls': TARGET.grantControls,
  'policy.target.sessionControls': TARGET.sessionControls,
  'policy.target.excludeGroups': [ID(1)],
  'policy.target.json': JSON.stringify(TARGET),
  'policy.target.mode': 'blockOutsideTrusted',
  'policy.current.id': ID(3),
  'policy.current.displayName': 'Sample - tenant policy',
  'policy.current.state': 'enabled',
  'policy.current.semanticMismatches': ['conditions.users.excludeGroups'],
  'intune.compliance.prerequisiteState': 'satisfied',
  ...extra,
})

const STAGED = ['s-goal-admin-session', 's-goal-azure-management-mfa', 's-goal-block-auth-transfer', 's-goal-block-device-code', 's-goal-block-legacy-auth', 's-goal-block-unsupported-platforms', 's-goal-geo-restriction', 's-goal-mobile-app-protection', 's-goal-register-info-protected', 's-goal-require-managed-device']
const CORRECTIONS: [string, string][] = [
  ['conditions.users.excludeGroups', 'CorrectConditions'],
  ['grantControls.builtInControls', 'CorrectGrant'],
  ['sessionControls.signInFrequency', 'CorrectSession'],
]
/** Wording that moves an enabled policy out of enforcement to correct it. */
const STAGING = /Report-only\*{0,2} (first|before)|StageForCorrection|stage (an enabled|the same) policy|switch it to Report-only|leave it On/i

const callsOf = (text: string): string[] => text.split('\n').filter((l) => l.startsWith('Invoke-IAMAIStep '))

test('no staged package has a staging mode, and its script writes the policy state only in Create (Report-only) and Enforce', () => {
  for (const stepId of STAGED) {
    const script = PACKAGES[stepId].blocks['powershell.run']
    assert.equal(script.meta.kind, 'deployableAfterBinding', stepId)
    assert.doesNotMatch(script.text, /StageForCorrection|Refusing access-affecting/, stepId)
    const stateWrites = [...script.text.matchAll(/state='([A-Za-z]+)'/g)].map((m) => m[1])
    // The Create body sets Report-only; Enforce sets enabled after its own checks. Nothing else touches state.
    assert.deepEqual(stateWrites, ['enabledForReportingButNotEnforced', 'enabled'], stepId)
    // `description` carries the plan tag IAMAI recognises its own work by, and it
    // sits between the name and the state in the create body.
    assert.match(script.text, /if\(\$Mode -eq 'Create'\)\{\n? *\$body=\[ordered\]@\{displayName=\$target\.displayName;description=\$target\.description;state='enabledForReportingButNotEnforced'/, stepId)
  }
})

test('every staged correction is one call bound to the target and the policy, and no channel stages the policy to correct it', () => {
  for (const stepId of STAGED) {
    for (const [changed, mode] of CORRECTIONS) {
      const where = `${stepId} ${mode}`
      const p = projectImplementation(PACKAGES[stepId], 'partial', bindings({ [CHANGED_FIELDS_BINDING]: [changed] }))
      const ps = p.channels.find((c) => c.channel === 'powershell')
      assert.ok(ps, `${where}: ${JSON.stringify(p.hold)} ${JSON.stringify(p.degraded ?? null)}`)
      assert.deepEqual(ps.runs.map((r) => r.mode), [mode], where)
      const calls = callsOf(ps.text)
      assert.equal(calls.length, 1, `${where}: ${ps.text.slice(-400)}`)
      assert.ok(calls[0].startsWith(`Invoke-IAMAIStep -Mode '${mode}' `), calls[0])
      assert.ok(calls[0].includes(`-TargetPolicyJson ${LITERAL}`), calls[0])
      assert.ok(calls[0].includes(`-PolicyId '${ID(3)}'`), calls[0])
      // The call is the last thing in the artifact, after the whole function body.
      assert.ok(ps.text.startsWith('function Invoke-IAMAIStep {\nparam('), ps.text.slice(0, 80))
      assert.ok(ps.text.trimEnd().endsWith(calls[0]), where)
      assert.doesNotMatch(ps.text, STAGING, where)
      for (const channel of ['entra', 'aiInfo']) {
        const c = p.channels.find((x) => x.channel === channel)
        if (c) assert.doesNotMatch(c.text, STAGING, `${where} ${channel}: ${c.text}`)
      }
    }
  }
})

test("every staged package calls Create and Observe, and Enforce only where the script's readiness switch can be passed", () => {
  for (const stepId of STAGED) {
    const pkg = PACKAGES[stepId]
    const created = projectImplementation(pkg, 'missing', bindings({}))
    const create = created.channels.find((c) => c.channel === 'powershell')
    assert.ok(create, `${stepId}: ${JSON.stringify(created.degraded ?? created.hold)}`)
    assert.deepEqual(callsOf(create.text), [`Invoke-IAMAIStep -Mode 'Create' -TargetPolicyJson ${LITERAL}`], stepId)
    const observed = projectImplementation(pkg, 'reportOnly', bindings({}))
    const observe = observed.channels.find((c) => c.channel === 'powershell')
    assert.ok(observe, `${stepId}: ${JSON.stringify(observed.degraded ?? observed.hold)}`)
    assert.deepEqual(callsOf(observe.text), [`Invoke-IAMAIStep -Mode 'Observe' -TargetPolicyJson ${LITERAL} -PolicyId '${ID(3)}'`], stepId)
    const needsApproval = /\[switch\]\$ReadinessApproved/.test(pkg.blocks['powershell.run'].text)
    assert.equal(typeof pkg.blocks['powershell.run'].meta.invocation?.withheldModes?.Enforce === 'string', needsApproval, stepId)
    const enforced = projectImplementation(pkg, 'readyToEnforce', bindings({}))
    const enforce = enforced.channels.find((c) => c.channel === 'powershell')
    if (needsApproval) assert.equal(enforce, undefined, `${stepId}: an Enforce call without -ReadinessApproved would throw`)
    else {
      assert.ok(enforce, `${stepId}: ${JSON.stringify(enforced.degraded ?? enforced.hold)}`)
      assert.deepEqual(callsOf(enforce.text), [`Invoke-IAMAIStep -Mode 'Enforce' -TargetPolicyJson ${LITERAL} -PolicyId '${ID(3)}'`], stepId)
    }
  }
})

// Cycle 3 (review 2): the effect check accepted "Leave **Enable policy** as it is", which
// states no effect, and never read AI Info. Every correction now has to say, in Entra and
// in AI Info, what saving does to a policy that is On — the ten packages above and the two
// (mfa-all-users, admins-phishing-resistant) whose corrections already kept the state.
// Editorial batch C: the shared correction sentence ("If it is On, the changed rule can affect access after you save.") states the effect too.
// Review 3 queue 5: the guests pair's correction adds the exclusions group to both guest
// policies and said only "Save." twice. Its script is not called yet, so the check reads
// the two authored blocks the partial state projects rather than a bound projection.
const AI_LEADS_WITH_ACTION = new Set(['s-goal-block-device-code', 's-goal-block-legacy-auth', 's-goal-mfa-all-users', 's-goal-admins-phishing-resistant'])
const EFFECT = /\bif (it|the policy|a policy) is On, [^.]*(as soon as (you save|it is saved)|saving applies it at once|can affect access after you save)/i

test('every correction says in Entra and in AI Info what saving does to a policy that is On, the guests pair included', () => {
  for (const stepId of [...STAGED, 's-goal-mfa-all-users', 's-goal-admins-phishing-resistant']) {
    for (const [changed, mode] of CORRECTIONS) {
      const p = projectImplementation(PACKAGES[stepId], 'partial', bindings({ [CHANGED_FIELDS_BINDING]: [changed], 'authStrength.target.id': ID(4) }))
      // AI Info on the four 4.x policy steps leads with the action and its values
      // (walk list 4.x item 31); their Entra lines say what saving does.
      for (const channel of AI_LEADS_WITH_ACTION.has(stepId) ? ['entra'] : ['entra', 'aiInfo']) {
        const c = p.channels.find((x) => x.channel === channel)
        assert.ok(c, `${stepId} ${mode}: no ${channel} ${JSON.stringify(p.degraded ?? p.hold)}`)
        assert.match(c.text, EFFECT, `${stepId} ${mode} ${channel}: ${c.text}`)
      }
    }
  }
  const blocks = PACKAGES['s-goal-guests-mfa'].blocks
  const entra = blocks['entra.correct-pair'].text
  const saves = entra.split('\n').filter((l) => /^\d+\. Save\b/.test(l))
  assert.equal(saves.length, 2, entra)
  for (const line of saves) assert.match(line, EFFECT, line)
  assert.match(blocks['ai.correct'].text, EFFECT)
})

test('a target short of the whole policy withholds only the script', () => {
  const { ['policy.target.json']: _none, ...short } = bindings({})
  const p = projectImplementation(PACKAGES['s-goal-block-legacy-auth'], 'missing', short)
  assert.equal(p.channels.some((c) => c.channel === 'powershell'), false)
  assert.ok(p.channels.some((c) => c.channel === 'entra'))
  assert.deepEqual(p.degraded?.map((d) => [d.channel, d.missingBindings]), [['powershell', ['policy.target.json']]])
})
