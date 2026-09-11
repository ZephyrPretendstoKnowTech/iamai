// The implementation-content runtime contract, on synthetic packages: what the
// validator refuses is what the runtime cannot project, the guide's compose shape
// normalises into the one composition the runtime reads, and nothing a package
// does can throw through the Plan.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProjection, packageWarnings, parseBlocks, validatePackage } from './protocol.ts'
import type { CompiledPackage, PackageMeta } from './protocol.ts'
import { CHANGED_FIELDS_BINDING } from './protocol.ts'
import { NO_RUNTIME, projectImplementation, projectSafely, readinessSafely, troubleshootingSafely } from './project.ts'
import { packageApplies } from '../../ui/surfaces/stepPackage.ts'

const block = (meta: Record<string, unknown>, body = 'Text.'): string => `@@IAMAI-BEGIN ${JSON.stringify(meta)}\n${body}\n@@IAMAI-END\n`
const compile = (meta: Partial<PackageMeta>, content: string): CompiledPackage => {
  const blocks = parseBlocks(content)
  const m = { stepId: 's-test', requiredBindings: [], optionalBindings: [], ...meta, projection: meta.projection ?? {} } as PackageMeta
  return { meta: { ...m, projection: normalizeProjection(m, blocks) }, blocks }
}
const errorsOf = (meta: Partial<PackageMeta>, content: string): string[] => validatePackage(compile(meta, content))
const has = (errors: string[], re: RegExp): void => assert.ok(errors.some((e) => re.test(e)), `expected ${re} in:\n${errors.join('\n')}`)

const COMPOSE_CONTENT =
  block({ id: 'e.open', channel: 'entra', states: ['partial'], format: 'markdown' }, 'Open the policy.') +
  block({ id: 'e.grant', channel: 'entra', states: ['partial'], format: 'markdown' }, 'Correct the grant.') +
  block({ id: 'e.users', channel: 'entra', states: ['partial'], format: 'markdown' }, 'Correct the users.') +
  block({ id: 'j.grant', channel: 'json', states: ['partial'], format: 'json', method: 'PATCH', endpoint: '/identity/conditionalAccess/policies/{policy.current.id}' }, '{ "grantControls": { "operator": "OR" } }') +
  block({ id: 'j.users', channel: 'json', states: ['partial'], format: 'json', method: 'PATCH', endpoint: '/identity/conditionalAccess/policies/{policy.current.id}' }, '{ "conditions": { "users": { "includeUsers": ["All"] } } }') +
  block({ id: 'e.after', channel: 'entra', states: ['partial'], format: 'markdown' }, 'Save.')
const COMPOSE_META: Partial<PackageMeta> = {
  requiredBindings: ['policy.current.id', 'policy.current.semanticMismatches'],
  projection: {
    partial: {
      mode: 'compose',
      requires: ['policy.current.id', 'policy.current.semanticMismatches'],
      sharedBefore: ['e.open'],
      modules: [
        { id: 'grant.correct', entra: 'e.grant', json: 'j.grant', facts: ['grantControls'] },
        { id: 'users.correct', entra: 'e.users', json: 'j.users', facts: ['conditions.users'] },
      ],
      sharedAfter: ['e.after'],
    },
  },
}

test('the guide’s compose + modules is the composition the runtime reads, grouped by each block’s channel', () => {
  const pkg = compile(COMPOSE_META, COMPOSE_CONTENT)
  const p = pkg.meta.projection.partial
  assert.equal(p.mode, 'composeByMismatch')
  assert.deepEqual(p.sharedBefore, { entra: [{ block: 'e.open' }] })
  assert.deepEqual((p.mismatches as Record<string, unknown>)['grant.correct'], { entra: [{ block: 'e.grant' }], json: [{ block: 'j.grant' }], facts: ['grantControls'] })
  assert.deepEqual(validatePackage(pkg), [])
  const projected = projectImplementation(pkg, 'partial', { 'policy.current.id': 'p1', [CHANGED_FIELDS_BINDING]: ['grantControls.operator', 'conditions.users.includeUsers'] }, NO_RUNTIME)
  assert.equal(projected.hold, null)
  const entra = projected.channels.find((c) => c.channel === 'entra')!
  assert.deepEqual(entra.blocks, ['e.open', 'e.grant', 'e.users', 'e.after'])
  const json = projected.channels.find((c) => c.channel === 'json')!
  assert.deepEqual(JSON.parse(json.text), { grantControls: { operator: 'OR' }, conditions: { users: { includeUsers: ['All'] } } })
  assert.equal(json.requests.length, 1)
})

