// S6 — Implementation channels, provenance and the viewer (A1 §16.2, A2).
//
// The state selects the instructions: Missing draws how to create, Partial how
// to correct, Report-only what to observe, Ready to enforce the enforcement,
// Blocked the planned work with no Copy. A channel whose only output would be an
// error or a placeholder is not offered and nothing stands in for it. The JSON
// channel is a request or nothing — method, endpoint, body and the target's own
// identifier — and never a bare body or an invented id. The source line is the
// date the package's Microsoft sources were checked, or nothing: never a pin.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeProjection, parseBlocks } from '../../content/implementation/protocol.ts'
import type { CompiledPackage, PackageMeta } from '../../content/implementation/protocol.ts'
import { NO_ACTION_STATES, NO_RUNTIME, projectImplementation, projectPlanned } from '../../content/implementation/project.ts'
import { CONTRACT } from './stepContract.ts'

const read = (p: string): string => readFileSync(p, 'utf8')
// The opened step's body spans the component and stepBody.ts (A3): the decisions read there.
const CONTENT_STEP = read('src/ui/surfaces/ContentStep.tsx') + read('src/ui/surfaces/stepBody.ts')
const CONTENT = JSON.parse(read('docs/design/content.json')) as Record<string, unknown>
const W = CONTRACT.implementation

const block = (meta: Record<string, unknown>, body = 'Text.'): string => `@@IAMAI-BEGIN ${JSON.stringify(meta)}\n${body}\n@@IAMAI-END\n`
const compile = (meta: Partial<PackageMeta>, content: string): CompiledPackage => {
  const blocks = parseBlocks(content)
  const m = { stepId: 's-test', requiredBindings: [], optionalBindings: [], ...meta, projection: meta.projection ?? {} } as PackageMeta
  return { meta: { ...m, projection: normalizeProjection(m, blocks) }, blocks }
}

// ---------------------------------------------------- 1. state selects instructions

/** One package with a distinct Entra block per state, each naming the policy. */
const BY_STATE = compile(
  {
    requiredBindings: ['policy.target.displayName'],
    projection: {
      missing: { entra: ['e.create'] },
      partial: { entra: ['e.correct'] },
      reportOnly: { entra: ['e.observe'] },
      readyToEnforce: { entra: ['e.enforce'] },
      blocked: { entra: ['e.create'] },
    },
  },
  block({ id: 'e.create', channel: 'entra', states: ['missing', 'blocked'], format: 'markdown' }, 'Create **{{policy.target.displayName}}** in report-only.') +
    block({ id: 'e.correct', channel: 'entra', states: ['partial'], format: 'markdown' }, 'Correct **{{policy.target.displayName}}**.') +
    block({ id: 'e.observe', channel: 'entra', states: ['reportOnly'], format: 'markdown' }, 'Observe **{{policy.target.displayName}}** in report-only; validate the sign-in log.') +
    block({ id: 'e.enforce', channel: 'entra', states: ['readyToEnforce'], format: 'markdown' }, 'Turn **{{policy.target.displayName}}** on.'),
)
const NAME = { 'policy.target.displayName': 'Core - Require - MFA' }
const CREATE = '{ "displayName": {{json:policy.target.displayName}}, "state": "enabledForReportingButNotEnforced" }'

