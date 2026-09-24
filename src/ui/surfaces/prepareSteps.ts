// Register Your Own Passkey and Prepare Your Team for MFA, as the scan reads
// them (walk list section 3, owner 2026-09-23): each step's own card, its Next
// milestone and its instruction line follow what IAMAI holds about the people
// it prepares, and its procedure names them.
//
// Register Your Own Passkey follows the operator's own readiness: nothing
// registered, registered and not signed in with it yet, or signed in with it,
// which completes the step (roadmap/generate.ts; passkeySettings.ts
// operatorSignInOf). Prepare Your Team for MFA counts its own people not ready
// (roadmap/generate.ts preparation), names what each needs, and reads the
// registration campaign the scan already collected.
//
// Every word is the step's own content entry (docs/design/content.json).
// Pure: no DOM, no React, no network.
import type { Step } from '../../roadmap/types.ts'
import type { StepVarContext } from './stepVars.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import { passkeyWords } from '../../content/passkeySetup.ts'
import { app } from '../../content/content.ts'
import { devicePlanOf } from '../../roadmap/answers.ts'
import { readinessContextOf } from '../../derive/readinessContext.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { list } from '../../copy/statements.ts'
import { ladder } from '../../derive/ladder.ts'
import { exclusionsGroupChoice } from '../../mapping/safetyChoice.ts'
import { OPERATOR_PASSKEY_STEP_ID, operatorPasskeyOf, operatorSignInOf } from '../../roadmap/passkeySettings.ts'
import type { OperatorSignIn } from '../../roadmap/passkeySettings.ts'
import { CAMPAIGN_STEP_ID } from '../../roadmap/followUp.ts'
import type { DeviceType } from '../../scoring/phishingResistant.ts'
import { proposedNamesFor } from './proposedNames.ts'
import { NAMES_INLINE } from './whoBlocks.ts'
import { personLabels } from '../../names.ts'

/** The step's own Tasks Remaining card, in place of its content's fixed check (policyTasks.ts policyCardsOf). */
export type OwnCard = { title: string; detail: string; upn: string | null; link: { label: string; href: string } | null }

/** What the step's card, Next milestone and instruction line say, where the step reads its people. */
export type PrepareReading = { card: OwnCard | null; milestone: string | null; instruction: string | null }

type OperatorWords = { card: { check: string; registered: string; signedIn: string; signedInOn: string; computer: string; phone: string }; milestone: { register: string; signIn: string } }
type TeamWords = {
  card: { notReady: string; ready: string; needsPasskey: string; needsAuthenticator: string; many: string; link: string }
  milestone: string
  instruction: string
  campaign: { managed: string; off: string; on: string; nudging: string; fido2: string; microsoftAuthenticator: string; allUsers: string }
}
const words = <T>(step: Step): T => contentStepFor(step) as unknown as T

/**
 * The accounts a step names for someone to act on, each with its sign-in
 * address (names.ts personLabels, as every account list a task acts on in the
 * portal reads): "Kai Brown (user0@getiamai.example.com)" on the card and in the
 * procedure (walk list section 3 items 41 and 46).
 */
const accountsOf = (ctx: StepVarContext): ((id: string) => string) => {
  const labels = personLabels(ctx.snapshot.users, { address: true })
  return (id) => labels.get(id) ?? ctx.nameOf(id)
}

/** MFA Readiness opened on the people this step waits on (derive/stepMfaReadiness.ts). */
export const TEAM_READINESS_HREF = `#/readiness/step/${CAMPAIGN_STEP_ID}`

// ---- Register Your Own Passkey ----

type OperatorReading = { id: string; name: string; account: string; registered: boolean; signIn: OperatorSignIn | null; devices: DeviceType[] }

/** The operator, what they registered, and their sign-in with it, from the readiness IAMAI holds for them. */
function operatorOf(ctx: StepVarContext): OperatorReading | null {
  const op = operatorPasskeyOf(ctx.snapshot)
  const id = op?.operatorId ?? ctx.operatorId
  if (!id) return null
  const readiness = ladder(ctx.snapshot, ctx.mapping, ctx.now).viability.get(id)?.readiness ?? null
  const upn = ctx.snapshot.users.find((u) => u.id.toLowerCase() === id.toLowerCase())?.userPrincipalName ?? null
  const devices = (['computer', 'phone'] as const).filter((t) => (readiness?.devices ?? []).some((d) => d.type === t))
  return { id, name: accountsOf(ctx)(id), account: upn ?? ctx.nameOf(id), registered: op?.registered ?? false, signIn: operatorSignInOf(readiness), devices }
}

const deviceWords = (types: readonly DeviceType[], W: OperatorWords['card']): string => list(types.map((t) => (t === 'phone' ? W.phone : W.computer)))

