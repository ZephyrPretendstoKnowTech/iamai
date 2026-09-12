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
  's-check-dormant-accounts': { 'email.owner.confirm': ['account-owner', 'tell us what it is used for'] },
  's-check-separate-admin-accounts': { 'email.admin': ['affected-administrators', 'your everyday account'] },
  's-goal-admin-session': { 'email.rollout': ['privileged-administrators', 'Admins,'], 'email.enforce': ['privileged-administrators', 'Admins,'] },
  's-goal-admins-phishing-resistant': { 'email.rollout': ['administrators-in-scope', 'every administrator in scope'], 'email.enforce': ['administrators-in-scope', 'Admin sign-ins in scope'] },
  's-goal-azure-management-mfa': { 'email.rollout': ['azure-administrators', 'Azure management access'], 'email.enforce': ['azure-administrators', 'Human Azure management sessions'] },
  's-goal-block-auth-transfer': { 'email.rollout': ['affected-users', 'users can still sign in directly'], 'email.enforce': ['affected-users', 'sign in directly on the mobile device'] },
  's-goal-block-device-code': { 'email.rollout': ['technical-owners', 'Technical owners should report'], 'email.enforce': ['technical-owners', 'If a technical workflow fails'] },
  's-goal-block-legacy-auth': { 'email.rollout': ['affected-users', 'If you own an older mail client'], 'email.enforce': ['affected-users', 'If something legitimate stops working'] },
  's-goal-block-unsupported-platforms': { 'email.rollout': ['affected-users', 'If you use a Linux'], 'email.enforce': ['affected-users', 'Use an approved supported device for work access'] },
  's-goal-geo-restriction': { 'email.rollout': ['affected-users', 'If you travel for work'], 'email.enforce': ['affected-users', 'Work travel must be arranged before departure'] },
  's-goal-guests-mfa': { 'email.partner-trust': ['client-contact', 'Confirm partner MFA trust change'], 'email.enforce': ['help-desk', 'Support should troubleshoot'] },
  's-goal-mfa-all-users': { 'email.enforce': ['help-desk', 'If someone cannot complete the prompt'] },
  's-goal-mobile-app-protection': { 'email.rollout': ['affected-users', 'Company mail and files on phones'], 'email.enforce': ['affected-users', 'Use the supported protected Microsoft apps'] },
  's-goal-register-info-protected': { 'email.rollout': ['affected-users', 'how sign-in methods are registered'], 'email.enforce': ['affected-users', 'If a legitimate registration is blocked, contact IT'] },
  's-goal-require-managed-device': { 'email.rollout': ['affected-users', 'in-scope work devices'], 'email.enforce': ['affected-users', 'use an approved compliant'] },
  's-goal-unmanaged-browser': { 'email.rollout': ['affected-users', 'on unmanaged computers'], 'email.enforce': ['affected-users', 'On a personal/unmanaged computer'] },
  's-prereq-allowed-countries': { 'email.users.travel-confirmation': ['client-contact', 'where staff legitimately work or travel'] },
  's-prereq-break-glass': { 'email.admins.drill': ['authorized-emergency-administrators', 'Authorized administrators should confirm'] },
  's-prereq-device-plan': { 'email.decision-request': ['client-contact', 'IAMAI needs a business decision'] },
  's-prereq-exclusion-group': { 'email.admins.exclusion-change': ['administrators', 'Please verify that only the approved emergency accounts are members'] },
  's-prereq-per-user-mfa': { 'email.cutover': ['affected-users', 'Your MFA requirement is moving'] },
  's-prereq-security-defaults': { 'email.cutover': ['help-desk', 'If sign-in issues appear, record the affected account'] },
  's-prereq-service-accounts-group': { 'email.owners.confirm': ['application-owners', 'what workload each one runs'] },
  's-prereq-trusted-location': { 'email.network.confirm': ['network-owner', 'public IPv4/IPv6 CIDR ranges'] },
  's-question-mail-devices': { 'email.owner': ['device-owner', 'whether the device can use OAuth/TLS'], 'email.device-owner': ['device-owner', 'Please provide a test window'] },
  's-question-partner': { 'email.decision': ['client-contact', 'Please confirm whether the MSP/CSP should retain delegated access'] },
  's-question-travel': { 'email.approval-request': ['travel-approver', 'Please confirm the traveler'], 'email.traveler-notice': ['traveler', 'Your access is scheduled'], 'email.removal-check': ['administrators', 'Remove the trip-only country'] },
  's-shared-devices': { 'email.change': ['help-desk', 'If a room or shared device stops signing in, record'] },
  's-verify-mfa': { 'email.everyone': ['all-users', 'will require MFA. Please complete the Microsoft Authenticator setup'], 'email.admins': ['administrators', 'admin sign-ins have a stronger requirement'], 'email.holdout': ['rollout-administrators', 'Review each remaining account'] },
}

/** Emails whose text establishes no single recipient: withheld until authored (package → block). */
const NEEDS_AUTHORING: Readonly<Record<string, readonly string[]>> = {
  's-goal-guests-mfa': ['email.rollout'],
  's-goal-mfa-all-users': ['email.rollout'],
  's-prereq-auth-strength': ['email.admin-change'],
  's-question-partner': ['email.change'],
  's-shared-devices': ['email.confirm'],
}

/** Audiences the package author wrote on the block itself (not assigned by review). */
const AUTHORED_ON_BLOCK: Readonly<Record<string, readonly string[]>> = {
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
  // 52 reviewed: 46 unchanged, 1 corrected (account-owner), 5 withheld for authoring.
  assert.equal(reviewed, 47, 'the reviewed Email count changed: review the new audience against its text')
})

test('an Email withheld for authoring is refused by the validator, so it is never shown with a guessed recipient', () => {
  for (const { meta, normal } of library()) {
    for (const id of NEEDS_AUTHORING[meta.stepId] ?? []) {
      const errors = validatePackage({ meta: normal.meta, blocks: normal.blocks }).filter((e) => e.includes('audience') && Object.entries(normal.meta.projection).some(([, p]) => JSON.stringify(p ?? {}).includes(`"${id}"`)))
      assert.ok(errors.length > 0, `${meta.stepId}: ${id} validates without an audience`)
    }
  }
})
