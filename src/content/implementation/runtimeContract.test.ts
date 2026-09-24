// The implementation-content runtime contract, on synthetic packages: what the
// validator refuses is what the runtime cannot project, the guide's compose shape
// normalises into the one composition the runtime reads, and nothing a package
// does can throw through the Plan.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProjection, packageWarnings, parseBlocks, validatePackage, withholdInvalid } from './protocol.ts'
import type { CompiledPackage, PackageMeta } from './protocol.ts'
import { CHANGED_FIELDS_BINDING } from './protocol.ts'
import { NO_ACTION_STATES, NO_RUNTIME, UNRESOLVED, bindText, projectPlanned, packageReadiness, projectImplementation, projectSafely, readinessSafely, troubleshootingFor, troubleshootingSafely } from './project.ts'
import { packageSourceLine } from '../../ui/surfaces/stepPackage.ts'

const block = (meta: Record<string, unknown>, body = 'Text.'): string => `@@IAMAI-BEGIN ${JSON.stringify(meta)}\n${body}\n@@IAMAI-END\n`
const compile = (meta: Partial<PackageMeta>, content: string): CompiledPackage => {
  const blocks = parseBlocks(content)
  const m = { stepId: 's-test', requiredBindings: [], optionalBindings: [], ...meta, projection: meta.projection ?? {} } as PackageMeta
  return { meta: { ...m, projection: normalizeProjection(m, blocks) }, blocks }
}
const errorsOf = (meta: Partial<PackageMeta>, content: string): string[] => validatePackage(compile(meta, content))
const has = (errors: string[], re: RegExp): void => assert.ok(errors.some((e) => re.test(e)), `expected ${re} in:\n${errors.join('\n')}`)

test('META impact.fallbackLabel (U13) and milestone.actionText (U3): a non-empty string validates, anything else is refused', () => {
  // META impact.fallbackLabel (U13): a non-empty string validates, anything else is refused
  {
    const impactErrors = (impact: unknown): string[] => errorsOf({ impact } as Partial<PackageMeta>, '').filter((e) => /impact\./.test(e))
    assert.deepEqual(impactErrors({ fallbackLabel: 'Authentication methods' }), [])
    assert.deepEqual(impactErrors({}), [])
    has(impactErrors({ fallbackLabel: '' }), /impact\.fallbackLabel: a non-empty string/)
    has(impactErrors({ fallbackLabel: 3 }), /impact\.fallbackLabel: a non-empty string/)
    has(impactErrors(null), /impact\.fallbackLabel: a non-empty string/)
  }
  // META milestone.actionText (U3): a non-empty string validates, anything else is refused
  {
    const milestoneErrors = (milestone: unknown): string[] => errorsOf({ milestone } as Partial<PackageMeta>, '').filter((e) => /milestone\./.test(e))
    assert.deepEqual(milestoneErrors({ actionText: 'Create and verify two emergency accounts' }), [])
    assert.deepEqual(milestoneErrors({}), [])
    has(milestoneErrors({ actionText: ' ' }), /milestone\.actionText: a non-empty string/)
    has(milestoneErrors({ actionText: 3 }), /milestone\.actionText: a non-empty string/)
    has(milestoneErrors(null), /milestone\.actionText: a non-empty string/)
  }
})