function operatorReading(step: Step, ctx: StepVarContext, satisfied: boolean): PrepareReading | null {
  const op = operatorOf(ctx)
  if (op === null) return null
  const W = words<OperatorWords>(step)
  const card = (title: string): OwnCard => ({ title, detail: '', upn: op.name, link: null })
  if (satisfied) {
    const s = op.signIn
    if (s === null) return { card: null, milestone: null, instruction: null }
    return { card: card(s.types.length > 0 ? fillText(W.card.signedIn, { devices: deviceWords(s.types, W.card), date: absoluteDate(s.at) }) : fillText(W.card.signedInOn, { date: absoluteDate(s.at) })), milestone: null, instruction: null }
  }
  return op.registered
    ? { card: card(W.card.registered), milestone: W.milestone.signIn, instruction: null }
    : { card: card(W.card.check), milestone: W.milestone.register, instruction: null }
}

/** The procedure's values: the account to sign in as, and the kinds of device the operator signs in from (a computer where the records name none: IAMAI runs in a browser on one). */
function operatorVars(step: Step, ctx: StepVarContext): Record<string, unknown> {
  const op = operatorOf(ctx)
  if (op === null) return {}
  const W = words<OperatorWords>(step)
  // {passkeyPhone} and {passkeyAccount} fill the one Authenticator procedure the
  // step's lines name as {passkeyOpen} … {passkeyProvider} (content/passkeySetup.ts).
  return { operatorAccount: op.account, operatorDevices: deviceWords(op.devices.length > 0 ? op.devices : ['computer'], W.card), passkeyPhone: passkeyWords.phoneYours, passkeyAccount: `**${op.account}**` }
}

// ---- Prepare Your Team for MFA ----

/** The step's own people: everyone it prepares, those not ready, and those the admin policy covers, who need a passkey or security key. */
function teamOf(step: Step): { total: number; missing: string[]; passkey: ReadonlySet<string>; marked: string[] } | null {
  const p = step.preparation
  if (!p) return null
  return { total: p.ids.length, missing: p.missingIds, passkey: new Set(p.passkeyIds ?? []), marked: p.followUpIds ?? [] }
}

function teamReading(step: Step, ctx: StepVarContext, satisfied: boolean): PrepareReading | null {
  const team = teamOf(step)
  if (team === null) return null
  const W = words<TeamWords>(step)
  // The picker is drawn while anyone is not ready or marked (ContentStep.tsx FollowUpDecision), and its instruction with it.
  const instruction = team.missing.length > 0 || team.marked.length > 0 ? W.instruction : null
  if (satisfied) return { card: { title: fillText(W.card.ready, { ready: team.total - team.missing.length, total: team.total }), detail: '', upn: null, link: null }, milestone: null, instruction }
  if (team.missing.length === 0) return { card: null, milestone: null, instruction }
  const few = team.missing.length <= NAMES_INLINE
  const account = accountsOf(ctx)
  const detail = few
    ? team.missing.map((id) => fillText(team.passkey.has(id) ? W.card.needsPasskey : W.card.needsAuthenticator, { name: account(id) })).join('\n')
    : W.card.many
  return {
    card: { title: fillText(W.card.notReady, { missing: team.missing.length, total: team.total }), detail, upn: null, link: few ? null : { label: W.card.link, href: TEAM_READINESS_HREF } },
    milestone: fillText(W.milestone, { n: team.missing.length }),
    instruction,
  }
}

type CampaignTarget = { id: string; targetType?: string; targetedAuthenticationMethod?: string }
type CampaignRead = { state: string; include: CampaignTarget[]; exclude: CampaignTarget[]; snooze: number | null; enforce: boolean | null }

/** The registration campaign as the authentication methods policy the scan read holds it; null where it was not read. */
function campaignOf(ctx: StepVarContext): CampaignRead | null {
  const section = ctx.snapshot.config.authMethodsPolicy
  if (section?.status !== 'ok') return null
  const c = ((section.rows?.[0] ?? null) as { registrationEnforcement?: { authenticationMethodsRegistrationCampaign?: Record<string, unknown> } } | null)?.registrationEnforcement?.authenticationMethodsRegistrationCampaign
  if (!c || typeof c.state !== 'string') return null
  const targets = (v: unknown): CampaignTarget[] => (Array.isArray(v) ? v.filter((t): t is CampaignTarget => typeof (t as CampaignTarget)?.id === 'string') : [])
  return {
    state: c.state,
    include: targets(c.includeTargets),
    exclude: targets(c.excludeTargets),
    snooze: typeof c.snoozeDurationInDays === 'number' ? c.snoozeDurationInDays : null,
    enforce: typeof c.enforceRegistrationAfterAllowedSnoozes === 'boolean' ? c.enforceRegistrationAfterAllowedSnoozes : null,
  }
}

const ALL_USERS = 'all_users'

