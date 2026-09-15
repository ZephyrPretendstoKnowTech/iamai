// Consolidated batch items 1 and 4: the public wording's last predictive and data-handling
// phrases, the method-saving sentence, the registration evidence boundary (release review R05)
// and the Emails that described planned or unverifiable work as done.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import content from '../../../docs/design/content.json' with { type: 'json' }
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from '../../content/implementation/protocol.ts'

const read = (path: string): string => readFileSync(path, 'utf8')
const pages = (content as unknown as { pages: Record<string, Record<string, unknown>> }).pages
const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

test('the home page keeps its hidden-risk positioning and makes no predictive or blanket data claim', () => {
  const home = pages.home
  assert.equal(home.h1, 'Find the gaps. Catch the hidden risks. Plan a safer rollout.')
  assert.equal((home.trust as { title: string }[])[1].title, 'Your plan is built in your browser')
  const publicText = [JSON.stringify(pages.home), JSON.stringify(pages.connect), read('home/index.html'), read('README.md')].join('\n')
  for (const claim of [/what (would|will) break/i, /predicted to affect/i, /never leaves the browser/i, /nothing (is )?sent anywhere/i, /stay in your browser/i]) {
    assert.doesNotMatch(publicText, claim, String(claim))
  }
  assert.match(String(pages.connect.h1), /who could be affected/)
  // The Connect public-beta notice and the baseline's attribution are untouched.
  assert.match(JSON.stringify(pages.connect), /Public beta — review before applying/)
  assert.match(String(home.baseline), /built by Jon Hope, a Microsoft MVP/)
})

test('the method disclosure says IAMAI saves the details its checks need, without phone numbers, and never that it saves method types alone', () => {
  const permissions = read('src/copy/permissions.ts')
  assert.ok(permissions.includes('IAMAI saves the sign-in details needed for its checks, leaving out phone numbers.'))
  const security = read('SECURITY.md')
  assert.match(security, /IAMAI saves the sign-in details needed for\s+its checks, leaving out phone numbers/)
  assert.match(security, /IAMAI saves the sign-in details its checks need, leaving out phone numbers/)
  for (const text of [permissions, security]) assert.doesNotMatch(text, /saves only a summary|saves which kinds|never the values/)
})

test('registration guidance separates reading the settings back from testing the registration workflow', () => {
  const blocks = PACKAGES['s-goal-register-info-protected'].blocks
  assert.match(blocks['entra.observe'].text, /Check its settings by reading the policy back by the same policy ID; that confirms the configuration, not the registration experience\./)
  assert.match(blocks['entra.observe'].text, /Report-only results may not show sign-in method registration attempts, so validate the actual registration steps with a controlled test account before enforcement\./)
  assert.match(blocks['ai.observe'].text, /treat a settings read-back as a check of the configuration and a controlled registration test as the check of the workflow/)
  assert.doesNotMatch(blocks['email.rollout'].text, /validate the actual registration workflows in Report-only/)
  // Editorial batch C: both Emails carry the register's planned-change notice.
  assert.match(blocks['email.rollout'].text, /We are preparing a change to how sign-in methods are registered\./)
  assert.match(blocks['email.enforce'].text, /^Subject: Planned change: [^\n]*\n\nHi,\n\nWe are preparing a change to how sign-in methods are registered\./)
})

test('no Email describes planned or unverified work as complete, and the guest creation Email keeps its reader and trigger', () => {
  const COMPLETED = /has completed (its )?validation|completed its validation stage|dependencies have been resolved|have been accounted for|is being replaced with the validated|are enabling the dedicated|after report-only validation/i
  let emails = 0
  for (const [id, pkg] of Object.entries(PACKAGES)) {
    for (const block of Object.values(pkg.blocks)) {
      if (block.meta.channel !== 'email') continue
      emails += 1
      assert.doesNotMatch(block.text, COMPLETED, `${id}: ${block.meta.id}: ${block.text.match(COMPLETED)?.[0]}`)
    }
  }
  assert.ok(emails > 40, `emails read: ${emails}`)
  const guests = PACKAGES['s-goal-guests-mfa'].blocks['email.rollout']
  assert.deepEqual([guests.meta.audience, guests.meta.communicationTrigger], ['client-contact', 'before-report-only'])
  // Editorial batch C: the enforcement Email no longer claims the review is finished; it asks for what to test.
  const guestsEnforce = PACKAGES['s-goal-guests-mfa'].blocks['email.enforce'].text
  assert.doesNotMatch(guestsEnforce, /has finished its Report-only review|is ready to be turned on/)
  assert.match(guestsEnforce, /^Subject: Prepare support: Guest MFA\n\nWe are preparing MFA checks for guest access\./)
})