// §S4-2: a condition left at Configure: No is not applied, so a portal
// procedure that narrows one and never names the toggle describes a policy that
// reaches everything the condition was meant to narrow. The rule is over the
// passage, not the package: a block that leaves the condition unconfigured, or
// removes it, or says Microsoft does not offer it, narrows nothing.
test('a portal procedure that narrows a toggled condition names its Configure toggle', () => {
  const entra = (body: string): string[] => errorsOf({}, block({ id: 'entra.create', channel: 'entra', states: ['missing'] }, body)).filter((e) => /Configure/.test(e))
  has(entra('Conditions → Device platforms → Include: Android and iOS.'), /Device platforms is narrowed without naming Configure/)
  has(entra('Under **Conditions > Filter for devices**, exclude `device.systemLabels -contains "CloudPC"`.'), /Filter for devices is narrowed without naming Configure/)
  has(entra('Conditions → Locations → Include: Any location; Exclude: All trusted locations'), /Network is narrowed without naming Configure/)
  has(entra('Conditions → Client apps → Browser.'), /Client apps is narrowed without naming Configure/)
  has(entra('Conditions → Sign-in risk → High.'), /Sign-in risk is narrowed without naming Configure/)
  has(entra('Conditions → User risk → High and Medium.'), /User risk is narrowed without naming Configure/)
  has(entra('Conditions → Authentication flows → Device code flow.'), /Authentication flows is narrowed without naming Configure/)
  // Each condition answers for its own toggle, even beside a sibling that has one.
  has(entra('Conditions → Client apps → Configure: Yes, then Browser; Filter for devices to Exclude `device.isCompliant -eq True`.'), /Filter for devices is narrowed/)
  // The toggle named, in either wording, is the whole of the rule.
  assert.deepEqual(entra('Conditions → Device platforms → Configure: Yes, then Include: Android and iOS.'), [])
  assert.deepEqual(entra('Under **Conditions > Filter for devices**, set **Configure** to **Yes**, then exclude `device.trustType -eq "AzureAD"`.'), [])
  // A condition named but not narrowed: nothing to toggle.
  assert.deepEqual(entra('Leave **Conditions → Client apps** unconfigured; an unconfigured condition reaches every client app.'), [])
  assert.deepEqual(entra('Microsoft makes **Client apps**, **Filters for devices** and **Device state** unavailable for this user action.'), [])
  assert.deepEqual(entra('Remove any user risk, network or location, device platform or authentication flow condition.'), [])
  assert.deepEqual(entra('Restrict Service Accounts to the Trusted Network is waiting on the approved trusted network.'), [])
  // The machine channels write the whole condition object, so a condition they
  // name is always applied; the rule is about what a person types.
  assert.deepEqual(errorsOf({}, block({ id: 'powershell.run', channel: 'powershell', states: ['missing'], format: 'powershell' }, "throw 'Sign-in risk must be High only'")).filter((e) => /Configure/.test(e)), [])
})

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

test('a channel that cannot be one request, or lacks a value of its own, is withheld alone and names why; a value the state as a whole requires holds every channel', () => {
  // bodies that do not hold together as one request withhold that channel instead of emitting two documents, and the other channels still project
  {
    const conflict = COMPOSE_CONTENT.replace('Open the policy.', 'Open policy {{policy.current.id}}.').replace('{ "conditions": { "users": { "includeUsers": ["All"] } } }', '{ "grantControls": { "operator": "AND" } }')
    const clash = projectImplementation(compile(COMPOSE_META, conflict), 'partial', { 'policy.current.id': 'p1', [CHANGED_FIELDS_BINDING]: ['grantControls.operator', 'conditions.users.includeUsers'] }, NO_RUNTIME)
    assert.deepEqual(clash.channels.map((c) => c.channel), ['entra'], 'the clashing JSON reached the page, or took the portal steps with it')
    assert.equal(clash.hold, null)
    assert.deepEqual(clash.degraded?.map((d) => d.channel), ['json'])
    assert.match(clash.degraded?.[0].invalid.join(' ') ?? '', /two bodies set grantControls/)
    const elsewhere = COMPOSE_CONTENT.replace('Open the policy.', 'Open policy {{policy.current.id}}.').replace('"endpoint":"/identity/conditionalAccess/policies/{policy.current.id}"}\n{ "conditions"', '"endpoint":"/identity/conditionalAccess/namedLocations/{policy.current.id}"}\n{ "conditions"')
    const split = projectImplementation(compile(COMPOSE_META, elsewhere), 'partial', { 'policy.current.id': 'p1', [CHANGED_FIELDS_BINDING]: ['grantControls.operator', 'conditions.users.includeUsers'] }, NO_RUNTIME)
    assert.equal(split.channels.some((c) => c.channel === 'json'), false)
    assert.match(split.degraded?.[0].invalid.join(' ') ?? '', /different requests/)
  }
  // a channel withheld on its own names what it lacks; a value the state as a whole requires holds every channel
  {
    const pkg = compile(COMPOSE_META, COMPOSE_CONTENT.replace('Correct the grant.', 'Correct the grant to {{policy.target.grantWords}}.'))
    pkg.meta.requiredBindings = [...(pkg.meta.requiredBindings ?? []), 'policy.target.grantWords']
    const facts = { 'policy.current.id': 'p1', [CHANGED_FIELDS_BINDING]: ['grantControls.operator'] }
    const one = projectImplementation(pkg, 'partial', facts, NO_RUNTIME)
    assert.deepEqual(one.channels.map((c) => c.channel), ['json'])
    assert.deepEqual(one.degraded, [{ channel: 'entra', missingBindings: ['policy.target.grantWords'], invalid: [] }])
    const all = projectImplementation(pkg, 'partial', { [CHANGED_FIELDS_BINDING]: ['grantControls.operator'] }, NO_RUNTIME)
    assert.deepEqual(all.channels, [])
    assert.deepEqual(all.hold?.missingBindings, ['policy.current.id'])
    // Portal steps that carry none of IAMAI's values are never offered alone, where
    // every channel that does carry one is withheld.
    const partial = COMPOSE_META.projection!.partial as Record<string, unknown>
    const loose = compile({ ...COMPOSE_META, projection: { partial: { ...partial, requires: ['policy.current.semanticMismatches'] } } } as never, COMPOSE_CONTENT)
    const alone = projectImplementation(loose, 'partial', { [CHANGED_FIELDS_BINDING]: ['grantControls.operator'] }, NO_RUNTIME)
    assert.deepEqual(alone.channels, [], 'channels carrying none of IAMAI’s values were offered on their own')
    assert.deepEqual(alone.hold?.missingBindings, ['policy.current.id'])
  }
})

