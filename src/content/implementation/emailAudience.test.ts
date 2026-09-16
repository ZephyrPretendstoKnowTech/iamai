// Email audiences (correction batch 2.1): an Email's audience is the author's, or it
// is established by the Email's own words — a salutation, a role it names, the
// thing its reader owns or does, or the decision it asks for. Nothing assigns a
// recipient the text does not establish; an Email whose text names nobody is
// withheld until it is authored.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { packageDirs } from './library.ts'
import { normalizePackage, parseBlocks, validatePackage } from './protocol.ts'
import type { Block, PackageMeta } from './protocol.ts'

/**
 * Audiences assigned by the batch-2 review, each with the words in the Email that
 * establish it (package → block → [audience, evidence]).
 */
const REVIEWED: Readonly<Record<string, Readonly<Record<string, readonly [string, string]>>>> = {
  's-check-dormant-accounts': { 'email.owner.confirm': ['account-owner', 'Please confirm whether {{account.current.displayName}} is still needed and what it is used for. If it is '] },
  's-check-separate-admin-accounts': { 'email.admin': ['affected-administrators', 'your everyday account'] },
  's-goal-admin-session': { 'email.rollout': ['privileged-administrators', 'Admins,'], 'email.enforce': ['privileged-administrators', 'Admins,'] },
  's-goal-admins-phishing-resistant': { 'email.rollout': ['administrators-in-scope', 'We are preparing stronger authentication for admin access. Please test the approved method for your admin'], 'email.enforce': ['administrators-in-scope', 'We are preparing stronger authentication for admin access. Please test the approved method for your admin'] },
  's-goal-azure-management-mfa': { 'email.rollout': ['azure-administrators', 'We are preparing MFA controls for Azure management. Please tell IT about scripts or tools that sign in us'], 'email.enforce': ['azure-administrators', 'We are preparing MFA controls for Azure management. Please tell IT about scripts or tools that sign in us'] },
  's-goal-block-auth-transfer': { 'email.rollout': ['affected-users', 'We are preparing to block the sign-in transfer shortcut between devices. Where supported, sign in directl'], 'email.enforce': ['affected-users', 'We are preparing to block the sign-in transfer shortcut between devices. Where supported, sign in directl'] },
  's-goal-block-device-code': { 'email.rollout': ['technical-owners', 'If you use a tool or device that asks you to enter a code on another device to sign in, please tell IT be'], 'email.enforce': ['technical-owners', 'If you use a tool or device that asks you to enter a code on another device to sign in, please tell IT be'] },
  's-goal-block-legacy-auth': { 'email.rollout': ['affected-users', 'Please tell IT about older mail clients, printers or applications that still use an account password to c'], 'email.enforce': ['affected-users', 'Please tell IT about older mail clients, printers or applications that still use an account password to c'] },
  's-goal-block-unsupported-platforms': { 'email.rollout': ['affected-users', 'We are preparing to restrict access from platforms outside the approved set. If you use Linux or another '], 'email.enforce': ['affected-users', 'We are preparing to restrict access from platforms outside the approved set. If you use Linux or another '] },
  's-goal-geo-restriction': { 'email.rollout': ['affected-users', 'Please notify IT before working from a country not already approved. Include your dates and any VPN you e'], 'email.enforce': ['affected-users', 'Please notify IT before working from a country not already approved. Include your dates and any VPN you e'] },
  's-goal-guests-mfa': { 'email.rollout': ['client-contact', 'We are preparing MFA checks for guest access. Please tell IT about the guest accounts and partner organiz'], 'email.partner-trust': ['client-contact', 'We plan to trust MFA completed in the approved partner organization\'s Microsoft Entra tenant for ordinary'], 'email.enforce': ['help-desk', 'We are preparing MFA checks for guest access. Please coordinate representative sign-in tests with the aff'] },
  's-goal-mfa-all-users': { 'email.enforce': ['help-desk', 'We are preparing an MFA requirement for work sign-ins. Please help affected staff test their approved met'] },
  's-goal-mobile-app-protection': { 'email.rollout': ['affected-users', 'We are preparing to require approved protected apps for work data on phones and tablets. IT will confirm '], 'email.enforce': ['affected-users', 'We are preparing to require approved protected apps for work data on phones and tablets. IT will confirm '] },
  's-goal-register-info-protected': { 'email.rollout': ['affected-users', 'how sign-in methods are registered'], 'email.enforce': ['affected-users', 'We are preparing a change to how sign-in methods are registered. Contact IT before registering from an un'] },
  's-goal-require-managed-device': { 'email.rollout': ['affected-users', 'Outside the approved trusted network, work access will need a device that meets the selected device requi'], 'email.enforce': ['affected-users', 'Outside the approved trusted network, work access will need a device that meets the selected device requi'] },
  's-goal-unmanaged-browser': { 'email.rollout': ['affected-users', 'We are preparing limited browser access on unmanaged devices. Some download, print or sync actions may be'], 'email.enforce': ['affected-users', 'We are preparing limited browser access on unmanaged devices. Some download, print or sync actions may be'] },
  's-prereq-allowed-countries': { 'email.users.travel-confirmation': ['client-contact', 'Please confirm the countries where staff need access, including regular remote work and planned travel. W'] },
  's-prereq-break-glass': { 'email.admins.drill': ['authorized-emergency-administrators', 'Please arrange a controlled emergency access drill. Confirm credential access, sign-in, administrative ac'] },
  's-prereq-device-plan': { 'email.decision-request': ['client-contact', 'Please choose how phones and computers should access company data. For phones, the options are enrollment'] },
  's-prereq-exclusion-group': { 'email.admins.exclusion-change': ['administrators', 'We plan to update the emergency access group or its policy references. Please check that only the selecte'] },
  's-prereq-per-user-mfa': { 'email.cutover': ['affected-users', 'We are moving your MFA requirement from the older per-user setting to Conditional Access. MFA will remain'] },
  's-prereq-security-defaults': { 'email.cutover': ['help-desk', 'We plan to replace Security Defaults with the reviewed access policies in one change window. Please be av'] },
  's-prereq-service-accounts-group': { 'email.owners.confirm': ['application-owners', 'Please confirm which listed accounts run unattended jobs, the workload each supports, and its owner. Flag'] },
  's-prereq-trusted-location': { 'email.network.confirm': ['network-owner', 'Please confirm the public IP ranges we may treat as trusted, who controls them, and whether they can chan'] },
  's-question-mail-devices': { 'email.owner': ['device-owner', 'Please send IT the device\'s current mail settings, supported authentication methods, recipient requiremen'], 'email.device-owner': ['device-owner', 'Please provide a test window'] },
  's-question-partner': { 'email.decision': ['client-contact', 'Please confirm how your team administers this tenant and which access must continue during the rollout. W'] },
  's-question-travel': { 'email.approval-request': ['travel-approver', 'Please confirm the traveler'], 'email.traveler-notice': ['traveler', 'IT is preparing access for the approved trip dates: {{travel.countries}}, {{travel.startDate}} through {{'], 'email.removal-check': ['administrators', 'The approved travel window for {{travel.traveler}} ended {{travel.endDate}}. The temporary countries {{tr'] },
  's-shared-devices': { 'email.change': ['help-desk', 'If a room or shared device stops signing in, record'] },
  's-verify-mfa': { 'email.everyone': ['all-users', 'Please complete the sign-in method setup requested by IT, then sign in once using that method. Contact IT'], 'email.admins': ['administrators', 'Admin sign-ins need a stronger method than the general setup request. If IT has asked you to, register a '], 'email.holdout': ['rollout-administrators', 'The enrollment date has passed and some active people still have not shown a successful sign-in with a re'] },
}

