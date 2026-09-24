// The Implementation Tasks of two Prepare Accounts and Objects steps whose work
// is one task per account, or one list of accounts, with the scan's own values
// in every line (walk list, section 3): Disable or Confirm Dormant Accounts and
// Use Separate Accounts for Admin Work.
//
// Both drew their task from their package's one Entra block, which could name
// no account: 3.1's list ran every account into one sentence and numbered its
// three choices as steps, and 3.2 had one task for every admin that named no
// account, role or address. Here each task is built from the step's own words
// (docs/design/content.json, the step's `procedure`) and the facts the scan
// already holds, in the anatomy every task step draws (emergencyAccountTasks.ts
// EmergencyTaskProjection). The Entra tab carries the same text
// (sectionThreeTasksText), so the tab, the export and AI Info read one procedure.
//
// Pure: no DOM, no React, no network.
import type { Step } from '../../roadmap/types.ts'
import type { StepVarContext } from './stepVars.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import { stepById } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { authenticatorPasskeyLines, passkeyWords } from '../../content/passkeySetup.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { oneLine } from '../../content/implementation/project.ts'
import { adminRolesOf } from '../../derive/contentLists.ts'
import { personLabels } from '../../names.ts'
import { roleLabel } from '../../roles.ts'
import { initialDomain } from '../../validation/rules.ts'
import { SEPARATE_ADMIN_ACCOUNTS_STEP_ID } from '../../roadmap/stepIds.ts'

export const DORMANT_STEP_ID = 's-check-dormant-accounts'

type DormantWords = {
  taskTitle: string
  keep: { label: string; instruction: string; noSignIn: string; lastSignIn: string; kept: string }
  procedure: { list: string; account: string; noSignIn: string; lastSignIn: string; each: string; choices: string[]; scan: string }
}
type AdminValues = { name: string; newUpn: string; displayName: string; upn: string; everyday: string; mail: string; role: string }
type AdminWords = {
  taskTitle: string
  procedure: Record<'create' | 'names' | 'displayName' | 'otherEmails' | 'tapPolicy' | 'tap' | 'registerPass' | 'registerKey' | 'assign' | 'assignActive' | 'assignEligible' | 'test' | 'remove' | 'removeEligible' | 'keep' | 'scan', string> & { generic: AdminValues }
}

/** Disable or Confirm Dormant Accounts' own words (steps[s-check-dormant-accounts]). */
export const DORMANT_WORDS = stepById[DORMANT_STEP_ID] as unknown as DormantWords
const ADMIN_WORDS = stepById[SEPARATE_ADMIN_ACCOUNTS_STEP_ID] as unknown as AdminWords

const clean = (value: string): string => oneLine(value).trim()

/**
 * An account's last sign-in in the step's words: "Last signed in Feb 24, 2026",
 * or "No sign-in on record" (the keep picker's option line, walk list item 22).
 */
export function lastSignInWords(lastSignIn: string | null, words: { noSignIn: string; lastSignIn: string } = DORMANT_WORDS.keep): string {
  return lastSignIn ? fillText(words.lastSignIn, { date: absoluteDate(lastSignIn) }) : words.noSignIn
}

/**
 * Disable or keep each account (walk list items 20, 30, 31): the accounts still
 * open, one per line with the last sign-in the scan holds, then the two choices
 * under one line, then the scan. A kept account is not listed: it is done. The
 * procedure stands whole with no account open, as every procedure does on a
 * finished step (step template rule 7).
 */
export function dormantTasksOf(step: Step, ctx: StepVarContext): EmergencyTaskProjection {
  const P = DORMANT_WORDS.procedure
  const open = (step.dormantChoices ?? []).filter((row) => !row.kept)
  const labels = personLabels(ctx.snapshot.users, { address: true })
  const accountOf = (id: string, name: string): string => clean(labels.get(id) ?? name)
  const rows = open.map((row) => fillText(P.account, { account: accountOf(row.id, row.name), signIn: lastSignInWords(row.lastSignIn, P) }))
  const steps = [
    ...(rows.length > 0 ? [[fillText(P.list, { n: rows.length }), ...rows.map((row) => `- ${row}`)].join('\n')] : []),
    [P.each, ...P.choices.map((choice) => `- ${choice}`)].join('\n'),
    P.scan,
  ]
  const task: EmergencyAccountTask = {
    id: 'disable-or-keep',
    accountId: null,
    title: DORMANT_WORDS.taskTitle,
    targetUpn: null,
    required: open.length > 0,
    readinessKey: '',
    evidence: null,
    actionLabel: 'Open the Entra procedure',
    steps,
  }
  return { tasks: [task], recommendedTaskId: open.length > 0 ? task.id : null, printAll: true }
}

/**
 * Move the role to a separate admin account (walk list item 2): one task for
 * each admin the scan saw on Outlook or Teams (generate.ts, the step's
 * `admin:` findings), naming the new admin account on the tenant's
 * onmicrosoft.com domain, the address its notices go to, the Temporary Access
 * Pass its first sign-in uses, and each admin role to assign to it and then take
 * off the everyday account. A role held eligible stays eligible; on a tenant
 * with Privileged Identity Management an active role is added as Active, which
 * is not the wizard's default there.
 *
 * With no admin to move the same procedure stands in general terms, so a
 * finished step still says how it is done (step template rule 7).
 */
