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
//   * *which deployed policy object* the scan saw, as an opaque stable identity;
//   * the state the scan saw (absent / disabled / report-only / enforced);
//   * a fingerprint of the policy's *material* semantics, so a rename is not a
//     change and a new grant is;
//   * the scan that first saw this artifact in this state with these semantics —
//     first seen by IAMAI, never claimed as a Microsoft transition time;
//   * Microsoft's own evidence for when the state began, on the one occasion the
//     tenant can prove it: a sign-in record evaluated under the policy in
//     report-only.
//
// The artifact identity is the fact that makes the rest safe, and it is a
// different fact from the fingerprint. A fingerprint answers *what does this
// policy mean*; it does not answer *is this the same object I watched before*.
// Without the identity, a policy deleted and replaced by a different one meaning
// the same thing inherited the window the first one had earned — a week of
// observation nobody performed on the object now deployed.
//
// Comparing the latest observation with the prior one answers what the plan
// needs: what the scan sees, what it saw before, what moved, whether the earlier
// observation still speaks for what is deployed now (continuity), and — a
// separate question — whether what happened needs a person to look at it. New
// evidence does not restart observation; a material semantic change does, and so
// does a different object. Pure, no DOM.
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
  /**
   * Which deployed policy object this observation is about: an opaque, stable
   * identity for the tenant policy's own id (`artifactIdOf`), and nothing else —
   * never its name, its goal, the step it is filed under or what it means, none
   * of which say whether this is the same object.
   *
   * Null where none was recorded: a record written before this contract existed,
   * or a sighting with no policy behind it at all. A null proves nothing, so it
   * can never carry a window from one object to another.
   */
  artifact: string | null
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

/**
 * What moved between the prior scan and this one. `artifact` is a different
 * policy object delivering the step, whatever it means and whatever state it is
 * in — the one move a fingerprint cannot see.
 */
export type ObservationChanged = 'first-scan' | 'none' | 'state' | 'semantics' | 'both' | 'artifact'

/**
 * Whether the earlier observation still speaks for what is deployed now.
 *
 * - `first-scan`: there is nothing earlier.
 * - `continues`: the same object, meaning the same thing. The window it earned
 *   is still its own.
 * - `reset`: the earlier observation provably does not apply — a different
 *   object is deployed, or this one was materially rewritten. The window starts
 *   again from this scan.
 * - `unknown`: it cannot be shown either way, because the earlier record does
 *   not say which object it was about (a plan saved before this contract). Not
 *   treated as continuity: an unproven window advances nothing.
 */
export type ObservationContinuity = 'first-scan' | 'continues' | 'reset' | 'unknown'

export type ObservationChange = {
  latest: StepObservation
  /** What the previous scan recorded; null on the first scan that saw this step's policy. */
  prior: StepObservation | null
  changed: ObservationChanged
  /** The change is the one the plan asked for: a forward move along the lifecycle, or the semantics the step's own operation submits. */
  expected: boolean
  /**
   * Whether the earlier observation still carries over. This is a question about
   * *history*, and it is not the question of whether anything is wrong: a policy
   * replaced by exactly the one the plan meant to create resets the window (the
   * new object has been watched for no time at all) without anybody needing to
   * look at it.
   */
  continuity: ObservationContinuity
  /**
   * A person needs to look: what the policy *means* is now something the plan did
   * not ask for. Kept apart from `continuity` on purpose — collapsing the two
   * made every restarted window a review, and a rollout that resets its clock is
   * not a rollout in trouble.
   */
  reviewRequired: boolean
  /** One sentence for the step, from shared.engine.observation. */
  note: string
}

/**
 * True when the window a policy had earned does not carry into this scan: the
 * object changed, it was rewritten, or the record cannot say. Everything that
 * would otherwise let an earlier date close a rollout gate reads this.
 */
