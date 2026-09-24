// The plan tag, in every channel that writes.
//
// The Entra procedure tells the reader: "Description: [IAMAI:…] — paste this
// exactly; it is how IAMAI recognises the policy it planned when it next reads
// the tenant." The JSON body and the PowerShell create body — the two channels
// that submit without anybody retyping anything — left it out. A policy built
// through them came back unrecognised, and its own step asked for it to be
// created again, in a live tenant. A second enforcing Conditional Access policy
// is a lockout path, so this is the identity the whole plan is tracked by.
//
// Found by the identity-consultant run, 2026-09-20: "IAMAI's own generated
// artefacts produce a tenant its own plan misreports."
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileLibrary } from './library.ts'
import type { LibraryPackage } from './library.ts'
import type { Block, CompiledPackage } from './protocol.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepBodyOf } from '../../ui/surfaces/stepBody.ts'
import { stepOperations } from '../../ui/surfaces/stepJson.ts'

const LIBRARY = compileLibrary()
const ALL: LibraryPackage[] = [...LIBRARY.registered, ...LIBRARY.notSteps]

/** The block that POSTs a new Conditional Access policy, or null. */
const createBodies = (pkg: CompiledPackage, channel: string): Block[] =>
  Object.values(pkg.blocks).filter(
    (b) => b.meta.channel === channel && b.meta.method === 'POST' && /conditionalAccess\/policies$/.test(String(b.meta.endpoint ?? '')),
  )

/**
 * Packages whose create body still names no description, with the reason. Each
 * builds its body from its own script parameters rather than the resolved
 * target, so carrying the tag needs a new parameter plumbed through the
 * invocation — a change to the script contract, not to a body. Listed so the
 * gap is counted rather than forgotten, and so it cannot grow.
 */
const WITHOUT_TAG: Readonly<Record<string, string>> = {
  's-goal-token-protection': 'builds $body from $PolicyDisplayName, not the resolved target',
  's-goal-intune-enrollment-reauth': 'builds $body from $PolicyDisplayName, not the resolved target',
  's-goal-admin-portals-protected': 'no machine create body in this package',
  's-goal-session-lifetime': 'the second of its two policies takes its name from a per-policy binding',
}

// CLOSED, 2026-09-21. The JSON create bodies carry the tag, and they carry it
// from one place: `jsonWithPlanTag` (ui/surfaces/stepPackage.ts) puts the
// resolved operation's description onto any POST that creates a Conditional
// Access policy and names none of its own. It is not a per-package template
// field, so no package author can forget it, no binding has to be declared in
// forty-four manifests, and the state this guard feared most - some tabs tagged
// and some not, with nothing on any surface saying which - is not reachable.
//
// This test reads the RENDERED channel, not the library block. The first version
// walked library blocks only and so could not see the case it exists to prevent:
// a step with no library JSON block has its tab generated from the resolved
// operation, whose body already carried the tag, so the library was UNIFORM and
// the product was not. An identity consultant found that in a re-run; the guard
// passed the whole time.
test('every JSON create body a person can copy carries the plan tag', () => {
  const tagged: string[] = []
  const untagged: string[] = []
  for (const name of ['demo', 'demo-week2', 'large'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    for (const step of r.steps) {
      const ops = stepOperations(step)
      if (ops.length === 0 || (ops[0] as { mode?: string }).mode !== 'create') continue
      const json = stepBodyOf(step, ctx as never).artifacts.find((a) => a.id === 'json')?.text() ?? ''
      // A withheld channel renders a read-only batch, not a create body.
      if (json.length === 0 || json.includes('"method": "GET"')) continue
      ;(json.includes(`[IAMAI:${r.input.planId}:${step.id}`) ? tagged : untagged).push(`${name}/${step.id}`)
    }
  }
  assert.ok(tagged.length + untagged.length >= 10, `JSON create tabs rendered: ${tagged.length + untagged.length}`)
  // A policy built from an untagged tab comes back unrecognised and its own step
  // asks for it to be created again, in a live tenant. A second enforcing policy
  // is a lockout path, so this is the identity the whole plan is tracked by.
  assert.deepEqual(untagged, [], [
    'A JSON create tab produces a policy IAMAI will not recognise. Tagged:',
    ...tagged,
  ].join(String.fromCharCode(10)))
})

test('every PowerShell create body built from the resolved target carries the plan tag, and the counted gap cannot grow or name a package that is gone', () => {
  // every PowerShell create body built from the resolved target carries the plan tag
  {
    const missing: string[] = []
    let checked = 0
    for (const p of ALL) {
      const ps = Object.values(p.source.blocks).find((b) => b.meta.channel === 'powershell')
      if (!ps || !/\$target\.displayName/.test(ps.text)) continue
      checked += 1
      if (/\$target\.description/.test(ps.text)) continue
      if (Object.hasOwn(WITHOUT_TAG, p.stepId)) continue
      missing.push(p.stepId)
    }
    assert.ok(checked >= 10, `scripts building a body from the target: ${checked}`)
    assert.deepEqual(missing, [], 'a script that submits a policy IAMAI cannot recognise')
  }
  // the gap is counted, and every package named in it still exists
  {
    const ids = new Set(ALL.map((p) => p.stepId))
    for (const id of Object.keys(WITHOUT_TAG)) assert.ok(ids.has(id), `${id}: named as untagged, but there is no such package`)
    assert.ok(Object.keys(WITHOUT_TAG).length <= 4, `the untagged set grew to ${Object.keys(WITHOUT_TAG).length}`)
  }
})
