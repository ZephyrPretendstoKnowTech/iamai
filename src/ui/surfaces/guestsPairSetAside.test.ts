// Nadia D2 (persona round 4): on getiamai the guests goal resolves ONE create — the
// baseline's all-users MFA policy, "CA - Require - MFA for guests and external users",
// member key 27a0c25c — while the guests package is a PAIR keyed to two other pinned
// members. Neither member matched, nothing bound, and the pair's procedure was drawn
// anyway: "Create the two guest policies separately", each policy named by a raw
// stand-in (‹policies guests strong target displayName›), "The script for this step
// can only create in Report-only" beside a PowerShell tab that only read, and an AI
// briefing describing a Graph batch of two policies. The step's own create — the name
// and plan tag IAMAI recognises its policy by — was nowhere in its Implementation.
//
// A package of several members none of which the step resolves is set aside for that
// step (stepPackage.ts resolvesNoMember), the way a re-pin review sets one aside, and
// the step draws its own resolved channels.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { memberKeyOf } from '../../roadmap/observation.ts'
import type { PolicyOperation, Step } from '../../roadmap/types.ts'
import { implementationPackageFor, packageForEntry } from './stepPackage.ts'
import { stepBodyOf } from './stepBody.ts'

const f = fixture('getiamai')
const r = runFixture(f, {}, null, f.snapshot.asOf)
const step = r.steps.find((s) => s.id === 's-goal-guests-mfa') as Step
const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
// The pair's members, read from the package by its content entry: the step itself resolves neither.
const members = (packageForEntry(step)?.meta.baselineAuthority?.members ?? []) as { role: string; memberStableId: string }[]
const [create] = step.action.resolution!.policies as PolicyOperation[]

/**
 * The step as it reads once what it waits on is done (emergency access, the Direction
 * answers, readiness): no blocker, so its create is the action today. Nadia reached
 * exactly this by preparing emergency access and answering Direction.
 */
function unblocked(policies: PolicyOperation[] = step.action.resolution!.policies as PolicyOperation[]): Step {
  return { ...step, status: 'ready', blockers: [], action: { ...step.action, resolution: { ...step.action.resolution!, policies } } } as Step
}
const asMember = (role: string): PolicyOperation => {
  const m = members.find((x) => x.role === role)!
  return { ...create, memberKey: memberKeyOf(m.memberStableId, 0), body: { ...(create.body as Record<string, unknown>), displayName: `Sample ${role}` } } as PolicyOperation
}
const everyLine = (b: ReturnType<typeof stepBodyOf>): string[] => [...b.artifacts.map((a) => a.text()), ...(b.emergencyAccountTasks?.tasks ?? []).flatMap((t) => t.steps)]

test('a pair package describing none of the policies the step resolves does not apply to it', () => {
  {
    assert.deepEqual(members.map((m) => m.role).sort(), ['mixed', 'strong'])
    assert.equal((step.action.resolution!.policies as PolicyOperation[]).length, 1)
    assert.equal(create.mode, 'create')
    assert.equal(members.some((m) => memberKeyOf(m.memberStableId, 0) === create.memberKey), false)
  }
  {
    assert.equal(implementationPackageFor(step), null)
    assert.equal(implementationPackageFor(unblocked()), null)
    // A member resolved: the package describes the step, and applies.
    assert.notEqual(implementationPackageFor(unblocked([asMember('strong'), asMember('mixed')])), null)
    assert.notEqual(implementationPackageFor(unblocked([asMember('strong')])), null)
    // Nothing resolved yet: the planning preview's case, nothing to contradict the package.
    assert.notEqual(implementationPackageFor(unblocked([])), null)
  }
})

test('the guests step hands over its own create in Report-only, with its name and plan tag, and never the pair procedure or a stand-in, held or not', () => {
  {
    const name = (create.body as { displayName: string }).displayName
    const tag = (create.body as { description: string }).description
    const b = stepBodyOf(unblocked(), ctx)
    const portal = b.artifacts.find((a) => a.id === 'portal')!.text()
    assert.match(portal, new RegExp(`Name: ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    assert.ok(portal.includes(tag), portal)
    assert.match(portal, /Enable policy: Report-only/)
    const json = JSON.parse(b.artifacts.find((a) => a.id === 'json')!.text()) as { displayName?: string; state?: string; description?: string }
    assert.equal(json.displayName, name)
    assert.equal(json.state, 'enabledForReportingButNotEnforced')
    assert.equal(json.description, tag)
    for (const line of everyLine(b)) {
      assert.doesNotMatch(line, /‹[^›]+›/, 'a raw stand-in where a policy name goes')
      assert.doesNotMatch(line, /two guest (MFA )?policies|both policies in one Graph batch/, 'the pair this step does not run')
    }
  }
  // The held step's own preparation lines (content: "Review the two guest policies separately")
  // still assume the pair; whether this goal should resolve to one tenant-wide policy at all
  // is R4-23's. What this asserts is that the pair's CREATE procedure and its stand-ins are gone.
  {
    for (const line of everyLine(stepBodyOf(step, ctx))) {
      assert.doesNotMatch(line, /‹[^›]+›/)
      assert.doesNotMatch(line, /Create the two guest policies|both policies in one Graph batch/)
    }
  }
})