/** The campaign in the procedure's Today line: Microsoft managed, off, or on and what it nudges to whom. */
function campaignToday(c: CampaignRead, W: TeamWords['campaign'], ctx: StepVarContext): string {
  if (c.state === 'default') return W.managed
  if (c.state !== 'enabled') return W.off
  if (c.include.length === 0) return W.on
  const byKey = new Map(Object.entries(W as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]))
  const methods = [...new Set(c.include.map((t) => (t.targetedAuthenticationMethod ?? '').toLowerCase()))].filter((m) => m !== '').map((m) => byKey.get(m) ?? m)
  const scope = c.include.map((t) => (t.id.toLowerCase() === ALL_USERS ? W.allUsers : ctx.nameOf(t.id)))
  return methods.length === 0 ? W.on : fillText(W.nudging, { method: list(methods), scope: list(scope) })
}

/**
 * The procedure's values: the people not ready by what each needs (the task's
 * admins line and the group lines), the campaign today, and the exclusions
 * group the campaign line excludes — only while the campaign differs from that
 * line, so a campaign already set as it says drops the line (item 50).
 */
function teamVars(step: Step, ctx: StepVarContext): Record<string, unknown> {
  const team = teamOf(step)
  if (team === null) return {}
  const W = words<TeamWords>(step)
  const passkey = team.missing.filter((id) => team.passkey.has(id))
  const authenticator = team.missing.filter((id) => !team.passkey.has(id))
  const account = accountsOf(ctx)
  const out: Record<string, unknown> = {
    // The one Authenticator procedure's reader: the person being helped (content/passkeySetup.ts).
    passkeyPhone: passkeyWords.phoneTheirs,
    passkeyAccount: passkeyWords.accountTheirs,
    // The emails' own values, so Tell your people and the Email tab fill the first message alike.
    mfaEmail: mfaEmailValues(ctx),
    campaignNeedsPasskey: passkey.map(account),
    campaignNeedsPasskeyIds: passkey,
    campaignNeedsAuthenticator: authenticator.map(account),
    campaignNeedsAuthenticatorIds: authenticator,
  }
  const choice = exclusionsGroupChoice({ snapshot: ctx.snapshot, mapping: ctx.mapping, groups: ctx.groups, directory: ctx.directory })
  const groupId = choice.actionableId
  const c = campaignOf(ctx)
  if (c !== null) out.campaignToday = campaignToday(c, W.campaign, ctx)
  const matches = c !== null && c.state === 'enabled'
    && c.include.length === 1 && c.include[0].id.toLowerCase() === ALL_USERS && (c.include[0].targetedAuthenticationMethod ?? '').toLowerCase() === 'fido2'
    && c.snooze === 1 && c.enforce === false
    && (groupId === null || c.exclude.some((t) => t.id.toLowerCase() === groupId.toLowerCase()))
  if (!matches) out.campaignExclude = groupId !== null ? (choice.actionableName ?? ctx.nameOf(groupId)) : proposedNamesFor(ctx).exclusionsGroup
  return out
}

type MfaComputerWords = { managedLead: string; managed: string; phone: string }
const MFA_COMPUTER = (app.plan as unknown as { stepContract: { implementation: { emails: { mfaComputer: MfaComputerWords } } } }).stepContract.implementation.emails.mfaComputer

/**
 * The values Prepare Your Team for MFA's messages are filled with: the reader's
 * own phone, and the computer paragraph. Windows Hello is offered only where
 * Decide How and Where People Sign In says company computers are managed and the
 * scan read joined Windows computers (derive/readinessContext.ts, the reading MFA
 * Readiness uses); everywhere else a computer uses the phone's passkey. Windows
 * Hello is not a passkey, so it is never called one (owner, 2026-09-24).
 */
export function mfaEmailValues(ctx: StepVarContext): Record<string, string> {
  const computers = devicePlanOf(ctx.mapping)?.computers
  const managed = (computers === 'enrol' || computers === 'hybrid') && readinessContextOf(ctx.snapshot, ctx.mapping, ctx.now).windowsDirectory === 'joined'
  return {
    passkeyPhone: passkeyWords.phoneYours,
    computerLead: managed ? MFA_COMPUTER.managedLead : '',
    // Filled here: a value is not filled again where it lands, and the phone line names {passkeySignIn}.
    computerLine: fillText(managed ? MFA_COMPUTER.managed : MFA_COMPUTER.phone, {}),
  }
}

// ---- Both ----

/** The step's own card, Next milestone and instruction line; null on every other step. `satisfied` is the contract's, so the card agrees with where it folds. */
export function prepareReadingOf(step: Step, ctx: StepVarContext, satisfied: boolean): PrepareReading | null {
  if (step.id === OPERATOR_PASSKEY_STEP_ID) return operatorReading(step, ctx, satisfied)
  if (step.id === CAMPAIGN_STEP_ID) return teamReading(step, ctx, satisfied)
  return null
}

/** The values the step's content lines name; none on every other step. */
export function prepareVarsOf(step: Step, ctx: StepVarContext): Record<string, unknown> {
  if (step.id === OPERATOR_PASSKEY_STEP_ID) return operatorVars(step, ctx)
  if (step.id === CAMPAIGN_STEP_ID) return teamVars(step, ctx)
  return {}
}