export function historyReset(change: ObservationChange): boolean {
  return change.continuity === 'reset' || change.continuity === 'unknown'
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

/**
 * The stable identity of one deployed policy object, as the plan record keeps it.
 *
 * Opaque on purpose: the record is the decisions-only block, and equality is the
 * only question ever asked of this value, so the tenant's own object id does not
 * have to be written into a saved plan to answer it. Two hashes of the id, so the
 * 32 bits of one are not all that stands between two policies and each other's
 * history.
 */
export function artifactIdOf(policyId: string | null | undefined): string | null {
  if (typeof policyId !== 'string' || policyId.length === 0) return null
  return hash(policyId) + hash(`${policyId} artifact`)
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
  /** Which policy object was seen (`artifactIdOf` of the matched tenant policy's id); null when none was. */
  artifact: string | null
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

function noteFor(continuity: ObservationContinuity, changed: ObservationChanged, expected: boolean, state: ObservedState, date: string): string {
  // What happened to the object comes first: a different policy delivering this
  // now, or a record that cannot say which one it watched, is the fact about the
  // history, whatever else moved with it.
  if (continuity === 'unknown') return fillText(OBS.continuityUnknown, { date })
  if (changed === 'artifact') return fillText(OBS.artifactReplaced, { date })
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
  const artifact = sighting.artifact ?? null
  const evidenceAt = sighting.evidenceAt ?? null
  const intended = sighting.intended ?? null
  const date = absoluteDate(at)
  if (!prior) {
    return {
      latest: { artifact, state, semantics, firstSeenAt: at, since: 'first-scan', lastSeenAt: at, evidenceAt },
      prior: null,
      changed: 'first-scan',
      // A first sighting is nothing the plan can claim to have asked for.
      expected: false,
      continuity: 'first-scan',
      reviewRequired: false,
      note: fillText(OBS.firstScan, { state: STATE_WORD[state], date }),
    }
  }
  // Is this the same object? Three answers, and only one of them is "yes".
  // Two nulls are not a match — they are two sightings of nothing, which is what
  // a step with no policy deployed has, and there is no window to carry either
  // way. One null against a real id is a record that cannot say.
  const artifactAnswer: 'same' | 'different' | 'unknown' =
    artifact !== null && prior.artifact !== null ? (artifact === prior.artifact ? 'same' : 'different') : artifact === null && prior.artifact === null ? 'same' : 'unknown'
  const stateMoved = prior.state !== state
  // An unrecorded fingerprint on either side proves nothing. A record written
  // before this contract existed carries none, and reading its silence as a
  // rewrite would restart every observation window on the upgrade alone.
  const semanticsKnown = prior.semantics.length > 0 && semantics.length > 0
  const semanticsMoved = semanticsKnown && prior.semantics !== semantics
  const changed: ObservationChanged =
    artifactAnswer === 'different' ? 'artifact' : stateMoved && semanticsMoved ? 'both' : semanticsMoved ? 'semantics' : stateMoved ? 'state' : 'none'
  /**
   * Whether the window carries over. A different object never carries one, whatever
   * it means: identical semantics say the tenant has a policy that means the same
   * thing, not that anybody watched *this* one. A record that cannot say which
   * object it watched cannot prove it either, so it is unknown rather than assumed
   * — the only case where a saved plan loses a window it may genuinely have earned,
   * and the conservative direction.
   */
  const continuity: ObservationContinuity =
    artifactAnswer === 'unknown' ? 'unknown' : artifactAnswer === 'different' || semanticsMoved ? 'reset' : 'continues'
  const expected =
    changed === 'none' ||
    (intended !== null && intended.length > 0 && semantics === intended) ||
    (!semanticsMoved && rank(state) > rank(prior.state))
  /**
   * A person looks when what the policy *means* is not what the plan asked for.
   * Not when the window restarts: a policy replaced by exactly the one the plan
   * meant to create, or by a different object saying the same thing, has changed
   * nothing about what happens to anybody. Continuity is a fact about history;
   * this is a fact about the tenant, and the two used to be one boolean.
   */
  const reviewRequired = semanticsMoved && !expected
  // The window a state has earned survives anything that did not move it — and
  // begins again at this scan wherever it does not carry over at all.
  const moved = changed !== 'none' || continuity !== 'continues'
  const firstSeenAt = moved ? at : prior.firstSeenAt
  /**
   * What the new floor is worth. `observed-change` is a real lower bound: IAMAI
   * watched this object move, so nothing recorded before it is about what is
   * deployed now. A different object, or a record that cannot say, is not
   * something IAMAI watched happen — this object may well be older than the first
   * scan that could vouch for it — so its own evidence is still admissible, and
   * `first-scan` says exactly that.
   */
  const since: StepObservation['since'] = artifactAnswer === 'same' ? (moved ? 'observed-change' : prior.since) : 'first-scan'
  return {
    latest: {
      artifact,
      state,
      semantics,
      firstSeenAt,
      since,
      lastSeenAt: at,
      // Evidence recorded before a change IAMAI watched happen is evidence about
      // what the policy used to be, and says nothing about this one. Evidence
      // carried in from the prior record is about the prior object, so it is
      // dropped the moment the object is not provably the same one.
      evidenceAt: earliest(moved || artifactAnswer !== 'same' ? null : prior.evidenceAt, admit(evidenceAt, firstSeenAt, since)),
    },
    prior,
    changed,
    expected,
    continuity,
    reviewRequired,
    note: noteFor(continuity, changed, expected, state, date),
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
        // A record written before artifact identity existed carries none, and
        // that absence is the fact: continuity is unknown, never assumed.
        artifact: typeof o.artifact === 'string' && o.artifact.length > 0 ? o.artifact : null,
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
  // first saw the policy in report-only. That is a report-only observation with
  // neither a fingerprint nor an object behind it, so it migrates as one and
  // loads for history and for display — but it names no artifact, so it proves
  // nothing about the policy deployed now and closes no gate on its own.
  const legacy = rec?.reportOnlySeen
  if (legacy && typeof legacy === 'object') {
    for (const [id, at] of Object.entries(legacy as Record<string, unknown>)) {
      if (out[id] || typeof at !== 'string' || Number.isNaN(Date.parse(at))) continue
      out[id] = { artifact: null, state: 'report-only', semantics: '', firstSeenAt: at, since: 'first-scan', lastSeenAt: at, evidenceAt: null }
    }
  }
  return out
}
