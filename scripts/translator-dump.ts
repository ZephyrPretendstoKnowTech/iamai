// Writes docs/design/translator-output.json (prompt 52 Part 2): for every mapped
// policy step, the portal lines the product generates from the pinned goalMap
// through portalLines.ts, filled with the review page's example values. The
// review page (docs/design/render-review.py) reads this file so its What-to-do
// shows the product's own translation instead of the content file's reference
// lines; src/content/render.ts imports it so the TypeScript renderer matches.
//
// Shape: { [contentStepId]: { steps: [portal line, …] } }. A step whose goal the
// pinned baseline does not hold has no policy to translate and gets no entry —
// the review page falls back to whatToDoReference for it.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pinned from '../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { steps as contentSteps } from '../src/content/content.ts'
import { PINNED_GOAL_MAP, policiesForGoal } from '../src/roadmap/goalMap.ts'
import { stepPortalLines } from '../src/ui/surfaces/stepPortal.ts'
import type { Step } from '../src/roadmap/types.ts'
import { buildNameDirectory } from '../src/names.ts'

type PinnedPolicy = { placeholders?: Record<string, string> }
const POLICIES = pinned.policies as unknown as PinnedPolicy[]

// A content policy step's id is its goal id, except where the roadmap merges or
// renames a goal (the reverse of ContentStep's CONTENT_ALIAS for a mapped goal).
const GOAL_FOR_STEP: Record<string, string> = { 'session-lifetime': 'all-users-no-persistence' }

// The names render-review.py's fill() defaults for the placeholder tokens, so a
// step whose example omits one still translates with the review's own value
// (its exclusions group is "Breakglass Exclusion", and so on).
const TOKEN_DEFAULT: Record<string, string> = {
  exclusionsGroup: 'Breakglass Exclusion',
  serviceAccountsGroup: 'Service Accounts',
  travellersGroup: 'Travellers',
  trustedLocation: 'the trusted network',
}

export function buildTranslatorOutput(): Record<string, { steps: string[] }> {
  const out: Record<string, { steps: string[] }> = {}
  for (const step of contentSteps) {
    if (step.kind !== 'policy') continue
    const goalId = GOAL_FOR_STEP[step.id] ?? step.id
    const mapped = policiesForGoal(PINNED_GOAL_MAP, POLICIES as never, goalId)
    if (mapped.length === 0) continue // the baseline does not hold this goal
    const example = (step.example ?? {}) as Record<string, unknown>
    // Fill the policy's placeholder ids with the example's names, so the review
    // page's translation reads with the same groups and names as the rest of the
    // example (GetIAMAI's exclusions group, admins group, and so on).
    const extra = new Map<string, string>()
    for (const p of mapped as PinnedPolicy[]) {
      for (const [id, token] of Object.entries(p.placeholders ?? {})) {
        const v = typeof example[token] === 'string' && (example[token] as string).length > 0 ? (example[token] as string) : TOKEN_DEFAULT[token]
        if (v) extra.set(id.toLowerCase(), v)
      }
    }
    const dir = buildNameDirectory(null, [], extra)
    // The review page has no tenant, so the "resolved" policies are the author's
    // own and the two group ids the lines label with are the author's too. The
    // step shape is the product's: the translator reads its resolution and
    // nothing else (src/ui/surfaces/stepPortal.ts).
    const tokenId = (token: string): string | null => {
      for (const p of mapped as PinnedPolicy[]) for (const [id, t] of Object.entries(p.placeholders ?? {})) if (t === token) return id.toLowerCase()
      return null
    }
    const asStep = {
      goalId,
      action: {
        missing: [],
        resolution: {
          policies: (mapped as unknown as Record<string, unknown>[]).map((p, i) => ({ sourceName: String(p.displayName ?? i), body: p })),
          tenant: { exclusionsGroupId: tokenId('exclusionsGroup'), serviceAccountsGroupId: tokenId('serviceAccountsGroup') },
        },
      },
    } as unknown as Step
    const lines = stepPortalLines(asStep, {
      nameOf: (id: string) => dir.label(id),
      policyName: typeof example.policyName === 'string' ? example.policyName : step.title,
      strengthName: typeof example.strengthName === 'string' ? example.strengthName : null,
    })
    if (lines && lines.length > 0) out[step.id] = { steps: lines }
  }
  return out
}

export function writeTranslatorOutput(): void {
  const out = buildTranslatorOutput()
  writeFileSync('docs/design/translator-output.json', JSON.stringify(out, null, 2) + '\n')
  console.log(`translator-dump: wrote docs/design/translator-output.json (${Object.keys(out).length} mapped policy steps)`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) writeTranslatorOutput()
