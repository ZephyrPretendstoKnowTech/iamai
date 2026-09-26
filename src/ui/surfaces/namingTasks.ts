// Align Policy Names, in Ongoing Checks and Cleanup (owner, 2026-09-26: Jon's
// names): drawn on the step template, as Alert on Emergency Account Sign-ins is,
// with no fields and no Save. It lists the tenant's policies the plan tracks
// under a name other than the pinned baseline's (roadmap/cleanupPhase.ts
// renamesOf), and the scan that finds the last baseline name completes it.
//
// Pure: no DOM, no network.
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import { cleanup as cleanupContent } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { NAMES_INLINE } from './whoBlocks.ts'
import type { EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import type { Artifact } from './stepBody.ts'
import type { EmergencySubjectTile } from './emergencyReadiness.ts'
import { followTask } from './emergencyReadiness.ts'

type NamingWords = { taskTitle: string; cardLabel: string; openStep: string; renameStep: string; afterStep: string; aiInfo: string }
const W = (): NamingWords => (cleanupContent as unknown as { naming: NamingWords }).naming

const renamesOf = (phase: CleanupPhase): { id: string; from: string; to: string }[] => phase.namingProposals ?? []

/** The procedure, whole: open the policies, one rename per policy with its ID, then the scan. The export and the Implementation Task read these. */
export function namingSteps(phase: CleanupPhase): string[] {
  const w = W()
  return [w.openStep, ...renamesOf(phase).map((r) => fillText(w.renameStep, r)), w.afterStep]
}

/** Its one Implementation Task. */
export function namingTasksOf(phase: CleanupPhase): EmergencyTaskProjection {
  const title = W().taskTitle
  return { tasks: [{ id: 'rename-policies', accountId: null, title, targetUpn: null, required: true, readinessKey: '', evidence: null, actionLabel: title, steps: namingSteps(phase) }], printAll: true }
}

/** Its channels: the Entra tab, whose procedure is its task, and AI Info. */
export function namingArtifacts(phase: CleanupPhase): Artifact[] {
  return [
    { id: 'portal', form: 'markdown', lines: [], text: () => '', note: null },
    { id: 'ai', form: 'markdown', lines: [], text: () => namingAiInfo(phase), note: null },
  ]
}

/** AI Info: each policy's ID, its name and the baseline's, in plain words. */
export function namingAiInfo(phase: CleanupPhase): string {
  return [W().aiInfo, renamesOf(phase).map((r) => `- ${r.id}: ${r.from} → ${r.to}`).join('\n')].filter((x) => x !== '').join('\n\n')
}

/** Tasks Remaining: one card, each policy's name beside the baseline's, past the first five under the card's fold. */
export function namingSubjects(phase: CleanupPhase): EmergencySubjectTile[] {
  const w = W()
  const lines = renamesOf(phase).map((r) => `${r.from} → ${r.to}`)
  if (lines.length === 0) return []
  return [{ key: 'policy-names', accountId: null, heading: w.cardLabel, upn: null, title: w.taskTitle, detail: lines.slice(0, NAMES_INLINE).join('\n'), ...(lines.length > NAMES_INLINE ? { more: lines.slice(NAMES_INLINE) } : {}), instruction: followTask(w.taskTitle), completed: [], remainingCount: null, satisfied: false }]
}

/** The rail's milestone while a policy is left to rename. */
export const namingMilestone = (): string => W().taskTitle
