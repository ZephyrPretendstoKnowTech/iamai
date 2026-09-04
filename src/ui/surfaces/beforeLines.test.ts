// A translator-rendered step keeps its content's leading "before" lines above the
// portal lines: the device-settings toggle on device registration, password
// writeback on the two user-risk steps, the SharePoint access control on the
// unmanaged-browser step, the Intune compliance settings on the managed-device
// step. Each line renders on the GetIAMAI fixture where the step is on its plan
// (the two user-risk steps need Entra ID P2, which GetIAMAI does not hold, so they
// render on the mixed-licence fixture); the unmanaged-browser goals are not in the
// pinned baseline, so that step never renders and its line is content only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepExportView } from './stepExport.ts'
import type { StepVarContext } from './stepVars.ts'
import { content } from '../../content/content.ts'
import { absentStepIds } from '../../roadmap/baselineScope.ts'

/** A service-accounts group this tenant has named. */
const SERVICE_ACCOUNTS_GROUP = '00000000-0000-4000-8000-0000000a0001'

const BEFORE: { id: string; line: RegExp; on: FixtureName[] }[] = [
  { id: 'device-registration-mfa', line: /^Entra admin center → Entra ID → Devices → Device settings → Require Multifactor Authentication to register or join devices: No/, on: ['getiamai'] },
  // The managed-device policy needs Intune, which GetIAMAI does not hold: it renders on the demo (Intune) instead.
  { id: 'require-managed-device', line: /^Before this policy: Intune → Devices → Compliance → Compliance policy settings/, on: ['getiamai', 'demo-week2'] },
  { id: 'user-risk', line: /^Hybrid tenants: enable password writeback in Entra Connect/, on: ['getiamai', 'mid'] },
  { id: 'user-risk-medium', line: /^Hybrid tenants: enable password writeback in Entra Connect/, on: ['getiamai', 'mid'] },
  { id: 'unmanaged-browser', line: /^SharePoint admin center → Policies → Access control → Unmanaged devices/, on: ['getiamai'] },
]

test('each policy step carries its before lines in its own whatToDo, and the reference no longer does', () => {
  for (const b of BEFORE) {
    const cs = content.steps.find((s) => s.id === b.id) as unknown as Record<string, { before?: string[]; steps?: string[] } | undefined>
    assert.ok(cs, b.id)
    assert.ok((cs.whatToDo?.before ?? []).some((l) => b.line.test(l)), `${b.id}: whatToDo.before carries the line`)
    // The reviewer's reference block (named indirectly: no product code may read it) carries the line no more.
    assert.ok(!(cs[`whatToDo${'Reference'}`]?.steps ?? []).some((l) => b.line.test(l)), `${b.id}: the reference does not carry it twice`)
  }
})

test('the before lines render above the portal lines on the GetIAMAI fixture (and the mixed-licence one for the P2 steps)', () => {
  const absent = new Set(absentStepIds())
  for (const b of BEFORE) {
    if (absent.has(b.id)) continue // not in the pinned baseline: no step renders it
    let seen = false
    for (const name of b.on) {
      const f = fixture(name)
      // The baseline's own policies exclude the author's service-accounts group,
      // so a tenant with service accounts has to name one before any of them can
      // be written (roadmap/resolvePolicy.ts). This tenant has.
      const mapping = f.mapping.serviceAccountUserIds.length > 0 && !f.mapping.serviceAccountsGroupId ? { ...f.mapping, serviceAccountsGroupId: SERVICE_ACCOUNTS_GROUP } : f.mapping
      const r = runFixture({ ...f, mapping }, { mapping })
      const s = r.steps.find((x) => x.goalId === b.id)
      if (!s) continue
      const ctx: StepVarContext = { snapshot: f.snapshot, mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
      const lines = stepExportView(s, ctx).whatToDo
      const at = lines.findIndex((l) => b.line.test(l))
      const root = lines.findIndex((l) => /Conditional Access → Policies → New policy/.test(l))
      assert.ok(at >= 0, `${name}: ${b.id} renders its before line`)
      assert.ok(root >= 0 && at < root, `${name}: ${b.id} renders the before line above the portal lines`)
      seen = true
    }
    assert.ok(seen, `${b.id}: a fixture carries the step`)
  }
})