/** Emails whose text establishes no single recipient: withheld until authored (package → block). */
const NEEDS_AUTHORING: Readonly<Record<string, readonly string[]>> = {
  's-goal-mfa-all-users': ['email.rollout'],
  's-prereq-auth-strength': ['email.admin-change'],
  's-shared-devices': ['email.confirm'],
}

/** Audiences the package author wrote on the block itself (not assigned by review). */
const AUTHORED_ON_BLOCK: Readonly<Record<string, readonly string[]>> = {
  's-goal-inforcer-mfa': ['email.rollout', 'email.enforce'],
  's-question-partner': ['email.change'],
  's-goal-device-registration-mfa': ['email.users.pre-enforcement'],
  's-goal-pim-activation-reauth': ['email.admins.pre-activation-change'],
  's-goal-session-lifetime': ['email.users.pre-enforcement'],
  's-goal-token-protection': ['email.users.pre-enforcement'],
  's-goal-workload-identity-block': ['email.admins.pre-enforcement'],
}

function library(): { meta: PackageMeta; source: Record<string, Block>; normal: ReturnType<typeof normalizePackage> }[] {
  return packageDirs().map((dir) => {
    const meta = JSON.parse(readFileSync(join(dir, 'META.json'), 'utf8')) as PackageMeta
    const source = parseBlocks(readFileSync(join(dir, meta.contentFile ?? 'CONTENT.md'), 'utf8'))
    return { meta, source, normal: normalizePackage(meta, source) }
  })
}

