// The scan-to-scan evidence contract (Foundation B).
//
// A snapshot says what the tenant looks like now. It never says what it looked
// like last week, and it never says when anything changed: `modifiedDateTime` is
// the object's last edit, not the moment a policy began to enforce. So the only
// history IAMAI can honestly keep is its own — what a scan saw, and when a scan
// first saw it — and the record has to say which of the two it is holding.
//
// One observation per step, carried in the plan record between scans:
//
//   * the state the scan saw (absent / disabled / report-only / enforced);
//   * a fingerprint of the policy's *material* semantics, so a rename is not a
//     change and a new grant is;
//   * the scan that first saw this state with these semantics — first seen by
//     IAMAI, never claimed as a Microsoft transition time;
//   * Microsoft's own evidence for when the state began, on the one occasion the
//     tenant can prove it: a sign-in record evaluated under the policy in
//     report-only.
//
// Comparing the latest observation with the prior one answers the four
// questions the plan needs: what the scan sees, what it saw before, what moved,
// and whether what moved invalidates the earlier observation. New evidence does
// not reset observation; only a material semantic change does. Pure, no DOM.
import { engine } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { absoluteDate } from '../copy/dates.ts'

const OBS = engine.observation

/** The Conditional Access state a scan saw, in the product's words rather than Graph's. */
export type ObservedState = 'absent' | 'disabled' | 'report-only' | 'enforced' | 'unknown'

/** Graph's `state` for a policy the scan matched to a step; a missing policy is not there. */
export function observedStateOf(state: string | null | undefined): ObservedState {
  if (state === undefined || state === null || state === 'deleted') return 'absent'
  if (state === 'enabled') return 'enforced'
  if (state === 'enabledForReportingButNotEnforced') return 'report-only'
  if (state === 'disabled') return 'disabled'
  return 'unknown'
}

/**
 * What a scan saw of one step's policy. Persisted in the plan record
 * (PlanDecisions.observations) because no regeneration can work it out again.
 */
export type StepObservation = {
  state: ObservedState
  /**
   * A fingerprint of the fields that decide what the policy does. Empty means
   * the semantics were not recorded — a record written before this contract
   * existed, or a state with no policy behind it — and an unrecorded
   * fingerprint is never read as a change.
   */
  semantics: string
  /** The scan (snapshot.asOf) that first saw this state with these semantics. IAMAI's own sighting, not a transition time. */
  firstSeenAt: string
  /**
   * What `firstSeenAt` is worth. `first-scan`: the first time IAMAI looked, so
   * the state may be much older and evidence from before it still counts.
   * `observed-change`: IAMAI watched the change happen, so it is a real lower
   * bound and anything recorded before it is about what the policy used to be.
   */
  since: 'first-scan' | 'observed-change'
  /** The most recent scan that saw it. */
  lastSeenAt: string
  /** Microsoft's own evidence for when the state began, where the tenant proves it; null when the first sighting is all that is known. */
  evidenceAt: string | null
}

/** What moved between the prior scan and this one. */
export type ObservationChanged = 'first-scan' | 'none' | 'state' | 'semantics' | 'both'

export type ObservationChange = {
  latest: StepObservation
  /** What the previous scan recorded; null on the first scan that saw this step's policy. */
  prior: StepObservation | null
  changed: ObservationChanged
  /** The change is the one the plan asked for: a forward move along the lifecycle, or the semantics the step's own operation submits. */
  expected: boolean
  /**
   * The earlier observation no longer speaks for what is deployed now. Only a
   * material semantic change sets this: a policy that was watched for a week and
   * then rewritten has not been watched at all.
   */
  invalidated: boolean
  /** One sentence for the step, from shared.engine.observation. */
  note: string
}

// ---- the material fingerprint ----

const COSMETIC = new Set(['displayName', 'id', 'createdDateTime', 'modifiedDateTime', 'templateId', 'description', '@odata.context', '@odata.type'])

/**
 * The policy's material fields, canonically ordered: the conditions it acts on,
 * the controls it grants and the session it leaves behind. A rename, a
 * re-ordered include list and a fresh `modifiedDateTime` all fingerprint the
 * same; a new grant, a new scope or a new session lifetime do not.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canonical)
    // Graph does not promise an order for a list of ids; a list of objects is
    // left as it came, because its order can carry meaning.
    return items.every((v) => typeof v === 'string' || typeof v === 'number') ? [...items].sort() : items
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (COSMETIC.has(key)) continue
      const v = (value as Record<string, unknown>)[key]
      if (v === undefined) continue
      out[key] = canonical(v)
    }
    return out
  }
  return value
}

/** FNV-1a over the canonical text. Short, stable, and carries none of the tenant's own values into a plan file. */
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** The fingerprint of a policy row's material semantics; empty for no policy at all. */
export function semanticsOf(policy: Record<string, unknown> | null | undefined): string {
  if (!policy) return ''
  const material = {
    conditions: canonical(policy.conditions ?? null),
    grantControls: canonical(policy.grantControls ?? null),
    sessionControls: canonical(policy.sessionControls ?? null),
  }
  return hash(JSON.stringify(material))
}

// ---- the comparison ----

/** The lifecycle direction: a move up this list is the plan's own work landing. */
const FORWARD: ObservedState[] = ['absent', 'disabled', 'report-only', 'enforced']
const rank = (s: ObservedState): number => FORWARD.indexOf(s)

export type Sighting = {
  state: ObservedState
  semantics: string
  /** The scan: snapshot.asOf. */
  at: string
  /** Microsoft's own evidence for when this state began, where the tenant proves it. */
  evidenceAt?: string | null
  /** The semantics the step's own operation would leave behind, where the plan can read them; null when it cannot tell. */
  intended?: string | null
}

