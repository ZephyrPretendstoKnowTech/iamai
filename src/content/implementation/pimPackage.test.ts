// The PIM package's two remaining validator findings (correction batch 2.1): its
// authentication-context correction is selectable under the generic correction
// contract, and its per-policy PIM request is reported as the request shape the
// runtime does not project — never as a binding the author forgot, and never with
// an invented role-management policy id.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage, PackageMeta } from './protocol.ts'
import { CHANGED_FIELDS_BINDING, normalizePackage, parseBlocks, validatePackage } from './protocol.ts'
import { selectMismatches } from './project.ts'
import { readFileSync } from 'node:fs'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
const DIR = 'docs/implementation-content/s-goal-pim-activation-reauth'
const PIM = PACKAGES['s-goal-pim-activation-reauth']

test('the authentication-context correction is selected only when IAMAI knows the context is unpublished, and never from a fact it does not read', () => {
  const partial = PIM.meta.projection.partial as Record<string, unknown>
  const table = partial.mismatches as Record<string, { select?: unknown; facts?: unknown }>
  assert.ok(table['context.unpublished-or-wrong'], 'the context correction was withheld at compile time')
  assert.deepEqual(table['context.unpublished-or-wrong'].select, { equals: ['authContext.current.isAvailable', false] })
  const ctx = (bindings: Record<string, unknown>) => ({ state: 'partial', bindings, satisfied: new Set<string>(), baselineCommit: null })
  // IAMAI reads no authentication contexts today: unbound, the correction is not selected.
  assert.deepEqual(selectMismatches(partial, ctx({ [CHANGED_FIELDS_BINDING]: ['grantControls.authenticationStrength.id'] })), { selected: ['policy.authentication-strength'], unknown: [] })
  // Where the context is known to be unpublished, it is selected beside the policy's own correction.
  assert.deepEqual(selectMismatches(partial, ctx({ [CHANGED_FIELDS_BINDING]: ['grantControls.authenticationStrength.id'], 'authContext.current.isAvailable': false })).selected, ['context.unpublished-or-wrong', 'policy.authentication-strength'])
  assert.equal(selectMismatches(partial, ctx({ 'authContext.current.isAvailable': true })).selected.includes('context.unpublished-or-wrong'), false)
})

test('a request repeated once per role-management policy is reported as an unsupported request shape, and withheld; no id is declared or invented', () => {
  const meta = JSON.parse(readFileSync(`${DIR}/META.json`, 'utf8')) as PackageMeta
  const normal = normalizePackage(meta, parseBlocks(readFileSync(`${DIR}/CONTENT.md`, 'utf8')))
  const errors = validatePackage({ meta: normal.meta, blocks: normal.blocks })
  assert.deepEqual(errors.filter((e) => /undeclared binding|cannot select this module/.test(e)), [], 'a PIM finding is still reported as a schema defect')
  assert.ok(errors.some((e) => /json\.pim\.auth-context-rule: a request repeated for each value of pim\.roleManagementPolicyIds \(repeatForBinding, per-value roleManagementPolicyId\)/.test(e)), errors.join('\n'))
  assert.equal([...(meta.requiredBindings ?? []), ...(meta.optionalBindings ?? [])].includes('roleManagementPolicyId'), false, 'a per-value variable was declared as a binding IAMAI holds')
  assert.equal(PIM.blocks['json.pim.auth-context-rule'], undefined, 'the request the runtime cannot build was registered')
  // Another block with an undeclared endpoint binding and no repeat is still the author's defect.
  const stray = { meta: { stepId: 'x', projection: {} } as unknown as PackageMeta, blocks: { j: { meta: { id: 'j', channel: 'json', format: 'json', endpoint: 'https://graph.microsoft.com/v1.0/x/{missingId}' }, text: '{}\n' } } }
  assert.deepEqual(validatePackage(stray as unknown as CompiledPackage), ['j: endpoint names undeclared binding missingId'])
})
