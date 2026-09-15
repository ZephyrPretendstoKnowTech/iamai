// S3 C05/C06 runtime matrix: every step with an implementation package, in synthetic plans,
// rendered through stepBodyOf exactly as the Implementation region draws it. Per step:
// package state, how the region is drawn (executable / preview / held / engine), each
// channel's standing, and type checks on what JSON and PowerShell actually carry.
// No network. Usage: node docs/preview-corrections/probes/s3-matrix.ts [fixture ...]
import { allCuratedFixtures, allFixtures, curatedFixture, noExclusionsAnswer } from '../../../src/roadmap/fixtures/index.ts'
import type { Fixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { personReadiness } from '../../../src/scoring/phishingResistant.ts'
import { stepBodyOf } from '../../../src/ui/surfaces/stepBody.ts'
import { implementationPackageFor, packageStateOf, packageBindings, packageRuntime } from '../../../src/ui/surfaces/stepPackage.ts'
import { projectSafely } from '../../../src/content/implementation/project.ts'
import type { StepVarContext } from '../../../src/ui/surfaces/stepVars.ts'
import type { Step } from '../../../src/roadmap/types.ts'

const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)

/** Findings on a JSON body the JSON tab shows: every field whose type Graph would reject. */
function jsonIssues(text: string): string[] {
  const out: string[] = []
  const body = text.replace(/^(GET|POST|PATCH|PUT|DELETE) \S+\n+/i, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return ['does-not-parse']
  }
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'string' && /‹|\{\{/.test(v)) out.push(`placeholder@${path}`)
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k)
  }
  walk(parsed, '')
  const o = (parsed ?? {}) as Record<string, unknown>
  for (const k of ['conditions', 'grantControls', 'sessionControls']) if (k in o && o[k] !== null && typeof o[k] !== 'object') out.push(`${k}:${typeof o[k]}`)
  const users = (o.conditions as { users?: Record<string, unknown> } | undefined)?.users
  for (const k of ['excludeGroups', 'includeGroups', 'excludeUsers', 'includeUsers', 'includeRoles']) if (users && k in users && !Array.isArray(users[k])) out.push(`users.${k}:${typeof users[k]}`)
  return out
}

/** Findings on a script the PowerShell tab shows: a mandatory parameter nothing supplies, a stand-in value. */
function psIssues(text: string): string[] {
  const out: string[] = []
  if (/‹[^›]*›/.test(text)) out.push(`stand-in:${[...new Set(text.match(/‹[^›]*›/g))].join('|')}`)
  const mandatory = [...text.matchAll(/\[Parameter\(Mandatory=\$true\)\](?:\[[^\]]*\])*\[[a-z]+\]\$([A-Za-z]+)/gi)].map((m) => m[1])
  // invocation.ts renders `function <fn> {…}` then one `<fn> -Mode …` line per run; a template is the bare script.
  const fn = /^function ([\w-]+) \{/m.exec(text)?.[1]
  const called = fn !== undefined && new RegExp(`^${fn} `, 'm').test(text)
  if (mandatory.length > 0 && !called) out.push(`uncalled-template(mandatory:${mandatory.join(',')})`)
  return out
}

type Row = { plan: string; step: string; kind: string; state: string; drawn: string; channels: string; hold: string; issues: string }

function planRows(label: string, f: Fixture, ready: boolean): Row[] {
  const first = runFixture(f)
  const r = ready ? runFixture(f, { viability: first.viability.map((v) => ({ ...v, readiness: READY })) } as never) : first
  const rows: Row[] = []
  for (const step of r.steps as Step[]) {
    const pkg = implementationPackageFor(step)
    if (!pkg) continue
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } as StepVarContext
    const b = stepBodyOf(step, ctx)
    const state = packageStateOf(step, b.contract, f.snapshot)
    const bindings = state ? packageBindings(step, ctx, b.contract) : null
    const rt = state && bindings ? packageRuntime(pkg, state, bindings, {}) : null
    const projection = state && bindings && rt ? projectSafely(pkg, state, bindings, rt.runtime, () => {}) : null
    const preview = b.previewNote !== null
    const drawn = !b.packaged ? 'engine' : preview ? 'preview' : (projection?.channels.length ?? 0) > 0 ? 'executable' : `held:${b.empty.key}`
    const issues: string[] = []
    for (const a of b.artifacts) {
      if (a.unavailable) continue
      if (a.text().replace(/\*\*Contains tenant context[^*]*\*\*/g, '').trim() === '') issues.push(`${a.id} empty-text`)
      if (a.id === 'json') issues.push(...jsonIssues(a.text()).map((i) => `json ${i}`))
      if (a.id === 'ps') issues.push(...psIssues(a.text()).map((i) => `ps ${i}`))
    }
    const hold = projection?.hold
    const holdText = hold ? [hold.missingBindings.length ? `missing=${hold.missingBindings.join(',')}` : '', hold.pendingPrerequisites.length ? `prereq=${hold.pendingPrerequisites.join(',')}` : '', hold.unknownMismatches.length ? `unknownMismatch=${hold.unknownMismatches.join(',')}` : '', hold.noProjection ? 'noProjection' : '', hold.invalid.length ? `invalid=${hold.invalid.join(';')}` : ''].filter(Boolean).join(' ') : ''
    const degraded = (projection?.degraded ?? []).map((d) => `${d.channel}(${[...d.missingBindings, ...d.invalid].join(',')})`).join(' ')
    rows.push({
      plan: label,
      step: step.id,
      kind: `${step.kind}`,
      state: String(state),
      drawn,
      channels: b.artifacts.map((a) => `${a.id}:${a.unavailable ? '-' : '+'}`).join(' '),
      hold: [holdText, degraded ? `degraded ${degraded}` : ''].filter(Boolean).join(' | '),
      issues: issues.join('; '),
    })
  }
  return rows
}

const wanted = process.argv.slice(2)
const plans: [string, Fixture, boolean][] = []
if (wanted.length === 0 || wanted.includes('curated')) {
  plans.push(['demo-week2+curated+ready', curatedFixture('demo-week2'), true])
  plans.push(['demo-week2+curated+unanswered', noExclusionsAnswer(curatedFixture('demo-week2')), false])
}
if (wanted.length === 0 || wanted.includes('all')) {
  for (const f of allFixtures()) if (f.name !== 'huge') plans.push([`${f.name}`, f, false])
  for (const f of allCuratedFixtures()) if (f.name !== 'huge') plans.push([`${f.name}+curated`, f, false])
}
for (const [label, f, ready] of plans) {
  for (const row of planRows(label, f, ready)) console.log([row.plan, row.step, row.kind, row.state, row.drawn, row.channels, row.hold, row.issues].join(' \t '))
}