const STATE_WORD: Record<ObservedState, string> = {
  absent: OBS.states.absent,
  disabled: OBS.states.disabled,
  'report-only': OBS.states.reportOnly,
  enforced: OBS.states.enforced,
  unknown: OBS.states.unknown,
}

function noteFor(changed: ObservationChanged, expected: boolean, state: ObservedState, date: string): string {
  if (changed === 'none') return fillText(OBS.unchanged, { state: STATE_WORD[state], date })
  if (changed === 'state') return fillText(expected ? OBS.stateChangedExpected : OBS.stateChanged, { state: STATE_WORD[state], date })
  return fillText(OBS.semanticsChanged, { date })
}

/** Microsoft's evidence, where it can still be about the policy that is deployed now. */
function admit(at: string | null, floor: string, since: StepObservation['since']): string | null {
  if (at === null) return null
  if (since === 'first-scan') return at
  return Date.parse(at) >= Date.parse(floor) ? at : null
}

function earliest(a: string | null, b: string | null): string | null {
  if (a === null) return b
  if (b === null) return a
  return Date.parse(b) < Date.parse(a) ? b : a
}

/**
 * The latest observation against the prior one. `prior` is what the plan record
 * carried into this scan; null is the first scan that saw this step's policy.
 */
export function observe(prior: StepObservation | null, sighting: Sighting): ObservationChange {
  const { state, semantics, at } = sighting
  const evidenceAt = sighting.evidenceAt ?? null
  const intended = sighting.intended ?? null
  const date = absoluteDate(at)
  if (!prior) {
    return {
      latest: { state, semantics, firstSeenAt: at, since: 'first-scan', lastSeenAt: at, evidenceAt },
      prior: null,
      changed: 'first-scan',
      // A first sighting is nothing the plan can claim to have asked for.
      expected: false,
      invalidated: false,
      note: fillText(OBS.firstScan, { state: STATE_WORD[state], date }),
    }
  }
  const stateMoved = prior.state !== state
  // An unrecorded fingerprint on either side proves nothing. A record written
  // before this contract existed carries none, and reading its silence as a
  // rewrite would restart every observation window on the upgrade alone.
  const semanticsKnown = prior.semantics.length > 0 && semantics.length > 0
  const semanticsMoved = semanticsKnown && prior.semantics !== semantics
  const changed: ObservationChanged = stateMoved && semanticsMoved ? 'both' : semanticsMoved ? 'semantics' : stateMoved ? 'state' : 'none'
  const invalidated = semanticsMoved
  const expected =
    changed === 'none' ||
    (intended !== null && intended.length > 0 && semantics === intended) ||
    (!semanticsMoved && rank(state) > rank(prior.state))
  // The window a state has earned survives anything that did not move it.
  const moved = changed !== 'none'
  const firstSeenAt = moved ? at : prior.firstSeenAt
  const since: StepObservation['since'] = moved ? 'observed-change' : prior.since
  return {
    latest: {
      state,
      semantics,
      firstSeenAt,
      since,
      lastSeenAt: at,
      // Evidence recorded before a change IAMAI watched happen is evidence
      // about what the policy used to be, and says nothing about this one.
      evidenceAt: earliest(moved ? null : prior.evidenceAt, admit(evidenceAt, firstSeenAt, since)),
    },
    prior,
    changed,
    expected,
    invalidated,
    note: noteFor(changed, expected, state, date),
  }
}

// ---- the plan record ----

function isObserved(v: unknown): v is ObservedState {
  return v === 'absent' || v === 'disabled' || v === 'report-only' || v === 'enforced' || v === 'unknown'
}

/** Read a stored record's observations, whatever its vintage. */
export function observationsFrom(rec: { observations?: unknown; reportOnlySeen?: unknown } | null | undefined): Record<string, StepObservation> {
  const out: Record<string, StepObservation> = {}
  const stored = rec?.observations
  if (stored && typeof stored === 'object') {
    for (const [id, raw] of Object.entries(stored as Record<string, unknown>)) {
      const o = raw as Partial<StepObservation> | null
      if (!o || typeof o !== 'object') continue
      const firstSeenAt = typeof o.firstSeenAt === 'string' && !Number.isNaN(Date.parse(o.firstSeenAt)) ? o.firstSeenAt : null
      if (firstSeenAt === null) continue
      out[id] = {
        state: isObserved(o.state) ? o.state : 'unknown',
        semantics: typeof o.semantics === 'string' ? o.semantics : '',
        firstSeenAt,
        since: o.since === 'observed-change' ? 'observed-change' : 'first-scan',
        lastSeenAt: typeof o.lastSeenAt === 'string' && !Number.isNaN(Date.parse(o.lastSeenAt)) ? o.lastSeenAt : firstSeenAt,
        evidenceAt: typeof o.evidenceAt === 'string' && !Number.isNaN(Date.parse(o.evidenceAt)) ? o.evidenceAt : null,
      }
    }
  }
  // A record from before this contract kept one date per step: the scan that
  // first saw the policy in report-only. That is exactly a report-only
  // observation with its fingerprint unrecorded, so it migrates as one and the
  // window it earned survives the upgrade.
  const legacy = rec?.reportOnlySeen
  if (legacy && typeof legacy === 'object') {
    for (const [id, at] of Object.entries(legacy as Record<string, unknown>)) {
      if (out[id] || typeof at !== 'string' || Number.isNaN(Date.parse(at))) continue
      out[id] = { state: 'report-only', semantics: '', firstSeenAt: at, since: 'first-scan', lastSeenAt: at, evidenceAt: null }
    }
  }
  return out
}
