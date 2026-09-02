// Resolving a step to its title in content.json (prompt 52, walk-51 item 1). The
// plan row, the opened step and the communications all show the one title the
// content file gives a step, so they can never disagree. A few engine ids differ
// from the content step id: the emergency and exclusions steps are s-blocker-…
// (content keys them s-prereq-…), and the merged goals render under the merge
// step's id.
//
// Pure: no DOM, no network. Takes the minimal shape so the engine and the UI can
// both call it without importing each other.
import { stepById } from './content.ts'
import type { ContentStep } from './content.ts'

export const CONTENT_ALIAS: Record<string, string> = {
  'validation-breakGlass': 's-prereq-break-glass',
  'validation-exclusionGroup': 's-prereq-exclusion-group',
  'all-users-no-persistence': 'session-lifetime',
  'byod-session-controls': 'unmanaged-browser',
  'block-downloads-unmanaged': 'unmanaged-browser',
}

type StepLike = { id: string; goalId: string }

/** The content entry for a step: its id, its goal id, or an alias of either. */
export function contentStepFor(step: StepLike): ContentStep | undefined {
  return stepById[step.id] ?? stepById[step.goalId] ?? stepById[CONTENT_ALIAS[step.goalId]] ?? stepById[CONTENT_ALIAS[step.id]]
}

/**
 * The title a step shows, from content.json. A step the content file has no
 * entry for keeps the title the engine gave it — its plain title where it has
 * one (the free-tier ladder steps carry their own), else its technical title.
 */
export function contentTitle(step: StepLike & { title: string; plainTitle?: string }): string {
  return contentStepFor(step)?.title ?? step.plainTitle ?? step.title
}
