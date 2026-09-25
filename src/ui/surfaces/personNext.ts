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
import { app } from '../../content/content.ts'
import { nextCell, nextWords } from './readinessCells.ts'
import type { StepVarContext } from './stepVars.ts'
import type { NextAction } from '../../scoring/phishingResistant.ts'

/** A person on a card: "{name}: {next}" (pages.app.plan.stepContract.cardPerson). */
const PERSON = (app.plan as unknown as { stepContract: { cardPerson: string } }).stepContract.cardPerson

// One reading per snapshot and mapping: several cards on one step read it.
const cache = new WeakMap<TenantSnapshot, WeakMap<object, ReadonlyMap<string, string>>>()
const deviceCache = new WeakMap<TenantSnapshot, WeakMap<object, ReadonlyMap<string, string>>>()

/**
 * Registering a device (5.2), what a person holds on that device cannot answer
 * (roadmap/methodReadiness.ts; Microsoft: "Windows Hello for Business and
 * device-bound passkeys aren't supported because those scenarios require the
 * device to be already registered"). Windows Hello, a passkey in Windows Hello
 * and a Mac's Platform SSO credential are those. A next step that names one, or
 * none because one already makes the person ready on MFA Readiness, becomes a
 * passkey in Microsoft Authenticator, which answers from the phone.
 */
const ON_THE_DEVICE_OPTIONS: ReadonlySet<string> = new Set(['windowsHello', 'windowsHelloPasskey', 'platformSso'])
const ON_THE_DEVICE_CLASSES: ReadonlySet<string> = new Set(['windowsHello', 'platformCredential'])
const onTheDevice = (n: NextAction): boolean => n.kind === 'none' || ('option' in n && ON_THE_DEVICE_OPTIONS.has(n.option)) || ('cls' in n && ON_THE_DEVICE_CLASSES.has(n.cls))

/** Each counted person's next step on MFA Readiness, by id; a person the page does not count has none. For a device registration, never a method on the device being registered. */
export function readinessNextOf(snapshot: TenantSnapshot, now: string, mapping: Pick<MappingState, 'breakGlassUserIds' | 'serviceAccountUserIds'>, registersDevice = false): ReadonlyMap<string, string> {
  const store = registersDevice ? deviceCache : cache
  const byMapping = store.get(snapshot) ?? new WeakMap<object, ReadonlyMap<string, string>>()
  store.set(snapshot, byMapping)
  const held = byMapping.get(mapping)
  if (held) return held
  const out = new Map<string, string>()
  const passkey = nextWords({ kind: 'setUp', option: 'authenticatorPasskey', os: null })
  for (const row of readinessView(snapshot, now, mapping).rows) {
    // A person the page could not place (Unknown) has no next step to hand over:
    // the card keeps its own line for them, never "the next scan retries".
    if (row.state === 'unknown') continue
    const next = registersDevice && row.readiness && onTheDevice(row.readiness.next) ? passkey : nextCell(row)
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
export function personLines(ctx: StepVarContext, ids: readonly string[], opts: { registersDevice?: boolean } = {}): string[] {
  const line = PERSON
  const next = readinessNextOf(ctx.snapshot, ctx.now, ctx.mapping, opts.registersDevice === true)
  const labels = personLabels(ctx.snapshot.users, { address: true })
  const passkey = nextWords({ kind: 'setUp', option: 'authenticatorPasskey', os: null })
  return ids.map((id) => fillText(line, { name: labels.get(id) ?? ctx.nameOf(id), next: next.get(id) ?? passkey }))
}