test('binding text: null is a JSON value and never a sentence, a script literal is not a binding, an omit marker goes with its line, and an introducing line goes with its emptied list; a preview keeps unresolved optional lines', () => {
  // null is a value: a JSON binding the target sets to null renders null, and a sentence never prints it
  {
    const bound =bindText('{ "sessionControls": {{json:policy.target.sessionControls}} }', { 'policy.target.sessionControls': null }, new Set(['policy.target.sessionControls']))
    assert.deepEqual(bound, { text: '{ "sessionControls": null }' })
    assert.deepEqual(bindText('Session: {{policy.target.sessionControls}}', { 'policy.target.sessionControls': null }, new Set(['policy.target.sessionControls'])), { missing: ['policy.target.sessionControls'] })
    assert.deepEqual(bindText('{ "x": {{json:policy.target.sessionControls}} }', {}, new Set(['policy.target.sessionControls'])), { missing: ['policy.target.sessionControls'] })
  }
  // a script literal that opens with two braces is not an unresolved binding
  {
    assert.equal(UNRESOLVED.test("if ($value -like '{{*') { throw 'An IAMAI value was not bound.' }"), false)
    assert.equal(UNRESOLVED.test('Name: {{policy.target.displayName}}'), true)
    assert.equal(UNRESOLVED.test('{ "x": {{json:policy.target.conditions}} }'), true)
    assert.equal(UNRESOLVED.test('Evidence line [omit this line when unavailable]'), true)
  }
  // an optional line’s omit marker is resolved in either spelling: the marker goes with a value, the line goes without one
  {
    for (const marker of ['[omit when unavailable]', '[omit if unavailable]', '[omit this line when unavailable]']) {
      const text = `- Tenant: {{tenant.displayName}} ${marker}\n- Next.`
      assert.deepEqual(bindText(text, { 'tenant.displayName': 'Contoso' }, new Set()), { text: '- Tenant: Contoso\n- Next.' }, marker)
      assert.deepEqual(bindText(text, {}, new Set()), { text: '- Next.' }, marker)
    }
  }
  // a line that introduces indented lines goes with them when every one has gone, and the numbered list closes the gap
  // R4-39 (Priya D9), the second site. The managed-device create read "5. Conditions →
  // set only what IAMAI resolved, and set each one through its own Configure toggle:"
  // and then "6. Grant", on a target with no location or platform condition: each
  // condition line under it was omitted for want of a value, and the line that
  // introduces them stayed, an instruction to set a list of conditions that lists
  // none. The JSON and the script set no condition, so there is no Conditions step:
  // the introducing line goes with its lines and the list closes the gap. The text
  // below is that package's block (s-goal-require-managed-device entra.create), cut short.
  {
    const create = [
      '1. Go to Entra admin center → Conditional Access → Policies → New policy.',
      '2. Name: {{policy.target.displayName}}.',
      '3. Target resources: All resources.',
      '4. Conditions → set only what IAMAI resolved, and set each one through its own **Configure** toggle:',
      '   Locations: set **Configure** to **Yes**, then **{{policy.target.locationWords}}**. [omit this line when unavailable]',
      '   Device platforms: set **Configure** to **Yes**, then **{{policy.target.platformWords}}**. [omit this line when unavailable]',
      '5. Grant → Grant access → Require device to be marked as compliant.',
      '6. Enable policy: Report-only.',
      '7. Create. Rescan in IAMAI.',
    ].join('\n')
    const name = { 'policy.target.displayName': 'Core - Require - Compliant device' }
    const required = new Set(['policy.target.displayName'])
    const linesOf = (bindings: Record<string, unknown>): string[] => {
      const out = bindText(create, bindings, required)
      assert.ok('text' in out, JSON.stringify(out))
      return out.text.split('\n')
    }
    // No condition resolved: no line introduces a list and lists nothing, and the steps count on.
    assert.deepEqual(linesOf(name), [
      '1. Go to Entra admin center → Conditional Access → Policies → New policy.',
      '2. Name: Core - Require - Compliant device.',
      '3. Target resources: All resources.',
      '4. Grant → Grant access → Require device to be marked as compliant.',
      '5. Enable policy: Report-only.',
      '6. Create. Rescan in IAMAI.',
    ])
    // One condition resolved: the introducing line stays, with that condition under it and only that one.
    assert.deepEqual(linesOf({ ...name, 'policy.target.locationWords': 'Include: Any location; Exclude: All trusted locations' }), [
      '1. Go to Entra admin center → Conditional Access → Policies → New policy.',
      '2. Name: Core - Require - Compliant device.',
      '3. Target resources: All resources.',
      '4. Conditions → set only what IAMAI resolved, and set each one through its own **Configure** toggle:',
      '   Locations: set **Configure** to **Yes**, then **Include: Any location; Exclude: All trusted locations**.',
      '5. Grant → Grant access → Require device to be marked as compliant.',
      '6. Enable policy: Report-only.',
      '7. Create. Rescan in IAMAI.',
    ])
    // A line ending in a colon with no indented lines authored under it is left as written.
    assert.deepEqual(bindText('1. Do this:\n2. Then {{x}}. [omit this line when unavailable]\n3. Save.', {}, new Set()), { text: '1. Do this:\n3. Save.' })
  }
  // numbered Entra preview instructions retain unresolved optional settings
  {
    const pkg = compile({ optionalBindings: ['scope.group'], projection: { missing: { entra: 'e.create' } } },
      block({ id: 'e.create', channel: 'entra', states: ['missing'], format: 'markdown' }, '1. Open the policy.\n2. Select group {{scope.group}}.\n3. Save.'))
    const preview = projectPlanned(pkg, 'missing', {}, NO_RUNTIME, key => `<resolve ${key}>`)
    const text = preview.channels.find(a => a.channel === 'entra')?.text ?? ''
    assert.match(text, /1\. Open/)
    assert.match(text, /2\. Select group <resolve scope.group>/)
    assert.match(text, /3\. Save/)
    assert.ok(preview.hold?.missingBindings.includes('scope.group'))
  }
})

