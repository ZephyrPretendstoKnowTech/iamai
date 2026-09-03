// Connect shows one status block, never two (connectStatus.ts). Each state is
// rendered on the mock's fixtures and the other two states' strings must be
// absent: Role missing (the token lacks the core roles) wins over Scan finished
// with gaps, which wins over Scan complete.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../../testing/uiSnapshot.ts'
import { REFUSED, gapsSnapshot, noRolesToken } from '../../testing/gapsFixture.ts'
import { coreGaps } from '../../graph/collect/coreSections.ts'
import { coreRoleGap, rolesInToken } from '../../graph/collect/tokenRoles.ts'
import { connectStatus, statusStrings } from './connectStatus.ts'
import { absoluteDate } from '../../copy/dates.ts'

const upn = 'alex@example.com'
const full = fixtureSnapshot()
const last = { snapshot: full, at: full.asOf }
const roleGap = coreRoleGap(rolesInToken(noRolesToken()))
const gaps = coreGaps(gapsSnapshot())

// The strings that belong to one state and no other.
const OWN = {
  roleMissing: ['holds none of the roles that read', 'Sign in with another account'],
  gaps: ['Scan finished with gaps', 'Open the last full plan'],
  complete: ['Scan complete ·', 'Open the plan →'],
} as const

const rendered = (s: ReturnType<typeof connectStatus>): string => statusStrings(s).join('\n')

function onlyItsOwn(kind: keyof typeof OWN, text: string): void {
  for (const own of OWN[kind]) assert.ok(text.includes(own), `${kind} renders "${own}"`)
  for (const [other, strings] of Object.entries(OWN)) {
    if (other === kind) continue
    for (const s of strings) assert.ok(!text.includes(s), `${kind} must not render ${other}'s "${s}"`)
  }
}

test('Role missing: one warning naming the account, the three sections and the ask, a Sign in with another account button, nothing of the other states', () => {
  const s = connectStatus({ roleGap, gaps, lastScan: last, upn })
  assert.equal(s.kind, 'roleMissing', 'the role gap wins over the gaps and the last scan')
  const text = rendered(s)
  assert.ok(text.includes(`${upn} holds none of the roles that read Conditional Access policies, people and sign-in records.`), text)
  assert.ok(text.includes('Ask for Security Reader, or Global Reader (reads everything IAMAI needs, writes nothing).'), text)
  onlyItsOwn('roleMissing', text)
})

test('Scan finished with gaps: the section rows with their roles, Open the last full plan (date) when a full plan exists, Scan tenant, no Scan complete line', () => {
  const s = connectStatus({ roleGap: null, gaps, lastScan: last, upn })
  assert.equal(s.kind, 'gaps')
  if (s.kind !== 'gaps') return
  assert.deepEqual(s.rows, ['Conditional Access policies: not read · ask for Security Reader', `Sign-in records: ${REFUSED.replace(/\.$/, '')} · ask for Reports Reader`])
  assert.equal(s.openLastFull, `Open the last full plan (${absoluteDate(full.asOf)})`)
  assert.equal(s.scan, 'Scan tenant')
  onlyItsOwn('gaps', rendered(s))
  const first = connectStatus({ roleGap: null, gaps, lastScan: null, upn })
  assert.equal(first.kind === 'gaps' && first.openLastFull, null, 'no full plan yet: nothing to open')
})

test('Scan complete: the summary line, Open the plan →, Scan tenant, nothing of the other states', () => {
  const s = connectStatus({ roleGap: null, gaps: [], lastScan: last, upn })
  assert.equal(s.kind, 'complete')
  const text = rendered(s)
  assert.match(text, /^Scan complete · 5 people · 3 policies · sign-ins [A-Z][a-z]{2} \d+ → [A-Z][a-z]{2} \d+$/m)
  assert.ok(text.includes('Scan tenant'))
  onlyItsOwn('complete', text)
  assert.equal(connectStatus({ roleGap: null, gaps: [], lastScan: null, upn }).kind, 'none', 'no scan yet: the scan offer alone')
})
