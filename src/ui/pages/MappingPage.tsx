// Setup — the 5–9 questions a human actually answers (2026-08-27 redesign).
// Everything else the baseline references is auto-resolved in wizard.ts.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { getGroupMembers, searchGroups } from '../../graph/collect/onDemand.ts'
import type { GroupMembersCacheEntry } from '../../graph/collect/cache.ts'
import { detectFacets } from '../../coverage/applicability.ts'
import type { Facet } from '../../coverage/applicability.ts'
import { docFor } from '../../baseline/index.ts'
import { loadMappingState, saveMappingState } from '../../mapping/store.ts'
import { validateBreakGlass, validateExclusionGroup, validateTrustedLocation } from '../../mapping/validate.ts'
import type { MappingState, ValidationResult } from '../../mapping/types.ts'
import {
  activeWizardQuestions,
  applyAutoResolution,
  applyWizardAnswers,
  wizardProgress,
} from '../../mapping/wizard.ts'
import type { WizardQuestionDef } from '../../mapping/wizard.ts'
import { setDisplayTimeZone } from '../format.ts'
import { StepFrame } from '../shell/AppShell.tsx'
import type { BaselineResult } from './BaselinePage.tsx'

const COMMON_TIMEZONES = [
  'Australia/Sydney',
  'Australia/Brisbane',
  'Australia/Perth',
  'Pacific/Auckland',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Singapore',
  'UTC',
]

const FRAMEWORK_OPTIONS = ['CIS Controls v8', 'Essential Eight (ACSC)', 'NIST CSF']

export function MappingPage({
  scan,
  baseline,
  onProgress,
}: {
  scan: { snapshot: TenantSnapshot; at: string } | null
  baseline: BaselineResult | null
  onProgress: (p: { answered: number; total: number; complete: boolean }) => void
}) {
  const [state, setState] = useState<MappingState | null>(null)
  const [knownGroups, setKnownGroups] = useState<GroupMembersCacheEntry[]>([])
  const snapshot = scan?.snapshot ?? null
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!snapshot) return
    void loadMappingState(snapshot.tenantId).then(setState)
  }, [snapshot])

  useEffect(() => {
    if (!snapshot) return
    let cancelled = false
    const ids = new Set<string>()
    for (const raw of snapshot.config.caPolicies?.rows ?? []) {
      const users = (raw as { conditions?: { users?: { includeGroups?: string[]; excludeGroups?: string[] } } })
        .conditions?.users
      for (const g of users?.includeGroups ?? []) ids.add(g)
      for (const g of users?.excludeGroups ?? []) ids.add(g)
    }
    void (async () => {
      const out: GroupMembersCacheEntry[] = []
      for (const id of ids) {
        try {
          out.push(await getGroupMembers(snapshot.tenantId, id))
        } catch {
          // suggestions just won't include it
        }
      }
      if (!cancelled) setKnownGroups(out)
    })()
    return () => {
      cancelled = true
    }
  }, [snapshot])

  const progress = useMemo(
    () => (state ? wizardProgress(state) : { answered: 0, total: 0, complete: false }),
    [state],
  )
  useEffect(() => onProgress(progress), [progress, onProgress])
  useEffect(() => {
    if (state?.displayTimeZone) setDisplayTimeZone(state.displayTimeZone)
  }, [state?.displayTimeZone])

  const update = (mut: (s: MappingState) => MappingState): void => {
    setState((prev) => {
      if (!prev || !baseline || !snapshot) return prev
      let next = mut(prev)
      next = applyWizardAnswers(next, baseline.pkg)
      next = applyAutoResolution(next, baseline.pkg, snapshot).state
      void saveMappingState(next)
      return next
    })
  }

  const answered = (id: string): void =>
    update((s) => ({ ...s, wizardAnswered: { ...s.wizardAnswered, [id]: true } }))

  const questions = useMemo(() => activeWizardQuestions(baseline?.pkg ?? null), [baseline])

  const needs = [
    { met: baseline !== null, text: baseline !== null ? 'baseline loaded' : 'load a baseline', href: '#/baseline' },
    { met: scan !== null, text: scan !== null ? 'scan complete' : 'run a scan', href: '#/scan' },
  ]

  if (!baseline || !snapshot || !state) {
    return (
      <StepFrame
        title="Setup"
        does="A handful of questions about your tenant — I work out everything else myself."
        needs={needs}
      >
        <div className="card">
          <p>
            Setup needs a loaded baseline and a scan. {!baseline && <a href="#/baseline">Load a baseline</a>}
            {!baseline && !scan && ' and '}
            {!scan && <a href="#/scan">run a scan</a>}.
          </p>
        </div>
      </StepFrame>
    )
  }

  const autoCount = Object.values(state.records).filter((r) => r.resolvedId !== null || r.doesNotExist).length

  return (
    <StepFrame
      title="Setup"
      does="A handful of questions about your tenant — I work out everything else myself."
      needs={needs}
      next="coverage"
      nextLabel="Findings"
    >
      <p className="notice">
        <strong>
          {progress.answered} of {progress.total} answered
        </strong>
        {progress.complete
          ? ' — that covers everything I need. The optional ones below sharpen the plan.'
          : ' — the required ones unlock the plan; the rest are optional.'}
        {autoCount > 0 && (
          <span className="reason"> I resolved {autoCount} baseline reference(s) automatically so you don't have to.</span>
        )}
      </p>

      {questions.map((q, i) => (
        <WizardCard
          key={q.id}
          index={i + 1}
          def={q}
          state={state}
          snapshot={snapshot}
          baseline={baseline}
          knownGroups={knownGroups}
          update={update}
          answered={answered}
        />
      ))}
    </StepFrame>
  )
}