test('the source line is the date the sources were checked, or nothing: a baseline pin is provenance, never a line on the step (S6)', () => {
  const words = { sourceChecked: 'Source checked {date}' }
  const entra = block({ id: 'e.x', channel: 'entra', states: ['missing'], format: 'markdown' })
  const source = { id: 's', title: 'Conditional Access', url: 'https://learn.microsoft.com/x', checkedOn: '2026-09-10', userFacing: true }
  assert.equal(packageSourceLine(compile({ baselineAuthority: { pinCommit: 'a'.repeat(40) }, verifiedSources: [source] }, entra), words), 'Source checked Sep 10, 2026')
  assert.equal(packageSourceLine(compile({ baselineAuthority: { pinCommit: 'a'.repeat(40) } }, entra), words), null, 'a package naming a pin and no checked date was given a source line')
  assert.equal(packageSourceLine(compile({ verifiedSources: [{ ...source, checkedOn: 'last week' }] }, entra), words), null, 'a date that is not a date was shown')
})

// ------------------------------------------------------------------ withholding

const entraBlock = (id: string, states: string[]): string => block({ id, channel: 'entra', states, format: 'markdown' })

test('the library build withholds only the part that cannot be projected, support models lose only what the runtime cannot evaluate, and what remains validates', () => {
  // the library build withholds only the part that cannot be projected, and what remains validates
  {
    // A channel the runtime does not render goes with its projection key; the state keeps its other channels.
    const manual = withholdInvalid(compile({ projection: { missing: { entra: ['e.x'], manual: ['m.x'] } } }, entraBlock('e.x', ['missing']) + block({ id: 'm.x', channel: 'manual', states: ['missing'], format: 'markdown' })))
    assert.deepEqual(validatePackage(manual.pkg), [])
    assert.ok(manual.withheld.some((w) => /unsupported channel manual/.test(w)), manual.withheld.join('\n'))
    assert.equal(manual.pkg.blocks['m.x'], undefined)
    assert.deepEqual(Object.keys(manual.pkg.meta.projection.missing), ['entra'])
    assert.deepEqual(projectImplementation(manual.pkg, 'missing', {}).channels.map((c) => c.channel), ['entra'])
    // A key the runtime does not read that is not such a channel takes its whole state: what it meant is unknown.
    const selector = withholdInvalid(compile({ projection: { missing: { mode: 'selectByBinding', selector: 'x', variants: {}, entra: ['e.x'] } } }, entraBlock('e.x', ['missing'])))
    assert.deepEqual(validatePackage(selector.pkg), [])
    assert.equal(selector.pkg.meta.projection.missing, undefined)
    assert.equal(projectImplementation(selector.pkg, 'missing', {}).hold?.noProjection, true)
    // An Email with no audience or trigger goes alone.
    const email = withholdInvalid(compile({ projection: { reportOnly: { entra: ['e.x'], email: ['mail'] } } }, entraBlock('e.x', ['reportOnly']) + block({ id: 'mail', channel: 'email', states: ['reportOnly'], format: 'markdown' })))
    assert.deepEqual(validatePackage(email.pkg), [])
    assert.deepEqual(projectImplementation(email.pkg, 'reportOnly', {}).channels.map((c) => c.channel), ['entra'])
    // A Partial that is not composed cannot choose the corrections that apply, so it goes.
    const plain = withholdInvalid(compile({ projection: { partial: { entra: ['e.x'] } } }, entraBlock('e.x', ['partial'])))
    assert.deepEqual(validatePackage(plain.pkg), [])
    assert.equal(plain.pkg.meta.projection.partial, undefined)
    // A valid package loses nothing.
    const whole = compile(COMPOSE_META, COMPOSE_CONTENT)
    assert.deepEqual(withholdInvalid(whole), { pkg: whole, withheld: [] })
  }
  // support models lose only the tiles and scenarios the runtime cannot evaluate, and a template keeps its bindings
  {
    const model = {
      tiles: [
        { id: 'kept', label: 'Kept', rules: [{ if: { present: 'policy.target.displayName' }, result: 'Ready', line: '{{policy.target.displayName}} is resolved.' }] },
        { id: 'prose', label: 'Prose', rules: [{ when: 'it looks fine', result: 'Ready', line: 'Looks fine.' }] },
      ],
      excluded: '@groups',
      conclusionByState: { missing: 'create', verificationRequired: 'create' },
      conclusions: { create: 'Create the policy.' },
    }
    const template = JSON.stringify(model, null, 2).replace('"@groups"', '{{json:policy.target.excludeGroups}}')
    const scenarios = { scenarios: [{ id: 'kept', title: 'Kept', states: ['missing', 'verificationRequired'] }, { id: 'untitled', states: ['missing'] }] }
    const meta = { optionalBindings: ['policy.target.displayName', 'policy.target.excludeGroups'], projection: {}, supportBlocks: { readiness: ['r'], troubleshooting: ['t'] } }
    const { pkg } = withholdInvalid(compile(meta, block({ id: 'r', channel: 'readiness', states: ['missing'], format: 'json-template' }, template) + block({ id: 't', channel: 'troubleshooting', states: ['missing'], format: 'json' }, JSON.stringify(scenarios))))
    assert.deepEqual(validatePackage(pkg), [])
    assert.ok(pkg.blocks.r.text.includes('"excluded": {{json:policy.target.excludeGroups}}'), pkg.blocks.r.text)
    const readiness = packageReadiness(pkg, 'missing', { 'policy.target.displayName': 'P', 'policy.target.excludeGroups': ['g'] })!
    assert.deepEqual(readiness.tiles.map((t) => t.id), ['kept'])
    assert.equal(readiness.conclusion, 'Create the policy.')
    assert.deepEqual(troubleshootingFor(pkg, 'missing').map((s) => s.id), ['kept'])
    assert.deepEqual((JSON.parse(pkg.blocks.t.text) as typeof scenarios).scenarios[0].states, ['missing'])
    // A prose readiness model is withheld whole; the troubleshooting beside it stays.
    const prose = withholdInvalid(compile(meta, block({ id: 'r', channel: 'readiness', states: ['missing'], format: 'markdown' }, '## Readiness\nReady when resolved.') + block({ id: 't', channel: 'troubleshooting', states: ['missing'], format: 'json' }, JSON.stringify(scenarios))))
    assert.equal(packageReadiness(prose.pkg, 'missing', {}), null)
    assert.deepEqual(troubleshootingFor(prose.pkg, 'missing').map((s) => s.id), ['kept'])
  }
})