test('what the runtime cannot project is refused by the validator, feature by feature', () => {
  const entra = block({ id: 'e.x', channel: 'entra', states: ['missing'], format: 'markdown' })
  // A compose module IAMAI has no facts or condition to select.
  const noFacts = structuredClone(COMPOSE_META)
  delete ((noFacts.projection!.partial.modules as Record<string, unknown>[])[0] as Record<string, unknown>).facts
  has(errorsOf(noFacts, COMPOSE_CONTENT), /cannot select this module/)
  // A composition with no binding for its selected module ids.
  const noBinding = structuredClone(COMPOSE_META)
  noBinding.projection!.partial.requires = ['policy.current.id']
  has(errorsOf(noBinding, COMPOSE_CONTENT), /names the binding its selected modules/)
  // A mode the guide does not define.
  has(errorsOf({ projection: { missing: { mode: 'selectByBinding', selector: 'x', variants: {} } } }, entra), /mode "selectByBinding"/)
  // A channel the viewer does not render.
  has(errorsOf({ projection: {} }, block({ id: 'm.run', channel: 'manual', states: ['missing'], format: 'markdown' })), /unsupported channel manual/)
  // A deployable script with no invocation.
  has(errorsOf({ projection: { missing: { powershell: [{ block: 'p.run', mode: 'Create' }] } } }, block({ id: 'p.run', channel: 'powershell', states: ['missing'], format: 'powershell', kind: 'deployableAfterBinding' }, "param([Parameter(Mandatory)][string] $Mode)\nWrite-Host 'x'")), /declares its invocation/)
  // An Email with no audience or trigger.
  has(errorsOf({ projection: { readyToEnforce: { email: ['mail'] } } }, block({ id: 'mail', channel: 'email', states: ['readyToEnforce'], format: 'markdown' })), /Email declares its audience/)
  // A prose readiness model, a rule without a machine condition, a troubleshooting scenario without states.
  has(errorsOf({ projection: {}, supportBlocks: { readiness: ['r'] } }, block({ id: 'r', channel: 'readiness', states: ['missing'], format: 'markdown' }, '## Readiness\nExclusions are ready when resolved.')), /support model is JSON/)
  has(errorsOf({ projection: {}, supportBlocks: { readiness: ['r'] } }, block({ id: 'r', channel: 'readiness', states: ['missing'], format: 'json' }, JSON.stringify({ tiles: [{ id: 't', label: 'T', rules: [{ when: 'resolved', result: 'Ready', line: 'L' }] }] }))), /no machine condition/)
  has(errorsOf({ projection: {}, supportBlocks: { readiness: ['r'] } }, block({ id: 'r', channel: 'readiness', states: ['missing'], format: 'json' }, JSON.stringify({ tiles: [{ id: 't', label: 'T', rules: [{ if: { state: ['missing'] }, result: 'Probably fine', line: 'L' }] }] }))), /result: one of/)
  has(errorsOf({ projection: {}, supportBlocks: { troubleshooting: ['t'] } }, block({ id: 't', channel: 'troubleshooting', states: ['missing'], format: 'json' }, JSON.stringify({ scenarios: [{ id: 's', title: 'S' }] }))), /states: the states it applies to/)
  // A state IAMAI never enters is a warning, not an error.
  const custom = compile({ projection: { verificationRequired: { entra: [] } } }, entra)
  assert.ok(packageWarnings(custom).some((w) => /never enters/.test(w)))
})

test('nothing a package does throws through the Plan: faults hold the implementation and are reported', () => {
  const reported: string[] = []
  const report = (stepId: string, what: string): void => void reported.push(`${stepId}: ${what}`)
  const pkg = compile(COMPOSE_META, COMPOSE_CONTENT)
  // A state the package projects nothing for.
  assert.equal(projectImplementation(pkg, 'readyToEnforce', {}, NO_RUNTIME).hold?.noProjection, true)
  // A runtime fault inside the projection.
  const hostile = new Proxy({}, { get: () => { throw new Error('boom') } })
  const faulted = projectSafely(pkg, 'partial', hostile, NO_RUNTIME, report)
  assert.deepEqual(faulted.channels, [])
  assert.match(faulted.hold?.invalid[0] ?? '', /runtime fault: boom/)
  // A support model that no longer parses (the registry was hand-edited, say).
  const broken = compile({ projection: {}, supportBlocks: { readiness: ['r'], troubleshooting: ['t'] } }, block({ id: 'r', channel: 'readiness', states: ['missing'], format: 'json' }, '{ not json') + block({ id: 't', channel: 'troubleshooting', states: ['missing'], format: 'json' }, '{ not json'))
  assert.equal(readinessSafely(broken, 'missing', {}, NO_RUNTIME, report), null)
  assert.deepEqual(troubleshootingSafely(broken, 'missing', {}, report), [])
  assert.deepEqual(reported, ['s-test: projection (partial)', 's-test: readiness (missing)', 's-test: troubleshooting (missing)'])
})

test('bodies that do not hold together as one request hold the projection instead of emitting two documents', () => {
  const conflict = COMPOSE_CONTENT.replace('{ "conditions": { "users": { "includeUsers": ["All"] } } }', '{ "grantControls": { "operator": "AND" } }')
  const clash = projectImplementation(compile(COMPOSE_META, conflict), 'partial', { 'policy.current.id': 'p1', [CHANGED_FIELDS_BINDING]: ['grantControls.operator', 'conditions.users.includeUsers'] }, NO_RUNTIME)
  assert.deepEqual(clash.channels, [])
  assert.match(clash.hold?.invalid.join(' ') ?? '', /two bodies set grantControls/)
  const elsewhere = COMPOSE_CONTENT.replace('"endpoint":"/identity/conditionalAccess/policies/{policy.current.id}"}\n{ "conditions"', '"endpoint":"/identity/conditionalAccess/namedLocations/{policy.current.id}"}\n{ "conditions"')
  const split = projectImplementation(compile(COMPOSE_META, elsewhere), 'partial', { 'policy.current.id': 'p1', [CHANGED_FIELDS_BINDING]: ['grantControls.operator', 'conditions.users.includeUsers'] }, NO_RUNTIME)
  assert.match(split.hold?.invalid.join(' ') ?? '', /different requests/)
})

test('a package authored against another baseline pin does not apply to this build', () => {
  const pkg = compile({ baselineAuthority: { pinCommit: 'a'.repeat(40) } }, block({ id: 'e.x', channel: 'entra', states: ['missing'], format: 'markdown' }))
  assert.deepEqual(packageApplies(pkg, 'a'.repeat(40)), { applies: true })
  const other = packageApplies(pkg, 'b'.repeat(40))
  assert.equal(other.applies, false)
  assert.deepEqual(packageApplies(compile({}, block({ id: 'e.x', channel: 'entra', states: ['missing'], format: 'markdown' })), 'b'.repeat(40)), { applies: true }, 'a package naming no pin was refused')
})
