// Cycle 5 (review 4 queue 3): the guests pair script reads both members' targets as one
// JSON value, and IAMAI binds it only when both members resolve whole. No curated or plain
// fixture resolves both (getiamai's guests goal resolves one create from its synthetic
// stand-in baseline), so the pair is built from getiamai's own resolved create, keyed to
// each pinned member exactly as Foundation A keys a member (observation.ts memberKeyOf).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { memberKeyOf } from '../../roadmap/observation.ts'
import type { PolicyOperation, Step } from '../../roadmap/types.ts'
import { implementationPackageFor, memberBindings } from './stepPackage.ts'

const f = fixture('getiamai')
const step = runFixture(f, {}, null, f.snapshot.asOf).steps.find((s) => s.id === 's-goal-guests-mfa') as Step
// Read from the package by its content entry: getiamai's own step resolves neither
// member, so the package is set aside for that step (stepPackage.ts resolvesNoMember;
// guestsPairSetAside.test.ts). The steps below, built with the members, reach it.
const members = (implementationPackageFor({ id: step.id, goalId: step.goalId })?.meta.baselineAuthority?.members ?? []) as { role: string; memberStableId: string }[]
const [create] = step.action.resolution!.policies as PolicyOperation[]

/** The step with one resolved create per named role, each a copy of the step's own create under that member's key. */
function withMembers(roles: readonly string[], missing: Step['action']['missing'] = []): Step {
  const policies = members.filter((m) => roles.includes(m.role)).map((m) => ({ ...create, memberKey: memberKeyOf(m.memberStableId, 0), body: { ...(create.body as Record<string, unknown>), displayName: `Sample ${m.role}` } }))
  return { ...step, action: { ...step.action, missing, resolution: { ...step.action.resolution!, policies } } } as Step
}

test('the premise: the pair package names a strong and a mixed member, and the step resolves a create with a whole body', () => {
  assert.deepEqual(members.map((m) => m.role).sort(), ['mixed', 'strong'])
  assert.equal(create.mode, 'create')
  assert.ok((create.body as { conditions?: unknown }).conditions)
})

test('both members resolved whole: the pair targets carry each role with its own name, conditions and grant', () => {
  const bound = memberBindings(withMembers(['strong', 'mixed']), f.snapshot)
  const json = bound['policies.guests.targets.json']
  assert.equal(typeof json, 'string', JSON.stringify(Object.keys(bound)))
  const targets = JSON.parse(json as string) as { role: string; displayName: string; conditions: unknown; grantControls: unknown }[]
  assert.deepEqual(targets.map((t) => [t.role, t.displayName]).sort(), [['mixed', 'Sample mixed'], ['strong', 'Sample strong']])
  const body = create.body as { conditions: unknown; grantControls?: unknown }
  for (const t of targets) {
    assert.deepEqual(t.conditions, body.conditions)
    assert.deepEqual(t.grantControls, body.grantControls ?? null)
  }
})

test('one member missing, or a member still waiting on a reference: no pair targets, so the script is withheld', () => {
  assert.equal(memberBindings(withMembers(['strong']), f.snapshot)['policies.guests.targets.json'], undefined)
  // Getiamai's own shape: a single create no member key matches.
  assert.equal(memberBindings(step, f.snapshot)['policies.guests.targets.json'], undefined)
  const waiting = withMembers(['strong', 'mixed'], [{ token: 'ffffffff-0000-4000-8000-000000000001' } as NonNullable<Step['action']['missing']>[number]])
  assert.equal(memberBindings(waiting, f.snapshot)['policies.guests.targets.json'], undefined)
})

test('each member resolved whole binds its own conditions, grant and session for the JSON batch; a member missing or waiting binds none', () => {
  const roots = ['conditions', 'grantControls', 'sessionControls'] as const
  const body = create.body as Record<(typeof roots)[number], unknown>
  const both = memberBindings(withMembers(['strong', 'mixed']), f.snapshot)
  for (const role of ['strong', 'mixed']) for (const r of roots) assert.deepEqual(both[`policies.guests.${role}.target.${r}`], body[r] ?? null, `${role} ${r}`)
  const one = memberBindings(withMembers(['strong']), f.snapshot)
  assert.ok(Object.hasOwn(one, 'policies.guests.strong.target.conditions'))
  assert.equal(roots.some((r) => Object.hasOwn(one, `policies.guests.mixed.target.${r}`)), false)
  const waiting = withMembers(['strong', 'mixed'], [{ token: 'ffffffff-0000-4000-8000-000000000001' } as NonNullable<Step['action']['missing']>[number]])
  assert.equal(Object.keys(memberBindings(waiting, f.snapshot)).some((k) => /\.target\.(conditions|grantControls|sessionControls)$/.test(k)), false)
})