test('the state selects the instructions: create, correct, observe, enforce; Blocked offers nothing executable, only its planning text', () => {
  {
    const entra = (state: 'missing' | 'partial' | 'reportOnly' | 'readyToEnforce'): string => {
      const p = projectImplementation(BY_STATE, state, NAME, NO_RUNTIME)
      assert.equal(p.hold, null, state)
      return p.channels.find((c) => c.channel === 'entra')!.text
    }
    assert.match(entra('missing'), /^Create /)
    assert.match(entra('partial'), /^Correct /)
    assert.match(entra('reportOnly'), /^Observe .*validate/)
    assert.match(entra('readyToEnforce'), /^Turn .* on\.$/)
  }
  {
    assert.ok(NO_ACTION_STATES.has('blocked'))
    const executable = projectImplementation(BY_STATE, 'blocked', NAME, NO_RUNTIME)
    assert.deepEqual(executable.channels, [], 'a blocked state was handed an artifact')
    const planned = projectPlanned(BY_STATE, 'blocked', {}, NO_RUNTIME, (b) => `‹${b}›`)
    assert.equal(planned.preview, true)
    assert.match(planned.channels.find((c) => c.channel === 'entra')!.text, /Create \*\*‹policy\.target\.displayName›\*\*/, 'the planned work is not visible with its stand-ins')
    // The page: Copy — inline and in the expanded viewer — copies every available artifact.
    assert.match(CONTENT_STEP, /const copyable = active !== null/)
    assert.equal((CONTENT_STEP.match(/\{copyControl\}/g) ?? []).length, 3, 'the normal preview, first-step channel toolbar and viewer do not share the one Copy rule')
    assert.match(CONTENT_STEP, /toolbar=\{/, 'the expanded viewer has no toolbar for its Copy')
  }
})

// ------------------------------------------- 2. no channel that is only an error, and JSON is a request

test('a channel is offered only when it can be finished: nothing stands in for one that cannot, and JSON only as a request with a bound target identifier', () => {
  {
    const pkg = compile(
      { requiredBindings: ['policy.target.displayName', 'policy.current.id'], projection: { missing: { entra: ['e.create'], json: ['j.create'] } } },
      block({ id: 'e.create', channel: 'entra', states: ['missing'], format: 'markdown' }, 'Create **{{policy.target.displayName}}**.') +
        block({ id: 'j.create', channel: 'json', states: ['missing'], format: 'json-template', method: 'PATCH', endpoint: '/identity/conditionalAccess/policies/{policy.current.id}' }, '{ "displayName": {{json:policy.target.displayName}} }'),
    )
    const p = projectImplementation(pkg, 'missing', NAME, NO_RUNTIME)
    assert.deepEqual(p.channels.map((c) => c.channel), ['entra'], 'the channel that cannot be finished is offered')
    assert.deepEqual(p.degraded?.map((d) => d.channel), ['json'])
    // The page draws no line for it: not "is not shown yet", not "does not hold", not "could not be projected".
    assert.equal(CONTENT_STEP.includes('W.withheld'), false)
    assert.equal(CONTENT_STEP.includes('.degraded'), false, 'the step still reads the withheld channels')
    assert.equal('withheld' in W, false)
    const words = JSON.stringify(CONTENT)
    for (const gone of ['is not shown yet', 'is not shown:', 'IAMAI does not hold {values}']) assert.equal(words.includes(gone), false, `content still says "${gone}"`)
  }
  {
    const json = (meta: Record<string, unknown>, bindings: Record<string, unknown> = NAME) => {
      const pkg = compile(
        { requiredBindings: ['policy.target.displayName', 'policy.current.id'], projection: { missing: { entra: ['e.create'], json: ['j.body'] } } },
        block({ id: 'e.create', channel: 'entra', states: ['missing'], format: 'markdown' }, 'Create **{{policy.target.displayName}}**.') + block({ id: 'j.body', channel: 'json', states: ['missing'], format: 'json-template', ...meta }, CREATE),
      )
      return projectImplementation(pkg, 'missing', bindings, NO_RUNTIME)
    }
    // A body with its POST: offered, and the request is on the artifact.
    const posted = json({ method: 'POST', endpoint: '/identity/conditionalAccess/policies' })
    const artifact = posted.channels.find((c) => c.channel === 'json')
    assert.ok(artifact, 'a complete request was withheld')
    assert.deepEqual(artifact.requests, [{ method: 'POST', endpoint: '/identity/conditionalAccess/policies' }])
    assert.equal(JSON.parse(artifact.text).displayName, NAME['policy.target.displayName'])
    // A bare body — no method, no endpoint — is not implementation content.
    const bare = json({})
    assert.equal(bare.channels.some((c) => c.channel === 'json'), false, 'a bare JSON body was offered')
    assert.match(bare.degraded?.find((d) => d.channel === 'json')?.invalid.join(' ') ?? '', /no request/)
    assert.equal(json({ method: 'PATCH' }).channels.some((c) => c.channel === 'json'), false, 'a method with nowhere to send it was offered')
    // A PATCH must name what it changes, and the identifier is IAMAI's own value or nothing.
    const anonymous = json({ method: 'PATCH', endpoint: '/identity/conditionalAccess/policies' })
    assert.equal(anonymous.channels.some((c) => c.channel === 'json'), false, 'a PATCH with no target identifier was offered')
    assert.match(anonymous.degraded?.find((d) => d.channel === 'json')?.invalid.join(' ') ?? '', /target identifier/)
    const unbound = json({ method: 'PATCH', endpoint: '/identity/conditionalAccess/policies/{policy.current.id}' })
    assert.equal(unbound.channels.some((c) => c.channel === 'json'), false, 'a PATCH was offered with an id IAMAI does not hold')
    assert.deepEqual(unbound.degraded?.find((d) => d.channel === 'json')?.missingBindings, ['policy.current.id'])
    const bound = json({ method: 'PATCH', endpoint: '/identity/conditionalAccess/policies/{policy.current.id}' }, { ...NAME, 'policy.current.id': 'p-1' })
    assert.deepEqual(bound.channels.find((c) => c.channel === 'json')?.requests, [{ method: 'PATCH', endpoint: '/identity/conditionalAccess/policies/p-1' }])
    // The Entra channel is untouched by any of it.
    for (const p of [posted, bare, anonymous, unbound, bound]) assert.ok(p.channels.some((c) => c.channel === 'entra'))
  }
})
