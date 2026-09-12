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
import { curatedFixture, strengthMissing } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { CONTRACT, stepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { implementationPackageFor, packageBindings, packageRuntime, packageSourceLine, packageStateOf, planningPreview } from './stepPackage.ts'
import { projectSafely } from '../../content/implementation/project.ts'

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

test('the state selects the instructions: create, correct, observe, enforce', () => {
  const entra = (state: 'missing' | 'partial' | 'reportOnly' | 'readyToEnforce'): string => {
    const p = projectImplementation(BY_STATE, state, NAME, NO_RUNTIME)
    assert.equal(p.hold, null, state)
    return p.channels.find((c) => c.channel === 'entra')!.text
  }
  assert.match(entra('missing'), /^Create /)
  assert.match(entra('partial'), /^Correct /)
  assert.match(entra('reportOnly'), /^Observe .*validate/)
  assert.match(entra('readyToEnforce'), /^Turn .* on\.$/)
})

test('Blocked offers nothing executable; its planning text is visible and never copyable', () => {
  assert.ok(NO_ACTION_STATES.has('blocked'))
  const executable = projectImplementation(BY_STATE, 'blocked', NAME, NO_RUNTIME)
  assert.deepEqual(executable.channels, [], 'a blocked state was handed an artifact')
  const planned = projectPlanned(BY_STATE, 'blocked', {}, NO_RUNTIME, (b) => `‹${b}›`)
  assert.equal(planned.preview, true)
  assert.match(planned.channels.find((c) => c.channel === 'entra')!.text, /Create \*\*‹policy\.target\.displayName›\*\*/, 'the planned work is not visible with its stand-ins')
  // The page: Copy — inline and in the expanded viewer — only where there is no preview.
  assert.match(CONTENT_STEP, /const copyable = preview === null && active !== null/)
  assert.equal((CONTENT_STEP.match(/\{copyable && \(/g) ?? []).length, 2, 'the inline Copy and the viewer Copy do not both read the one rule')
  assert.match(CONTENT_STEP, /className="dialog-toolbar"/, 'the expanded viewer has no toolbar for its Copy')
})

/** The curated demo tenant with no custom authentication strength of its own: the step that creates the baseline's is on the plan. */
function strengthStep() {
  const base = curatedFixture('demo-week2')
  const snapshot = strengthMissing(base.snapshot)
  const f = { ...base, snapshot }
  const r = runFixture(f, { snapshot } as never)
  const step = r.steps.find((s) => s.id === 's-prereq-auth-strength')
  assert.ok(step, 'the tenant without the strength has no step to create it')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const c = stepContract(step, ctx)
  return { step, ctx, c, snapshot: f.snapshot }
}

test('Authentication Strength (Missing) shows the Entra create instructions (regression)', () => {
  const { step, ctx, c, snapshot } = strengthStep()
  const pkg = implementationPackageFor(step)!
  const state = packageStateOf(step, c, snapshot)
  assert.equal(state, 'missing')
  const bindings = packageBindings(step, ctx, c)
  assert.equal(bindings['strength.target.displayName'], step.naming?.proposed, 'the strength the step makes is not bound under the name its package calls it')
  const projection = projectSafely(pkg, 'missing', bindings, packageRuntime(pkg, 'missing', bindings, {}).runtime)
  assert.equal(projection.hold, null, JSON.stringify(projection.hold))
  const entra = projection.channels.find((ch) => ch.channel === 'entra')
  assert.ok(entra, 'the Entra channel is withheld')
  assert.match(entra.text, /New authentication strength/)
  assert.match(entra.text, new RegExp(String(step.naming?.proposed).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'the create instructions do not name the strength')
  assert.equal(planningPreview(pkg, step, c, snapshot, bindings, NO_RUNTIME, projection), null, 'an executable projection was shadowed by a preview')
})

// ------------------------------------------- 2. no channel that is only an error

test('a channel that would only say it is missing is not offered, and nothing stands in for it', () => {
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
})

// --------------------------------------------- 3. the JSON channel is a request

const CREATE = '{ "displayName": {{json:policy.target.displayName}}, "state": "enabledForReportingButNotEnforced" }'

test('the JSON channel is offered only as a request: method, endpoint, body and a bound target identifier', () => {
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
})

// ---------------------------------------------------------- 4. provenance line

test('the Implementation region says "Source checked <date>" from the authored field, and never a baseline pin', () => {
  const entra = block({ id: 'e.x', channel: 'entra', states: ['missing'], format: 'markdown' })
  const source = { id: 's', title: 'x', url: 'https://learn.microsoft.com/x', checkedOn: '2026-09-10', userFacing: true }
  assert.equal(packageSourceLine(compile({ verifiedSources: [source], baselineAuthority: { pinCommit: 'a'.repeat(40) } }, entra), W), 'Source checked Sep 10, 2026')
  assert.equal(packageSourceLine(compile({ baselineAuthority: { pinCommit: 'a'.repeat(40) } }, entra), W), null, 'a pin was shown as a source line')
  assert.equal(packageSourceLine(compile({ verifiedSources: [{ ...source, userFacing: false }] }, entra), W), null, 'a research-only source dated the line')
  assert.equal(W.sourceChecked, 'Source checked {date}')
  assert.equal('sourcePins' in W, false)
  const words = JSON.stringify(CONTENT)
  for (const gone of ['Authored against baseline', 'plan pins', 'Source updated']) assert.equal(words.includes(gone), false, `content still says "${gone}"`)
  assert.equal(CONTENT_STEP.includes('sourcePins'), false)
  assert.match(CONTENT_STEP, /packageSourceLine\(sourcePkg, W\)/)
})

// -------------------------------------------------- 5. Microsoft Learn · Troubleshooting

test('Microsoft Learn · Troubleshooting sit under Implementation, left-aligned, the label exactly "Microsoft Learn"', () => {
  assert.equal(W.learn, 'Microsoft Learn')
  const support = CONTENT_STEP.slice(CONTENT_STEP.indexOf('<div className="impl-support">'), CONTENT_STEP.indexOf('</div>', CONTENT_STEP.indexOf('{source && <span className="impl-support-source">')))
  const learnAt = support.indexOf('{W.learn}')
  const troubleshootingAt = support.indexOf('{W.troubleshooting}')
  const sourceAt = support.indexOf('impl-support-source')
  assert.ok(learnAt >= 0 && troubleshootingAt > learnAt && sourceAt > troubleshootingAt, 'the support line is not Microsoft Learn · Troubleshooting … source')
  assert.match(support, /className="impl-support-links"/)
  const css = read('src/ui/app.css')
  const rule = (selector: string): string => css.slice(css.indexOf(`${selector} {`), css.indexOf('}', css.indexOf(`${selector} {`)))
  assert.match(rule('.step .impl-support'), /justify-content: flex-start;/, 'the support line is not left-aligned')
  assert.match(rule('.step .impl-support-source'), /margin-left: auto;/)
  // One Learn link per step: in Why only where no Implementation region is drawn.
  assert.match(CONTENT_STEP, /\{learnUrl && !showImplementation && \(/)
})

// ------------------------------------------------------------ 6. expanded viewer

test('the expanded viewer is materially larger than the inline preview, keeps the channel, and is responsive', () => {
  const css = read('src/ui/app.css')
  const rule = (selector: string, from = 0): string => {
    const at = css.indexOf(`${selector} {`, from)
    return css.slice(at, css.indexOf('}', at))
  }
  assert.match(rule('.step-dialog.step-dialog-wide'), /width: min\(1400px, calc\(100vw - 48px\)\);/)
  assert.match(rule('.step-dialog.step-dialog-wide'), /height: calc\(100vh - 48px\);/)
  assert.match(rule('.step-dialog .dialog-code'), /font-size: var\(--t-2\);/, 'the viewer’s code is not at reading size')
  // The phone rule lives in the step's own 650px block, beside the footer's stacking.
  const narrow = css.lastIndexOf('@media (max-width: 650px) {')
  assert.ok(css.indexOf('.step-dialog.step-dialog-wide {', narrow) > narrow, 'the viewer has no narrow-width rule')
  assert.match(rule('.step-dialog.step-dialog-wide', narrow), /width: calc\(100vw - 16px\);/)
  // The inline preview is unchanged.
  assert.match(rule('.step .impl-preview'), /height: 112px;/)
  // One `tab` state feeds both the preview's tabs and the dialog's, so the viewer opens on the channel the preview shows.
  assert.equal((CONTENT_STEP.match(/active=\{tab\} onSelect=\{\(id\) => setChosen\(id as Channel\)\}/g) ?? []).length, 2)
})
