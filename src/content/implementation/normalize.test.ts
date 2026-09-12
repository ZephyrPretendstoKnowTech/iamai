// The library's schema families, normalised (correction batch 2): the shapes the
// packages were authored in are rewritten into the one the runtime reads, with the
// author's words unchanged, and what cannot be read without interpreting prose is
// still refused.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { Block, CompiledPackage, PackageMeta } from './protocol.ts'
import { normalizePackage, validatePackage, withholdInvalid } from './protocol.ts'
import { packageReadiness, projectImplementation, troubleshootingFor } from './project.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

const block = (meta: Record<string, unknown>, text: string): Block => ({ meta: meta as Block['meta'], text })

test('an Email declares its audience and trigger in any of the library’s shapes, and a one-state Email is sent for that state', () => {
  const meta = {
    stepId: 'x',
    requiredBindings: [],
    email: { blocks: ['email.listed'], audience: 'help-desk', communicationTrigger: 'before-enforcement', purpose: 'pre-change-notice' },
    projection: { missing: { email: ['email.rollout'] }, readyToEnforce: { email: ['email.renamed', 'email.listed'] } },
  } as unknown as PackageMeta
  const { meta: m, blocks } = normalizePackage(meta, {
    'email.rollout': block({ id: 'email.rollout', channel: 'email', states: ['missing'], format: 'markdown', audience: 'affected-users' }, 'Subject: a\n'),
    'email.renamed': block({ id: 'email.renamed', channel: 'email', states: ['readyToEnforce'], format: 'markdown', audience: 'admins', trigger: 'before-enforcement' }, 'Subject: b\n'),
    'email.listed': block({ id: 'email.listed', channel: 'email', states: ['readyToEnforce'], format: 'markdown' }, 'Subject: c\n'),
  })
  assert.equal(blocks['email.rollout'].meta.communicationTrigger, 'before-report-only')
  assert.equal(blocks['email.renamed'].meta.communicationTrigger, 'before-enforcement')
  assert.equal(blocks['email.renamed'].meta.trigger, undefined)
  assert.equal(blocks['email.listed'].meta.audience, 'help-desk')
  assert.deepEqual(validatePackage({ meta: m, blocks }), [])
  // An Email with no audience anywhere is still refused: an audience is never guessed.
  const bare = normalizePackage({ stepId: 'y', projection: { missing: { email: ['e'] } } } as unknown as PackageMeta, { e: block({ id: 'e', channel: 'email', states: ['missing'], format: 'markdown' }, 'Subject: d\n') })
  assert.ok(validatePackage({ meta: bare.meta, blocks: bare.blocks }).some((e) => /audience/.test(e)))
})

test('a troubleshooting scenario written as sentences becomes the runtime’s lists, in its block’s states, titled by its symptom', () => {
  const text = JSON.stringify({ scenarios: [{ id: 'graph-403', symptom: 'Graph returns 403.', check: 'Confirm the role.', fix: 'Grant the scope.', then: 'Retry.', sourceIds: ['s1'] }] })
  const meta = { stepId: 'x', projection: {}, supportBlocks: { troubleshooting: ['t'] }, verifiedSources: [{ id: 's1', title: 'Doc', url: 'https://learn.microsoft.com/x', checkedOn: '2026-09-10', userFacing: true }] } as unknown as PackageMeta
  const { meta: m, blocks } = normalizePackage(meta, { t: block({ id: 't', channel: 'troubleshooting', states: ['missing', 'campaignRunning'], format: 'json' }, text) })
  const pkg = withholdInvalid({ meta: m, blocks }).pkg
  const [s] = troubleshootingFor(pkg, 'missing')
  assert.equal(s.title, 'Graph returns 403')
  assert.equal(s.symptom, '', 'the symptom is the title, shown once')
  assert.deepEqual([s.check, s.fix, s.then], [['Confirm the role.'], ['Grant the scope.'], ['Retry.']])
  assert.deepEqual(s.sources.map((x) => x.id), ['s1'])
  assert.deepEqual(troubleshootingFor(pkg, 'reportOnly'), [], 'a scenario is shown only in the states its block declares')
})

test('readiness evidence written as a paragraph, safe-now and safe-to-enforce lines reaches the evidence view; a tile stating a tenant fact stays refused', () => {
  const text = JSON.stringify({
    tiles: [
      { id: 'proof', label: 'Fresh sign-in proof', result: 'Unknown until tested', line: 'Report-only cannot prove the prompt.' },
      { id: 'group', label: 'Group', result: '{{group.current.id}}', line: 'One stable group.' },
    ],
    whyIamaiSaysThis: 'Configuration is not behaviour.',
    safeNow: 'Create it in Report-only.',
    safeToEnforce: 'Only after the evidence gates are Ready.',
  })
  const meta = { stepId: 'x', projection: {}, supportBlocks: { readiness: ['r'] }, optionalBindings: ['group.current.id'] } as unknown as PackageMeta
  const { meta: m, blocks } = normalizePackage(meta, { r: block({ id: 'r', channel: 'readiness', states: ['missing', 'readyToEnforce'], format: 'json' }, text) })
  const errors = validatePackage({ meta: m, blocks })
  assert.equal(errors.length, 1, errors.join('\n'))
  assert.match(errors[0], /tiles\[1\]\.rules/, 'a tile whose result is a binding is interpreted into a rule')
  const pkg = withholdInvalid({ meta: m, blocks }).pkg
  const missing = packageReadiness(pkg, 'missing', {})!
  assert.equal(missing.whyItMatters, 'Configuration is not behaviour.')
  assert.equal(missing.conclusion, 'Create it in Report-only.')
  assert.deepEqual(missing.tiles.map((t) => [t.id, t.result, t.line]), [['proof', 'Unknown', 'Report-only cannot prove the prompt.']])
  assert.equal(packageReadiness(pkg, 'readyToEnforce', {})!.conclusion, 'Only after the evidence gates are Ready.')
})