// ---------- individual question cards ----------

function WizardCard(props: {
  index: number
  def: WizardQuestionDef
  state: MappingState
  snapshot: TenantSnapshot
  baseline: BaselineResult
  knownGroups: GroupMembersCacheEntry[]
  update: (mut: (s: MappingState) => MappingState) => void
  answered: (id: string) => void
}) {
  const { def, state } = props
  const done = state.wizardAnswered[def.id] === true
  return (
    <details className="card wizard-card" open={!done}>
      <summary>
        <span className={`chip ${done ? 'state-verified' : def.required ? 'state-notChallenged' : ''}`}>
          {done ? 'Answered' : def.required ? 'Required' : 'Optional'}
        </span>{' '}
        <strong>
          {props.index}. {def.question}
        </strong>
      </summary>
      <p className="reason">{def.help}</p>
      <QuestionBody {...props} />
    </details>
  )
}

function QuestionBody(props: Parameters<typeof WizardCard>[0]) {
  switch (props.def.id) {
    case 'breakGlass':
      return <BreakGlassQuestion {...props} />
    case 'globalExclusion':
      return <GlobalExclusionQuestion {...props} />
    case 'highCare':
      return <HighCareQuestion {...props} />
    case 'trustedLocations':
      return <TrustedLocationsQuestion {...props} />
    case 'serviceAccounts':
      return <ServiceAccountsQuestion {...props} />
    case 'variants':
      return <VariantsQuestion {...props} />
    case 'timeZone':
      return <TimeZoneQuestion {...props} />
    case 'frameworks':
      return <FrameworksQuestion {...props} />
    case 'applicability':
      return <ApplicabilityQuestion {...props} />
  }
}