export function separateAdminTasksOf(step: Step, ctx: StepVarContext): EmergencyTaskProjection {
  const P = ADMIN_WORDS.procedure
  const snapshot = ctx.snapshot
  const domain = initialDomain(snapshot)
  const ids = (step.configurationFindings ?? []).filter((f) => f.key.startsWith('admin:')).map((f) => f.key.slice('admin:'.length))
  const tenantHasPim = snapshot.capabilities?.pim?.enabled === true || Object.values(snapshot.roles.eligible ?? {}).some((roles) => roles.length > 0)
  // Temporary Access Pass as the scan read the methods policy: off only where it
  // read the policy and the method is not enabled (generate.ts tapEnabled).
  const methods = snapshot.config.authMethodsPolicy
  const methodsRow = methods?.status === 'ok' ? (methods.rows?.[0] as { authenticationMethodConfigurations?: { id?: string; state?: string }[] } | undefined) : undefined
  const tapOff = methodsRow !== undefined && !(methodsRow.authenticationMethodConfigurations ?? []).some((c) => c.id?.toLowerCase() === 'temporaryaccesspass' && c.state === 'enabled')
  const procedure = (v: AdminValues, active: string[], eligible: string[]): string[] => {
    const assign = tenantHasPim ? P.assignActive : P.assign
    // The one Authenticator procedure (content/passkeySetup.ts), with the pass in
    // place of its sign-in prompts line: the new account has no other way in.
    const [open, create, , provider] = authenticatorPasskeyLines(fillText(passkeyWords.phoneNamed, { name: v.name }), `**${v.upn}**`)
    return [
      P.create,
      fillText(P.names, v),
      fillText(P.otherEmails, v),
      ...(tapOff ? [fillText(P.tapPolicy, v)] : []),
      fillText(P.tap, v),
      open,
      create,
      fillText(P.registerPass, v),
      provider,
      fillText(P.registerKey, v),
      ...active.map((role) => fillText(assign, { ...v, role })),
      ...eligible.map((role) => fillText(P.assignEligible, { ...v, role })),
      fillText(P.test, v),
      ...active.map((role) => fillText(P.remove, { ...v, role })),
      ...eligible.map((role) => fillText(P.removeEligible, { ...v, role })),
      fillText(P.keep, v),
      P.scan,
    ]
  }
  const tasks: EmergencyAccountTask[] = ids.flatMap((id) => {
    const user = snapshot.users.find((u) => u.id === id)
    const everyday = clean(user?.userPrincipalName ?? '')
    if (!user || !everyday.includes('@')) return []
    const name = clean(user.displayName || ctx.nameOf(id))
    const newUpn = `adm-${everyday.split('@')[0]}@${domain ?? everyday.split('@')[1]}`
    const v: AdminValues = { name, newUpn, displayName: fillText(P.displayName, { name }), upn: newUpn, everyday, mail: clean(user.mail || everyday), role: '' }
    const roles = adminRolesOf(snapshot, id)
    const steps = procedure(v, roles.active.map((r) => clean(roleLabel(r))), roles.eligible.map((r) => clean(roleLabel(r))))
    return [{ id: `move-role:${id}`, accountId: id, title: ADMIN_WORDS.taskTitle, targetUpn: everyday, subjectLabel: everyday, required: true, readinessKey: `admin:${id}`, evidence: null, actionLabel: 'Open the Entra procedure', steps }]
  })
  if (tasks.length > 0) return { tasks, recommendedTaskId: tasks[0].id, printAll: true }
  const g = P.generic
  const generic: AdminValues = { ...g, newUpn: fillText(g.newUpn, { domain: domain ? clean(domain) : 'the onmicrosoft.com domain' }) }
  const task: EmergencyAccountTask = { id: 'move-role', accountId: null, title: ADMIN_WORDS.taskTitle, targetUpn: null, required: false, readinessKey: '', evidence: null, actionLabel: 'Open the Entra procedure', steps: procedure(generic, [g.role], []) }
  return { tasks: [task], recommendedTaskId: null, printAll: true }
}

/** This step's section-3 task projection, or null for every other step. */
export function sectionThreeTasksOf(step: Step, ctx: StepVarContext): EmergencyTaskProjection | null {
  return step.id === DORMANT_STEP_ID ? dormantTasksOf(step, ctx) : step.id === SEPARATE_ADMIN_ACCOUNTS_STEP_ID ? separateAdminTasksOf(step, ctx) : null
}

/**
 * The tasks as the Entra tab's text: each task's title and account, then its
 * numbered steps, a step's own list indented under it so the text keeps the
 * shape the screen draws.
 */
export function sectionThreeTasksText(projection: EmergencyTaskProjection): string {
  return projection.tasks.map((task) => [
    `**${task.title}**${task.targetUpn ? ` · ${task.targetUpn}` : ''}`,
    task.steps.map((line, index) => `${index + 1}. ${line.replace(/\n- /g, '\n   - ')}`).join('\n'),
  ].join('\n\n')).join('\n\n')
}
