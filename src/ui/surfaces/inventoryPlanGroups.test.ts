// Inventory lists the groups the plan itself names (F-049). On the demo's first
// scan no policy excludes Core - Exclusions yet, and 1.2 calls it the plan's
// exclusions group: "Everything the scan read" left it out.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { buildNameDirectory } from '../../names.ts'
import { groupEntriesOf, groupsModel, inventoryTables, listedGroupsOf, planGroupRolesOf, policyFactsOf, referencedGroupsOf } from './inventoryTables.ts'

test('the plan\'s exclusions group is listed, and says it is the plan\'s, before any policy references it', () => {
  const f = fixture('demo')
  const referenced = referencedGroupsOf(policyFactsOf(f.snapshot))
  const plan = planGroupRolesOf(f.mapping)
  const names = buildNameDirectory(f.snapshot, f.groups)
  const entries = groupEntriesOf(f.groups)
  assert.equal(groupsModel(referenced, entries, names, f.snapshot).rows.some((r) => r.name === 'Core - Exclusions'), false, 'the demo no longer shows the gap this fixes')

  const rows = groupsModel(referenced, entries, names, f.snapshot, plan).rows
  const exclusions = rows.find((r) => r.name === 'Core - Exclusions')
  assert.ok(exclusions, 'the plan\'s exclusions group is missing')
  assert.equal(exclusions.policies, "The plan's exclusions group")
  assert.equal(exclusions.members, '2')
  // The groups the policies reference stay as they were.
  assert.match(rows.find((r) => r.name === 'Core - Break glass')!.policies, /\(exclude\)/)
  assert.equal(listedGroupsOf(referenced, plan).size, referenced.size + 1)

  // The Groups CSV on Export carries it too.
  const csv = inventoryTables(f.snapshot, f.groups, plan).find((t) => t.id === 'groups')!
  assert.ok(csv.rows.some((row) => row.includes('Core - Exclusions') && row.includes("The plan's exclusions group")))
})

test('Inventory and Export hand the plan\'s groups to the table, and the tab counts them', () => {
  const page = readFileSync('src/ui/surfaces/InventoryPage.tsx', 'utf8')
  assert.match(page, /const planGroups = useMemo\(\(\) => planGroupRolesOf\(planMapping\), \[planMapping\]\)/)
  assert.match(page, /badge: badge\('caPolicies', listedGroups\.size\)/)
  assert.match(page, /groupsModel\(referenced, groups, names, snapshot, plan\)/)
  assert.match(readFileSync('src/ui/surfaces/Export.tsx', 'utf8'), /inventoryTables\(snapshot, data\.groups, planGroupRolesOf\(data\.mapping\)\)/)
})