function UserMultiPicker({
  snapshot,
  selected,
  onChange,
  placeholder,
}: {
  snapshot: TenantSnapshot
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const options = useMemo(() => {
    const q = query.toLowerCase()
    return snapshot.users
      .filter(
        (u) =>
          !selected.includes(u.id) &&
          ((u.displayName ?? '').toLowerCase().includes(q) || (u.userPrincipalName ?? '').toLowerCase().includes(q)),
      )
      .slice(0, 6)
  }, [snapshot, query, selected])
  const nameOf = (id: string) => {
    const u = snapshot.users.find((x) => x.id === id)
    return u?.displayName ?? u?.userPrincipalName ?? id
  }
  return (
    <div>
      <p>
        {selected.map((id) => (
          <button key={id} className="chip selected" title="Remove" onClick={() => onChange(selected.filter((x) => x !== id))}>
            {nameOf(id)} ✕
          </button>
        ))}
      </p>
      <input type="search" placeholder={placeholder} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      {query.length > 0 && (
        <p>
          {options.map((u) => (
            <button
              key={u.id}
              className="chip"
              onClick={() => {
                onChange([...selected, u.id])
                setQuery('')
              }}
            >
              {u.displayName ?? u.userPrincipalName}
              <span className="sub"> {u.userPrincipalName}</span>
            </button>
          ))}
          {options.length === 0 && <span className="reason">no matches</span>}
        </p>
      )}
    </div>
  )
}

function GroupPicker({
  selected,
  selectedName,
  knownGroups,
  onPick,
  onClear,
}: {
  selected: string | null
  selectedName: string | null
  knownGroups: GroupMembersCacheEntry[]
  onPick: (id: string, name: string) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState<{ id: string; displayName: string }[]>([])
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (query.trim().length < 2) {
      setRemote([])
      return
    }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      void searchGroups(query).then(setRemote).catch(() => setRemote([]))
    }, 300)
  }, [query])
  const local = knownGroups
    .filter((g) => g.displayName !== null && g.displayName.toLowerCase().includes(query.toLowerCase()))
    .map((g) => ({ id: g.groupId, displayName: g.displayName ?? g.groupId }))
  const options = [...local, ...remote.filter((r) => !local.some((l) => l.id === r.id))].slice(0, 6)
  if (selected !== null) {
    return (
      <p>
        <span className="chip state-verified">{selectedName ?? selected}</span>{' '}
        <button className="chip" onClick={onClear}>
          Change
        </button>
      </p>
    )
  }
  return (
    <div>
      <input
        type="search"
        placeholder="Start typing a group name…"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
      />
      {query.length > 1 && (
        <p>
          {options.map((o) => (
            <button key={o.id} className="chip" onClick={() => onPick(o.id, o.displayName)}>
              {o.displayName}
            </button>
          ))}
          {options.length === 0 && <span className="reason">no matches yet…</span>}
        </p>
      )}
    </div>
  )
}