test('every Email audience is the author’s or established by the Email’s own words, and none is invented', () => {
  let reviewed = 0
  for (const { meta, source, normal } of library()) {
    const listed = meta.email ? [meta.email.block, ...((meta.email as { blocks?: string[] }).blocks ?? [])] : []
    for (const b of Object.values(normal.blocks)) {
      if (b.meta.channel !== 'email') continue
      const where = `${meta.stepId}: ${b.meta.id}`
      const audience = typeof b.meta.audience === 'string' ? b.meta.audience : null
      const review = REVIEWED[meta.stepId]?.[b.meta.id]
      if (NEEDS_AUTHORING[meta.stepId]?.includes(b.meta.id)) {
        assert.equal(audience, null, `${where} is withheld for authoring but carries an audience`)
        continue
      }
      if (review) {
        assert.equal(audience, review[0], `${where}: the reviewed audience changed`)
        assert.ok(b.text.includes(review[1]), `${where}: "${review[1]}" no longer establishes ${review[0]} in the Email's text`)
        reviewed++
        continue
      }
      // Anything else was declared by the author: on META.email, or on the block itself.
      const fromMeta = listed.includes(b.meta.id) && typeof meta.email?.audience === 'string' && audience === meta.email.audience
      const onBlock = AUTHORED_ON_BLOCK[meta.stepId]?.includes(b.meta.id) && typeof source[b.meta.id]?.meta.audience === 'string'
      assert.ok(audience === null || fromMeta || onBlock, `${where}: audience ${audience} was assigned without authoring or evidence in its text`)
    }
  }
  // 52 reviewed: 46 unchanged, 1 corrected (account-owner), 5 withheld for authoring; the guest
  // creation Email was since authored with its reader (content corrections pass): 48.
  assert.equal(reviewed, 48, 'the reviewed Email count changed: review the new audience against its text')
})

test('an Email withheld for authoring is refused by the validator, so it is never shown with a guessed recipient', () => {
  for (const { meta, normal } of library()) {
    for (const id of NEEDS_AUTHORING[meta.stepId] ?? []) {
      const errors = validatePackage({ meta: normal.meta, blocks: normal.blocks }).filter((e) => e.includes('audience') && Object.entries(normal.meta.projection).some(([, p]) => JSON.stringify(p ?? {}).includes(`"${id}"`)))
      assert.ok(errors.length > 0, `${meta.stepId}: ${id} validates without an audience`)
    }
  }
})
