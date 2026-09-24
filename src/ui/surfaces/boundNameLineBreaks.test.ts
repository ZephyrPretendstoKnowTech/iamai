// Review 6 R6-1: a removed exclusion's name, and a guests member policy's own name,
// are bound into a script's `#` comment line, an Entra list item and AI Info. A tenant
// name holding a line break ended that line, so the rest of the name became a command
// in the handed-over script and its `param(` block no longer parsed. A bound name now
// stays on its line in every text channel, and in the export's removal line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from '../../content/implementation/protocol.ts'
import { bindText } from '../../content/implementation/project.ts'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../mapping/safetyChoice.ts'
import { personReadiness } from '../../scoring/phishingResistant.ts'
import { stepBodyOf } from './stepBody.ts'
import { stepExportView } from './stepExport.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)
const B = 'c0100000-0000-4000-8000-000000000002'
const X = 'dddddddd-0000-4000-8000-00000000000d'
const COMMAND = 'Remove-MgGroup -GroupId 00000000-0000-0000-0000-000000000000'
const BREAKS = ['\n', '\r\n', '\r', '\u2028', '\u0085']

test('a text binding holding a line break stays on its line in every registered text block; a JSON binding keeps its escaped break; a plain name is unchanged', () => {
  {
    for (const br of BREAKS) {
      const bound = bindText(`# This change removes {{k}} from the policy's exclusions.\nparam(`, { k: [`Contractors${br}${COMMAND}`, 'guest or external users'] }, new Set())
      assert.deepEqual(bound, { text: `# This change removes Contractors ${COMMAND}, guest or external users from the policy's exclusions.\nparam(` }, JSON.stringify(br))
      assert.deepEqual(bindText('   Open "{{p}}".', { p: `Policy${br}B` }, new Set()), { text: '   Open "Policy B".' }, JSON.stringify(br))
    }
    assert.deepEqual(bindText('{ "displayName": {{json:p}} }', { p: 'a\nb' }, new Set()), { text: '{ "displayName": "a\\nb" }' })
    // Control: an ordinary name, a tab and non-ASCII letters are left as they are.
    assert.deepEqual(bindText('# removes {{k}}', { k: 'Contoso – Staff\tÉquipe' }, new Set()), { text: '# removes Contoso – Staff\tÉquipe' })
  }
  {
    let blocks = 0
    for (const [id, pkg] of Object.entries(PACKAGES)) {
      for (const [bid, block] of Object.entries(pkg.blocks)) {
        if (/json/.test(String(block.meta.format))) continue
        const keys = [...new Set([...block.text.matchAll(/\{\{(?:json:)?([A-Za-z0-9_.-]+)\}\}/g)].map((m) => m[1]))]
        if (keys.length === 0) continue
        const plain = bindText(block.text, Object.fromEntries(keys.map((k) => [k, 'Contractors'])), new Set())
        const broken = bindText(block.text, Object.fromEntries(keys.map((k) => [k, `Contractors\n${COMMAND}`])), new Set())
        assert.ok('text' in plain && 'text' in broken, `${id} ${bid}`)
        assert.equal(broken.text.split('\n').length, plain.text.split('\n').length, `${id} ${bid}: a bound value ended its line`)
        assert.doesNotMatch(broken.text, /^\s*Remove-MgGroup/m, `${id} ${bid}`)
        blocks++
      }
    }
    // Premise: the 27 script blocks and the Entra/AI blocks with text bindings were read.
    assert.ok(blocks > 100, String(blocks))
    const scripts = Object.values(PACKAGES).flatMap((p) => Object.values(p.blocks)).filter((b) => b.meta.format === 'powershell' && /\{\{(?!json:)/.test(b.text))
    assert.ok(scripts.length >= 25, String(scripts.length))
  }
})

test('a removed exclusion named with a line break stays one comment line in the handed-over script, one Save item in Entra, and one export line', () => {
  for (const br of ['\n', '\r\n', '\r']) {
    const evil = `Contractors${br}${COMMAND}`
    const base = curatedFixture('demo-week2')
    const f = { ...base, groups: new Map(base.groups) }
    const excl = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
    const staffGroup = [...f.groups.keys()].find((id) => id !== excl)!
    const src = structuredClone(f.groups.get(staffGroup)) as unknown as Record<string, unknown>
    f.groups.set(X, { ...src, groupId: X, displayName: evil, memberIds: ((src.memberIds as string[] | undefined) ?? []).slice(0, 1), memberCount: 1 } as never)
    const ca = f.snapshot.config.caPolicies!
    const keep = (ca.rows as { displayName?: string }[]).filter((p) => !/MFA for all users|Admins phishing-resistant|Admin sign-in|session/i.test(String(p.displayName)))
    const row = { id: B, displayName: 'Policy B', state: 'enabled', conditions: { users: { includeGroups: [staffGroup], excludeGroups: [excl, X] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }
    const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [row, ...keep] } } }
    const scored = runFixture({ ...f, snapshot } as never, { snapshot } as never).viability
    const r = runFixture({ ...f, snapshot } as never, { snapshot, viability: scored.map((v) => ({ ...v, readiness: READY })) } as never)
    const step = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')!
    const nameOf = (id: string): string => r.input.names!.label(id)
    // Premises: the directory carries the break, and the correction removing that group is handed over.
    assert.ok(nameOf(X).includes(br), JSON.stringify(nameOf(X)))
    assert.deepEqual((step.action.resolution?.policies ?? []).map((o) => [o.mode, o.policyId, o.removes?.ids]), [['update', B, [X]]])
    const ctx = { snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } as never
    const body = stepBodyOf(step, ctx)
    assert.equal(body.previewNote, null)
    const tab = (id: string): string => {
      const a = body.artifacts.find((x) => x.id === id)
      assert.ok(a && !a.unavailable, id)
      return a.text()
    }
    const said = `This change removes Contractors ${COMMAND} from the policy's exclusions.`
    const ps = tab('ps')
    // The line opens the function body, and the script's parameters follow it.
    const psLines = ps.split('\n')
    const k = psLines.findIndex((l) => l.startsWith(`# ${said}`))
    assert.deepEqual([psLines[k - 1], psLines[k + 1]], ['function Invoke-IAMAIStep {', 'param('], ps.slice(0, 500))
    assert.doesNotMatch(ps, /^\s*Remove-MgGroup/m)
    const entra = tab('portal')
    assert.ok(entra.startsWith(said), entra)
    assert.doesNotMatch(entra, /^\s*Remove-MgGroup/m)
    assert.ok(tab('ai').includes(said))
    const exported = stepExportView(step, ctx).whatToDo.filter((l) => l.includes('This change removes'))
    assert.equal(exported.length, 1)
    assert.ok(exported[0].startsWith(said) && !/[\r\n]/.test(exported[0]), JSON.stringify(exported))
  }
})