function ValidationView({ v }: { v: ValidationResult | null }) {
  if (!v) return null
  return (
    <div className={v.passed ? 'notice' : 'notice error'}>
      {v.passed ? 'Checks passed' : 'Needs attention before this is safe'}
      <ul className="sections">
        {v.findings.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    </div>
  )
}

function BreakGlassQuestion({ state, snapshot, knownGroups, update, answered }: Parameters<typeof WizardCard>[0]) {
  const [validations, setValidations] = useState<Record<string, ValidationResult>>({})
  const runValidation = (ids: string[]): void => {
    const tenantPolicies = snapshot.config.caPolicies?.rows ?? []
    const out: Record<string, ValidationResult> = {}
    for (const id of ids) {
      out[id] = validateBreakGlass(id, {
        snapshot,
        tenantPolicies,
        groupMembers: knownGroups,
        confirmedBreakGlassIds: ids,
      })
    }
    setValidations(out)
  }
  return (
    <div>
      <UserMultiPicker
        snapshot={snapshot}
        selected={state.breakGlassUserIds}
        placeholder="Search your users…"
        onChange={(ids) => {
          update((s) => ({ ...s, breakGlassUserIds: ids }))
          runValidation(ids)
          if (ids.length > 0) answered('breakGlass')
        }}
      />
      {state.breakGlassUserIds.map((id) => (
        <div key={id}>
          <p className="reason">{snapshot.users.find((u) => u.id === id)?.displayName ?? id}:</p>
          <ValidationView v={validations[id] ?? null} />
        </div>
      ))}
      <p>
        <button
          className="chip"
          onClick={() => {
            update((s) => ({
              ...s,
              records: {
                ...s.records,
                __breakGlassMissing: {
                  placeholder: '__breakGlassMissing',
                  kind: 'user',
                  group: 'breakGlass',
                  resolvedId: null,
                  resolvedName: null,
                  provenance: 'confirmed',
                  doesNotExist: true,
                  validation: null,
                },
              },
            }))
            answered('breakGlass')
          }}
        >
          We don't have break-glass accounts yet — put creating them in the plan
        </button>
      </p>
    </div>
  )
}

function GlobalExclusionQuestion({ state, snapshot, knownGroups, update, answered }: Parameters<typeof WizardCard>[0]) {
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const rec = state.records['__globalExclusion']
  return (
    <div>
      <GroupPicker
        selected={rec?.resolvedId ?? null}
        selectedName={rec?.resolvedName ?? null}
        knownGroups={knownGroups}
        onClear={() =>
          update((s) => {
            const records = { ...s.records }
            delete records['__globalExclusion']
            return { ...s, records, wizardAnswered: { ...s.wizardAnswered, globalExclusion: false } }
          })
        }
        onPick={(id, name) => {
          update((s) => ({
            ...s,
            records: {
              ...s.records,
              __globalExclusion: {
                placeholder: '__globalExclusion',
                kind: 'group',
                group: 'globalExclusion',
                resolvedId: id,
                resolvedName: name,
                provenance: 'confirmed',
                doesNotExist: false,
                validation: null,
              },
            },
          }))
          answered('globalExclusion')
          const entry = knownGroups.find((g) => g.groupId === id) ?? null
          if (entry) {
            setValidation(validateExclusionGroup(entry, { snapshot, tenantPolicies: snapshot.config.caPolicies?.rows ?? [] }))
          } else {
            void getGroupMembers(snapshot.tenantId, id)
              .then((g) =>
                setValidation(validateExclusionGroup(g, { snapshot, tenantPolicies: snapshot.config.caPolicies?.rows ?? [] })),
              )
              .catch(() => setValidation(null))
          }
        }}
      />
      <ValidationView v={validation} />
      <p>
        <button
          className="chip"
          onClick={() => {
            update((s) => ({
              ...s,
              records: {
                ...s.records,
                __globalExclusion: {
                  placeholder: '__globalExclusion',
                  kind: 'group',
                  group: 'globalExclusion',
                  resolvedId: null,
                  resolvedName: null,
                  provenance: 'confirmed',
                  doesNotExist: true,
                  validation: null,
                },
              },
            }))
            answered('globalExclusion')
          }}
        >
          We don't have one — put creating it in the plan
        </button>
      </p>
    </div>
  )
}

function HighCareQuestion({ state, snapshot, update, answered }: Parameters<typeof WizardCard>[0]) {
  return (
    <div>
      <UserMultiPicker
        snapshot={snapshot}
        selected={state.highCareUserIds}
        placeholder="Search your users (executives, VIPs)…"
        onChange={(ids) => {
          update((s) => ({ ...s, highCareUserIds: ids }))
          answered('highCare')
        }}
      />
      {state.highCareUserIds.length > 0 && (
        <p className="reason">
          These {state.highCareUserIds.length} user(s) get white-glove treatment: named on every step that touches
          them, verified before anything is enforced, and sequenced after the approach is proven.
        </p>
      )}
      <p>
        <button className="chip" onClick={() => answered('highCare')}>
          Nobody needs special care
        </button>
      </p>
    </div>
  )
}

function TrustedLocationsQuestion({ state, snapshot, update, answered }: Parameters<typeof WizardCard>[0]) {
  const locations = (snapshot.config.namedLocations?.rows ?? []) as { id?: string; displayName?: string; isTrusted?: boolean }[]
  return (
    <div>
      {locations.length === 0 && <p className="reason">Your tenant has no named locations yet.</p>}
      <p>
        {locations.map((l) => {
          const id = String(l.id ?? '')
          const on = state.trustedLocationIds.includes(id)
          return (
            <button
              key={id}
              className={`chip ${on ? 'selected' : ''}`}
              title={l.isTrusted ? 'marked trusted in the tenant' : 'not marked trusted'}
              onClick={() => {
                const next = on ? state.trustedLocationIds.filter((x) => x !== id) : [...state.trustedLocationIds, id]
                update((s) => ({ ...s, trustedLocationIds: next }))
                answered('trustedLocations')
              }}
            >
              {l.displayName ?? id}
              {l.isTrusted ? ' ✓' : ''}
            </button>
          )
        })}
      </p>
      {state.trustedLocationIds.map((id) => {
        const loc = locations.find((l) => String(l.id) === id)
        return <ValidationView key={id} v={loc ? validateTrustedLocation(loc) : null} />
      })}
      <p>
        <button
          className="chip"
          onClick={() => {
            update((s) => ({ ...s, trustedLocationIds: [] }))
            answered('trustedLocations')
          }}
        >
          None yet — put creating one in the plan
        </button>
      </p>
    </div>
  )
}

function ServiceAccountsQuestion({ state, knownGroups, update, answered }: Parameters<typeof WizardCard>[0]) {
  return (
    <div>
      <GroupPicker
        selected={state.serviceAccountsGroupId}
        selectedName={knownGroups.find((g) => g.groupId === state.serviceAccountsGroupId)?.displayName ?? state.serviceAccountsGroupId}
        knownGroups={knownGroups}
        onClear={() => update((s) => ({ ...s, serviceAccountsGroupId: null, wizardAnswered: { ...s.wizardAnswered, serviceAccounts: false } }))}
        onPick={(id) => {
          update((s) => ({ ...s, serviceAccountsGroupId: id }))
          answered('serviceAccounts')
        }}
      />
      <p>
        <button
          className="chip"
          onClick={() => {
            update((s) => ({ ...s, serviceAccountsGroupId: null }))
            answered('serviceAccounts')
          }}
        >
          Not applicable
        </button>
      </p>
    </div>
  )
}

function VariantsQuestion({ state, baseline, update, answered }: Parameters<typeof WizardCard>[0]) {
  const sets = baseline.pkg.variantSets.filter((v) => v.relation === 'variant')
  const chosenAll = sets.every((v) => state.variantChoices[v.intentKey] !== undefined)
  useEffect(() => {
    if (sets.length > 0 && chosenAll && state.wizardAnswered.variants !== true) answered('variants')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenAll])
  return (
    <div>
      {sets.map((v) => (
        <div key={v.intentKey} className="card">
          {v.policyNames.map((name) => {
            const doc = docFor(baseline.pkg.docs, name)
            return (
              <label key={name} style={{ display: 'block', marginBottom: '8px' }}>
                <input
                  type="radio"
                  name={`variant-${v.intentKey}`}
                  checked={state.variantChoices[v.intentKey] === name}
                  onChange={() => update((s) => ({ ...s, variantChoices: { ...s.variantChoices, [v.intentKey]: name } }))}
                />{' '}
                <strong>{name}</strong>
                {doc?.intent && <div className="sub">{doc.intent.slice(0, 220)}</div>}
              </label>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function TimeZoneQuestion({ state, update, answered }: Parameters<typeof WizardCard>[0]) {
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone
  const zones = [browser, ...COMMON_TIMEZONES.filter((z) => z !== browser)]
  return (
    <p>
      <select
        value={state.displayTimeZone ?? browser}
        onChange={(e) => {
          update((s) => ({ ...s, displayTimeZone: e.currentTarget.value }))
          answered('timeZone')
        }}
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {z === browser ? `${z} (your browser)` : z}
          </option>
        ))}
      </select>
    </p>
  )
}

function FrameworksQuestion({ state, update, answered }: Parameters<typeof WizardCard>[0]) {
  return (
    <p>
      {FRAMEWORK_OPTIONS.map((f) => {
        const on = state.frameworks.includes(f)
        return (
          <button
            key={f}
            className={`chip ${on ? 'selected' : ''}`}
            onClick={() => {
              update((s) => ({ ...s, frameworks: on ? s.frameworks.filter((x) => x !== f) : [...s.frameworks, f] }))
              answered('frameworks')
            }}
          >
            {f}
          </button>
        )
      })}
    </p>
  )
}

function ApplicabilityQuestion({ state, snapshot, update, answered }: Parameters<typeof WizardCard>[0]) {
  const facets = detectFacets(snapshot, state.facetOverrides as Partial<Record<Facet, { on: boolean; reason: string }>>)
  return (
    <div>
      {(Object.entries(facets) as [Facet, (typeof facets)[Facet]][]).map(([facet, f]) => (
        <p key={facet}>
          <label>
            <input
              type="checkbox"
              checked={f.on}
              onChange={(e) => {
                const on = e.currentTarget.checked
                update((s) => ({
                  ...s,
                  facetOverrides: {
                    ...s.facetOverrides,
                    [facet]: { on, reason: on ? 'confirmed by operator' : 'operator says this workload is not used' },
                  },
                }))
                answered('applicability')
              }}
            />{' '}
            <strong>{facet}</strong> <span className="reason">— {f.reason}{f.source === 'override' ? ' (your answer)' : ''}</span>
          </label>
        </p>
      ))}
      <p>
        <button className="chip" onClick={() => answered('applicability')}>
          Detections look right
        </button>
      </p>
    </div>
  )
}
