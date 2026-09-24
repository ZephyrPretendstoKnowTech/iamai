// What MFA Readiness tells each person to do next, for a Plan card that names
// them (owner, 2026-09-24: the Plan and MFA Readiness speak one language, and
// every direction names the method). The words are the page's own next step
// (readinessCells.ts nextCell over derive/mfaReadiness.ts readinessView), so a
// person reads the same instruction on the card as on their MFA Readiness row.
//
// Pure: no DOM, no network.
import { readinessView } from '../../derive/mfaReadiness.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import { personLabels } from '../../names.ts'
import { fillText } from '../../content/render.ts'
import { nextCell, nextWords } from './readinessCells.ts'
import type { StepVarContext } from './stepVars.ts'

// One reading per snapshot and mapping: several cards on one step read it.
const cache = new WeakMap<TenantSnapshot, WeakMap<object, ReadonlyMap<string, string>>>()

/** Each counted person's next step on MFA Readiness, by id; a person the page does not count has none. */
export function readinessNextOf(snapshot: TenantSnapshot, now: string, mapping: Pick<MappingState, 'breakGlassUserIds' | 'serviceAccountUserIds'>): ReadonlyMap<string, string> {
  const byMapping = cache.get(snapshot) ?? new WeakMap<object, ReadonlyMap<string, string>>()
  cache.set(snapshot, byMapping)
  const held = byMapping.get(mapping)
  if (held) return held
  const out = new Map<string, string>()
  for (const row of readinessView(snapshot, now, mapping).rows) {
    // A person the page could not place (Unknown) has no next step to hand over:
    // the card keeps its own line for them, never "the next scan retries".
    if (row.state === 'unknown') continue
    const next = nextCell(row)
    if (next !== '') out.set(row.user.id, next)
  }
  byMapping.set(mapping, out)
  return out
}

/**
 * Each person as a card names them: "Name (address): next step", in MFA
 * Readiness's words. A person the page does not place (an admin with no sign-in
 * in 90 days, or one whose methods it could not read) gets the page's own
 * passkey-in-Authenticator step, so every line reads the same way.
 */
export function personLines(ctx: StepVarContext, ids: readonly string[], line: string): string[] {
  const next = readinessNextOf(ctx.snapshot, ctx.now, ctx.mapping)
  const labels = personLabels(ctx.snapshot.users, { address: true })
  const passkey = nextWords({ kind: 'setUp', option: 'authenticatorPasskey', os: null })
  return ids.map((id) => fillText(line, { name: labels.get(id) ?? ctx.nameOf(id), next: next.get(id) ?? passkey }))
}
