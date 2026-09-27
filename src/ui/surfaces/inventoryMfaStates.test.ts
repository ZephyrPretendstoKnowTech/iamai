// The Accounts tab defines its MFA state words (F-137): "Possibly broken" and
// "Never prompted" stood in the column with no definition anywhere on the page.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MFA_STATE } from '../../copy/definitions.ts'
import { app } from '../../content/content.ts'
import { mfaStatesText } from './inventoryTables.ts'

test('every MFA state the column shows is defined once, in its own words', () => {
  const text = mfaStatesText()
  for (const d of Object.values(MFA_STATE)) assert.ok(text.includes(`${d.title}: ${d.text}`), d.title)
  assert.match(text, /^Verified: .*Possibly broken: A method is registered but nothing shows it working\./)
  assert.equal(app.inventory.mfaStatesLead, 'What each MFA state means')
  const page = readFileSync('src/ui/surfaces/InventoryPage.tsx', 'utf8')
  assert.match(page, /<Heading text=\{C\.tabs\.people\} source="people" \/>\n[^\n]*\n\s+<p className="reason">\{app\.inventory\.mfaStatesLead\} <InfoTip title=\{P\.columns\.mfa\} text=\{mfaStatesText\(\)\} \/><\/p>/)
})
