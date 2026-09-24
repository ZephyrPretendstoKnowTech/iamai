// The procedure a Prepare step draws where the object it makes is already in
// the tenant (walk list section 3, items 7, 19, 55 and 61): the office location
// picked in Decide How and Where People Sign In, marked trusted rather than made
// again; a strength already named as the baseline's, corrected rather than
// duplicated; and a saved service accounts group, its members corrected.
//
// An object step's package projects only its create (content/implementation
// states.ts RUNTIME_REACH), so each of these reads its correction block from the
// step's own content folder and binds it here. The Entra tab, the Implementation
// Task (stepBody.ts) and AI Info's What to do (stepExport.ts) all draw this one
// text, so the three never say two different things.
//
// Pure: no DOM, no React, no network.
import type { Step } from '../../roadmap/types.ts'
import type { CompiledPackage } from '../../content/implementation/protocol.ts'
import type { Bindings } from '../../content/implementation/project.ts'
import { bindText } from '../../content/implementation/project.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { fillText, whole } from '../../content/render.ts'
import { list } from '../../copy/statements.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'

type WhenWords = Record<string, { task?: string }>

/** The task title the step's content writes for the state it reads (steps[].whatToDoWhen[state].task), filled. */
function taskTitle(step: Step, state: string, ex: Record<string, unknown>): string | null {
  const when = (contentStepFor(step) as { whatToDoWhen?: WhenWords } | undefined)?.whatToDoWhen?.[state]
  return typeof when?.task === 'string' && whole(when.task, ex) ? fillText(when.task, ex) : null
}

/** One block of the package, bound; null where the block is absent or a value it names is not held. */
function bound(pkg: CompiledPackage, id: string, bindings: Bindings, required: readonly string[]): string | null {
  const block = pkg.blocks[id]
  if (!block) return null
  const out = bindText(block.text, bindings, new Set(required))
  return 'text' in out && out.text.trim() !== '' ? out.text.trim() : null
}

/** Numbered as the create procedure is: "1. …", one line each. */
const numbered = (lines: readonly string[]): string => lines.map((line, i) => `${i + 1}. ${line.replace(/^\d+\.\s*/, '')}`).join('\n')

/**
 * The step's procedure where its object is already in the tenant, with the
 * task title for it, or null: the step then draws the create its package
 * projects, as before.
 */
export function existingObjectProcedureOf(step: Step, pkg: CompiledPackage | null, bindings: Bindings | null, ex: Record<string, unknown>, ctx: { upnOf: (id: string) => string }): { text: string; title: string | null } | null {
  if (!pkg || !bindings) return null
  // Define the Trusted Network: a picked location without the trusted mark,
  // while it is open; the picked locations that were already in Entra, once done.
  if (step.id === PREREQ_STEP_ID.trustedLocation) {
    const office = !step.state.satisfied ? step.officeToTrust : step.officeExisting
    if (!office || office.length === 0) return null
    const name = list(office.map((l) => l.name))
    const text = bound(pkg, 'entra.correct.trusted', { ...bindings, 'location.correct.displayName': name }, ['location.correct.displayName'])
    return text === null ? null : { text, title: taskTitle(step, 'officeToTrust', { ...ex, officeToTrust: name }) }
  }
  // Create the Baseline's Authentication Strength: the strength of the
  // baseline's name that allows other methods, while it is open.
  if (step.id === PREREQ_STEP_ID.authStrength && step.strengthToCorrect && !step.state.satisfied) {
    const text = bound(pkg, 'entra.correct.combinations', { ...bindings, 'strength.current.displayName': step.strengthToCorrect.name }, ['strength.current.displayName', 'strength.target.methodNames'])
    return text === null ? null : { text, title: taskTitle(step, 'strengthToCorrect', ex) }
  }
  // Create or Correct Service Accounts Group: the saved group whose members
  // differ, with the accounts to add and the members to remove by sign-in address.
  const group = step.serviceGroup
  if (step.id === PREREQ_STEP_ID.serviceAccountsGroup && group?.kind === 'correct' && !step.state.satisfied) {
    const upns = (ids: readonly string[]): string[] | undefined => (ids.length > 0 ? ids.map((id) => `**${ctx.upnOf(id)}**`) : undefined)
    const b: Bindings = { ...bindings, 'group.current.displayName': group.name, 'serviceAccounts.missingUpns': upns(group.missing), 'serviceAccounts.extraUpns': upns(group.extra) }
    const open = bound(pkg, 'entra.correct.open', b, ['group.current.displayName'])
    const add = group.missing.length > 0 ? bound(pkg, 'entra.correct.add', b, ['serviceAccounts.missingUpns']) : null
    const remove = group.extra.length > 0 ? bound(pkg, 'entra.correct.remove', b, ['serviceAccounts.extraUpns']) : null
    const scan = bound(pkg, 'entra.verify', b, [])
    if (open === null || scan === null || (add === null && remove === null)) return null
    return { text: numbered([open, ...(add ? [add] : []), ...(remove ? [remove] : []), scan]), title: taskTitle(step, 'serviceGroupCorrect', ex) }
  }
  return null
}