test('content authored under another name for a runtime state is that state’s, and never replaces what the author wrote for the state itself', () => {
  const meta = { stepId: 'x', requiredBindings: [], projection: { groupMissing: { aiInfo: ['ai.create'] }, decided: { aiInfo: ['ai.decided'] }, inPlace: { aiInfo: ['ai.inplace'] } } } as unknown as PackageMeta
  const { meta: m, blocks } = normalizePackage(meta, {
    'ai.create': block({ id: 'ai.create', channel: 'aiInfo', states: ['groupMissing'], format: 'markdown' }, 'Create the group.\n'),
    'ai.decided': block({ id: 'ai.decided', channel: 'aiInfo', states: ['decided'], format: 'markdown' }, 'Decided.\n'),
    'ai.inplace': block({ id: 'ai.inplace', channel: 'aiInfo', states: ['inPlace'], format: 'markdown' }, 'In place.\n'),
  })
  assert.deepEqual(validatePackage({ meta: m, blocks }), [])
  assert.deepEqual(projectImplementation({ meta: m, blocks }, 'missing', {}).channels.map((c) => c.text), ['Create the group.'])
  assert.deepEqual(m.projection.inPlace, { aiInfo: ['ai.inplace'] }, 'an alias overwrote the state its author wrote')
})

test('a script mode IAMAI cannot call is withheld with its reason, and the modes it can call still project', () => {
  const script = "param([Parameter(Mandatory)][string]$Mode,[string]$PolicyId,[switch]$ReadinessApproved)\nif ($Mode -eq 'Enforce' -and -not $ReadinessApproved) { throw 'no' }\n"
  const invocation = { modeParameter: 'Mode', parameters: { PolicyId: { binding: 'policy.current.id', modes: ['Verify', 'Enforce'] } }, withheldModes: { Enforce: 'needs -ReadinessApproved' } }
  const meta = { stepId: 'x', requiredBindings: ['policy.current.id'], projection: { reportOnly: { powershell: [{ block: 'ps', mode: 'Verify' }] }, readyToEnforce: { powershell: [{ block: 'ps', mode: 'Enforce' }] } } } as unknown as PackageMeta
  const { meta: m, blocks } = normalizePackage(meta, { ps: block({ id: 'ps', channel: 'powershell', states: ['reportOnly', 'readyToEnforce'], format: 'powershell', kind: 'deployableAfterBinding', invocation }, script) })
  const errors = validatePackage({ meta: m, blocks })
  assert.deepEqual(errors, ['projection.readyToEnforce.powershell: mode Enforce is withheld by its invocation: needs -ReadinessApproved'])
  const pkg = withholdInvalid({ meta: m, blocks }).pkg
  const bindings = { 'policy.current.id': 'p-1' }
  assert.match(projectImplementation(pkg, 'reportOnly', bindings).channels[0].text, /Invoke-IAMAIStep -Mode 'Verify' -PolicyId 'p-1'/)
  assert.deepEqual(projectImplementation(pkg, 'readyToEnforce', bindings).channels, [], 'an Enforce call that would throw was offered')
})

test('the library’s Emails, scripts and troubleshooting reach the registry: every projected Email says who it is for and when, and scenarios survive', () => {
  let emails = 0
  let scenarios = 0
  for (const pkg of Object.values(PACKAGES)) {
    for (const p of Object.values(pkg.meta.projection)) {
      for (const ref of JSON.stringify(p ?? {}).match(/"email\.[^"]+"/g) ?? []) {
        const b = pkg.blocks[JSON.parse(ref)]
        if (!b) continue
        assert.equal(typeof b.meta.audience, 'string', `${pkg.meta.stepId}: ${b.meta.id} has no audience`)
        assert.equal(typeof b.meta.communicationTrigger, 'string', `${pkg.meta.stepId}: ${b.meta.id} has no trigger`)
        emails++
      }
    }
    for (const id of pkg.meta.supportBlocks?.troubleshooting ?? []) scenarios += ((JSON.parse(pkg.blocks[id].text.replace(/\{\{json:[\w.-]+\}\}/g, 'null')) as { scenarios?: unknown[] }).scenarios ?? []).length
  }
  assert.ok(emails >= 40, `only ${emails} Emails are projected`)
  assert.ok(scenarios >= 100, `only ${scenarios} troubleshooting scenarios are registered`)
})