test('a correction module IAMAI cannot select, or a prerequisite it cannot read, takes what it gates with it and never releases it', () => {
  // a correction module IAMAI cannot select is withheld, and a change only it would have corrected holds Partial
  {
    const meta = structuredClone(COMPOSE_META)
    delete ((meta.projection!.partial.modules as Record<string, unknown>[])[1] as Record<string, unknown>).facts
    const { pkg, withheld } = withholdInvalid(compile(meta, COMPOSE_CONTENT))
    assert.deepEqual(validatePackage(pkg), [])
    assert.ok(withheld.some((w) => /mismatches\.users\.correct: IAMAI cannot select/.test(w)), withheld.join('\n'))
    assert.deepEqual(Object.keys(pkg.meta.projection.partial.mismatches as object), ['grant.correct'])
    const grant = projectImplementation(pkg, 'partial', { 'policy.current.id': 'p1', [CHANGED_FIELDS_BINDING]: ['grantControls.operator'] })
    assert.deepEqual(grant.channels.find((c) => c.channel === 'entra')!.blocks, ['e.open', 'e.grant', 'e.after'])
    const users = projectImplementation(pkg, 'partial', { 'policy.current.id': 'p1', [CHANGED_FIELDS_BINDING]: ['grantControls.operator', 'conditions.users.includeUsers'] })
    assert.deepEqual(users.channels, [])
    assert.deepEqual(users.hold?.unknownMismatches, ['conditions.users.includeUsers'])
  }
  // a prerequisite the runtime cannot read takes the transition it gates with it, never releasing it
  {
    const content = entraBlock('e.enforce', ['readyToEnforce']) + entraBlock('e.create', ['missing'])
    const prerequisites = [{ id: 'checked', class: 'humanConfirmation', requiredBefore: 'readyToEnforce->inPlace', evidence: { present: 'never.declared' } as never }]
    const { pkg } = withholdInvalid(compile({ prerequisites, projection: { missing: { entra: ['e.create'] }, readyToEnforce: { entra: ['e.enforce'] } } }, content))
    assert.deepEqual(validatePackage(pkg), [])
    assert.deepEqual(pkg.meta.prerequisites, [])
    assert.equal(pkg.meta.projection.readyToEnforce, undefined)
    assert.deepEqual(projectImplementation(pkg, 'readyToEnforce', {}).channels, [])
    assert.deepEqual(projectImplementation(pkg, 'missing', {}).channels.map((c) => c.channel), ['entra'])
  }
})

test('a state with nothing to implement projects nothing, whatever the package authors for it', () => {
  const content = block({ id: 'ai.x', channel: 'aiInfo', states: ['blocked', 'inPlace'], format: 'markdown' }) + block({ id: 'mail', channel: 'email', states: ['needsDecision'], format: 'markdown', audience: 'decision-owner', communicationTrigger: 'decision-needed' })
  const pkg = compile({ projection: { blocked: { aiInfo: ['ai.x'] }, inPlace: { aiInfo: ['ai.x'] }, needsDecision: { email: ['mail'] } } }, content)
  assert.deepEqual(validatePackage(pkg), [])
  assert.deepEqual([...NO_ACTION_STATES].sort(), ['blocked', 'inPlace', 'needsDecision', 'notLicensed', 'sourceConflict'])
  for (const state of NO_ACTION_STATES) assert.deepEqual(projectImplementation(pkg, state, {}), { state, hold: null, channels: [] })
})

