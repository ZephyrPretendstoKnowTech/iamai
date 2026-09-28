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

test('the public words make no predictive or blanket data claim, and the method disclosure says what IAMAI saves, without phone numbers', () => {
  {
    const home = pages.home
    // The headline names the plan IAMAI writes (owner, 2026-09-28: the old one read as a What If check).
    assert.match(String(home.h1), /rollout plan/i)
    // Report-only first is promised for new policies only: a correction to a policy that
    // is already On applies at the next sign-in (review, 2026-09-28).
    assert.match(JSON.stringify(home.work), /new policies in report-only first/)
    assert.doesNotMatch(JSON.stringify(home), /report-only first wherever Microsoft evaluates it,/)
    assert.match(JSON.stringify(home), /method|exclu|sign-in/i)
    assert.match(JSON.stringify(home.trust), /browser/)
    const publicText = [JSON.stringify(pages.home), JSON.stringify(pages.connect), read('home/index.html'), read('README.md')].join('\n')
    for (const claim of [/what (would|will) break/i, /predicted to affect/i, /never leaves the browser/i, /nothing (is )?sent anywhere/i, /stay in your browser/i]) {
      assert.doesNotMatch(publicText, claim, String(claim))
    }
    // Connect names where its steps lead, as Home's headline does (owner, 2026-09-28).
    assert.equal(String(pages.connect.h1), 'Three steps from your tenant to its rollout plan.')
    // The public-beta notice is gone (owner, 2026-09-26: "close enough to ready"); the baseline's attribution is untouched.
    assert.doesNotMatch(JSON.stringify(pages.connect), /Public beta|still being validated/)
    assert.match(String(home.baseline), /built by Jon Hope, a Microsoft MVP/)
  }
  {
    const permissions = read('src/copy/permissions.ts')
    assert.ok(permissions.includes('IAMAI saves the sign-in details needed for its checks, leaving out phone numbers.'))
    const security = read('SECURITY.md')
    assert.match(security, /IAMAI saves the sign-in details needed for\s+its checks, leaving out phone numbers/)
    assert.match(security, /IAMAI saves the sign-in details its checks need, leaving out phone numbers/)
    for (const text of [permissions, security]) assert.doesNotMatch(text, /saves only a summary|saves which kinds|never the values/)
  }
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
