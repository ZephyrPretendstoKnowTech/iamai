import { useEffect, useMemo, useRef, useState } from 'react'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { getGroupMembers, searchGroups } from '../../graph/collect/onDemand.ts'
import type { GroupMembersCacheEntry } from '../../graph/collect/cache.ts'
import { detectFacets } from '../../coverage/applicability.ts'
import type { Facet } from '../../coverage/applicability.ts'
import { buildQuestions, GROUP_TITLE } from '../../mapping/questions.ts'
import { suggestFor } from '../../mapping/suggest.ts'
import type { SuggestContext } from '../../mapping/suggest.ts'
import { loadMappingState, saveMappingState } from '../../mapping/store.ts'
import {
  validateBreakGlass,
  validateExclusionGroup,
  validatePasskeyPilot,
  validateStrength,
  validateTrustedLocation,
} from '../../mapping/validate.ts'
import { mappingProgress } from '../../mapping/types.ts'
import type { MappingQuestion, MappingState, Provenance, ValidationResult } from '../../mapping/types.ts'
import { StepFrame } from '../shell/AppShell.tsx'
import type { BaselineResult } from './BaselinePage.tsx'

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

  const questions = useMemo(
    () => (baseline ? buildQuestions(baseline.pkg) : []),
    [baseline],
  )

  useEffect(() => {
    if (!snapshot) return
    void loadMappingState(snapshot.tenantId).then(setState)
  }, [snapshot])

  // Members of groups the tenant's own policies reference (for suggestions,
  // break-glass exclusion checks, and dynamic-group sweeps).
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
          // unresolved — suggestions just won't include it
        }
      }
      if (!cancelled) setKnownGroups(out)
    })()
    return () => {
      cancelled = true
    }
  }, [snapshot])

  const progress = useMemo(() => mappingProgress(questions, state ?? { records: {} } as MappingState), [questions, state])
  useEffect(() => onProgress(progress), [progress, onProgress])

  const update = (mut: (s: MappingState) => MappingState): void => {
    setState((prev) => {
      if (!prev) return prev
      const next = mut(prev)
      void saveMappingState(next)
      return next
    })
  }

  const suggestCtx: SuggestContext | null = snapshot
    ? { snapshot, tenantPolicies: snapshot.config.caPolicies?.rows ?? [], knownGroups }
    : null

  const validate = async (q: MappingQuestion, resolvedId: string): Promise<ValidationResult> => {
    if (!snapshot) return { checkedAt: new Date().toISOString(), passed: true, findings: [] }
    const tenantPolicies = snapshot.config.caPolicies?.rows ?? []
    if (q.group === 'breakGlass') {
      const confirmed = Object.values(stateRef.current?.records ?? {})
        .filter((r) => r.group === 'breakGlass' && r.resolvedId !== null)
        .map((r) => r.resolvedId as string)
      if (!confirmed.includes(resolvedId)) confirmed.push(resolvedId)
      return validateBreakGlass(resolvedId, { snapshot, tenantPolicies, groupMembers: knownGroups, confirmedBreakGlassIds: confirmed })
    }
    if (q.group === 'globalExclusion' || q.group === 'exclusionGroups') {
      let entry = knownGroups.find((g) => g.groupId === resolvedId) ?? null
      if (!entry) {
        try {
          entry = await getGroupMembers(snapshot.tenantId, resolvedId)
          setKnownGroups((prev) => [...prev, entry!])
        } catch {
          entry = null
        }
      }
      return validateExclusionGroup(entry, { snapshot, tenantPolicies })
    }
    if (q.group === 'personaGroups') {
      // Passkey-pilot personas get the pilot validation; others get the group basics.
      const authPolicy = (snapshot.config.authMethodsPolicy?.rows ?? [])[0] ?? null
      if (/passkey|fido|pilot/i.test(q.evidence ?? '')) {
        return validatePasskeyPilot(resolvedId, authPolicy, [
          ...(snapshot.appSignInSummary as { appDisplayName?: string }[]),
          ...(snapshot.spActivity as { appDisplayName?: string }[]),
        ])
      }
      let entry = knownGroups.find((g) => g.groupId === resolvedId) ?? null
      if (!entry) {
        try {
          entry = await getGroupMembers(snapshot.tenantId, resolvedId)
        } catch {
          entry = null
        }
      }
      return validateExclusionGroup(entry, { snapshot, tenantPolicies })
    }
    if (q.group === 'namedLocations') {
      const loc = (snapshot.config.namedLocations?.rows ?? []).find(
        (l) => String((l as { id?: string }).id) === resolvedId,
      )
      return validateTrustedLocation(loc ?? {})
    }
    if (q.group === 'customStrengths') {
      const s = (snapshot.config.authStrengths?.rows ?? []).find(
        (x) => String((x as { id?: string }).id) === resolvedId,
      ) as { allowedCombinations?: string[] } | undefined
      return validateStrength(s ?? null, null)
    }
    return { checkedAt: new Date().toISOString(), passed: true, findings: ['no automated validation for this kind'] }
  }

  // validate() needs the latest records without re-creating callbacks.
  const stateRef = useRef(state)
  stateRef.current = state

  const pick = (q: MappingQuestion, id: string, name: string, provenance: Provenance): void => {
    update((s) => ({
      ...s,
      records: {
        ...s.records,
        [q.key]: {
          placeholder: q.key,
          kind: q.reference.kind,
          group: q.group,
          resolvedId: id,
          resolvedName: name,
          provenance,
          doesNotExist: false,
          validation: null,
        },
      },
    }))
    void validate(q, id).then((validation) =>
      update((s) => {
        const r = s.records[q.key]
        return r ? { ...s, records: { ...s.records, [q.key]: { ...r, validation } } } : s
      }),
    )
  }

  const markMissing = (q: MappingQuestion): void => {
    update((s) => ({
      ...s,
      records: {
        ...s.records,
        [q.key]: {
          placeholder: q.key,
          kind: q.reference.kind,
          group: q.group,
          resolvedId: null,
          resolvedName: null,
          provenance: 'confirmed',
          doesNotExist: true,
          validation: null,
        },
      },
    }))
  }

  const needs = [
    { met: baseline !== null, text: baseline !== null ? 'baseline loaded' : 'load a baseline', href: '#/baseline' },
    { met: scan !== null, text: scan !== null ? 'scan complete' : 'run a scan', href: '#/scan' },
  ]

  if (!baseline || !snapshot || !state) {
    return (
      <StepFrame title="Mapping" does="Matches every tenant-specific reference in the baseline to your tenant, with validation of each pick." needs={needs}>
        <div className="card">
          <p>
            Mapping needs a loaded baseline and a scan.{' '}
            {!baseline && <a href="#/baseline">Load a baseline</a>}
            {!baseline && !scan && ' and '}
            {!scan && <a href="#/scan">run a scan</a>}.
          </p>
        </div>
      </StepFrame>
    )
  }

  const facets = detectFacets(snapshot, state.facetOverrides as Partial<Record<Facet, { on: boolean; reason: string }>>)
  const variantSets = baseline.pkg.variantSets.filter((v) => v.relation === 'variant')
  const groupsInOrder = [...new Set(questions.map((q) => q.group))]

  return (
    <StepFrame
      title="Mapping"
      does="Matches every tenant-specific reference in the baseline to your tenant, with validation of each pick."
      needs={needs}
      next="coverage"
      nextLabel="Coverage"
    >
      <p className="notice">
        <strong>
          {progress.answered} of {progress.total} mapped
        </strong>
        {progress.complete ? ' — every reference is confirmed.' : ' — unanswered references stay "assumed" in Coverage.'}
      </p>

      {groupsInOrder.map((group) => (
        <div key={group} className="tile-group">
          <h4>{GROUP_TITLE[group]}</h4>
          {questions
            .filter((q) => q.group === group)
            .map((q) => (
              <QuestionCard
                key={q.key}
                q={q}
                state={state}
                suggestCtx={suggestCtx}
                snapshot={snapshot}
                onPick={pick}
                onMissing={markMissing}
              />
            ))}
        </div>
      ))}

      {variantSets.length > 0 && (
        <div className="tile-group">
          <h4>Choices — same intent, different styles</h4>
          {variantSets.map((v) => (
            <div key={v.intentKey} className="card">
              <p>Choose one of these baseline policies (they deliver the same outcome):</p>
              {v.policyNames.map((name) => (
                <label key={name} style={{ display: 'block' }}>
                  <input
                    type="radio"
                    name={`variant-${v.intentKey}`}
                    checked={state.variantChoices[v.intentKey] === name}
                    onChange={() => update((s) => ({ ...s, variantChoices: { ...s.variantChoices, [v.intentKey]: name } }))}
                  />{' '}
                  {name}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="tile-group">
        <h4>Applicability</h4>
        {(Object.entries(facets) as [Facet, (typeof facets)[Facet]][]).map(([facet, f]) => (
          <div key={facet} className="card">
            <strong>{facet}</strong> — {f.on ? 'on' : 'off'} ({f.reason}
            {f.source === 'override' ? ', overridden' : ', auto-detected'})
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={f.on}
                  onChange={(e) => {
                    const on = e.currentTarget.checked
                    update((s) => ({
                      ...s,
                      facetOverrides: { ...s.facetOverrides, [facet]: { on, reason: on ? 'enabled by operator' : '' } },
                    }))
                  }}
                />{' '}
                applies to this tenant
              </label>
              {state.facetOverrides[facet] && !state.facetOverrides[facet].on && (
                <input
                  type="text"
                  placeholder="Why doesn't this apply? (required)"
                  value={state.facetOverrides[facet].reason}
                  onChange={(e) => {
                    const reason = e.currentTarget.value
                    update((s) => ({ ...s, facetOverrides: { ...s.facetOverrides, [facet]: { on: false, reason } } }))
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="tile-group">
        <h4>Target state — what the plan includes</h4>
        <div className="card">
          {baseline.pkg.policies.map((p) => {
            const name = p.displayName
            const t = state.targetState[name] ?? { include: true, reason: null }
            return (
              <div key={name}>
                <label>
                  <input
                    type="checkbox"
                    checked={t.include}
                    onChange={(e) => {
                      const include = e.currentTarget.checked
                      update((s) => ({
                        ...s,
                        targetState: { ...s.targetState, [name]: { include, reason: include ? null : t.reason ?? '' } },
                      }))
                    }}
                  />{' '}
                  {name}
                </label>
                {!t.include && (
                  <input
                    type="text"
                    placeholder="Why is this not in scope for this tenant? (required)"
                    value={t.reason ?? ''}
                    onChange={(e) => {
                      const reason = e.currentTarget.value
                      update((s) => ({ ...s, targetState: { ...s.targetState, [name]: { include: false, reason } } }))
                    }}
                  />
                )}
              </div>
            )
          })}
          <p className="reason">
            Turning a policy off marks it "not in scope for this tenant" in Coverage and Roadmap —
            never as risk accepted.
          </p>
        </div>
      </div>
    </StepFrame>
  )
}

function QuestionCard({
  q,
  state,
  suggestCtx,
  snapshot,
  onPick,
  onMissing,
}: {
  q: MappingQuestion
  state: MappingState
  suggestCtx: SuggestContext | null
  snapshot: TenantSnapshot
  onPick: (q: MappingQuestion, id: string, name: string, provenance: Provenance) => void
  onMissing: (q: MappingQuestion) => void
}) {
  const record = state.records[q.key]
  const suggestions = useMemo(() => (suggestCtx ? suggestFor(q, suggestCtx).slice(0, 3) : []), [q, suggestCtx])

  return (
    <div className="card">
      <p>
        <code>{q.key}</code>{' '}
        {record?.doesNotExist && <span className="chip state-notChallenged">doesn't exist yet — Phase 0 step</span>}
        {record?.resolvedId && (
          <span className="chip state-verified">
            → {record.resolvedName} ({record.provenance})
          </span>
        )}
      </p>
      <p className="reason">
        Used by: {q.usage.map((u) => `${u.policyName} (${u.side})`).join('; ')}
        {q.evidence && <> — {q.evidence}</>}
      </p>
      {suggestions.length > 0 && (
        <p>
          {suggestions.map((s) => (
            <button key={s.id} className="chip" title={s.why} onClick={() => onPick(q, s.id, s.name, 'confirmed')}>
              Suggest: {s.name} ({s.confidence})
            </button>
          ))}
        </p>
      )}
      <Picker q={q} snapshot={snapshot} onPick={(id, name) => onPick(q, id, name, 'overridden')} />
      <p>
        <button onClick={() => onMissing(q)}>Doesn't exist yet — add a Phase 0 step</button>
      </p>
      {record?.validation && (
        <div className={record.validation.passed ? 'notice' : 'notice error'}>
          {record.validation.passed ? 'Validation passed' : 'Validation found problems'}
          <ul className="sections">
            {record.validation.findings.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Picker({
  q,
  snapshot,
  onPick,
}: {
  q: MappingQuestion
  snapshot: TenantSnapshot
  onPick: (id: string, name: string) => void
}) {
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState<{ id: string; displayName: string }[]>([])
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isGroup = q.group === 'globalExclusion' || q.group === 'exclusionGroups' || q.group === 'personaGroups'
  const local: { id: string; name: string }[] = useMemo(() => {
    const ql = query.toLowerCase()
    if (q.group === 'breakGlass') {
      return snapshot.users
        .filter((u) => (u.displayName ?? '').toLowerCase().includes(ql) || (u.userPrincipalName ?? '').toLowerCase().includes(ql))
        .slice(0, 8)
        .map((u) => ({ id: u.id, name: u.displayName ?? u.userPrincipalName ?? u.id }))
    }
    if (q.group === 'namedLocations') {
      return (snapshot.config.namedLocations?.rows ?? [])
        .map((l) => l as { id?: string; displayName?: string })
        .filter((l) => (l.displayName ?? '').toLowerCase().includes(ql))
        .map((l) => ({ id: String(l.id), name: l.displayName ?? String(l.id) }))
    }
    if (q.group === 'customStrengths') {
      return (snapshot.config.authStrengths?.rows ?? [])
        .map((s) => s as { id?: string; displayName?: string })
        .filter((s) => (s.displayName ?? '').toLowerCase().includes(ql))
        .map((s) => ({ id: String(s.id), name: s.displayName ?? String(s.id) }))
    }
    return []
  }, [q.group, query, snapshot])

  useEffect(() => {
    if (!isGroup || query.trim().length < 2) {
      setRemote([])
      return
    }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      void searchGroups(query).then(setRemote).catch(() => setRemote([]))
    }, 350)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [query, isGroup])

  const options = isGroup ? remote.map((g) => ({ id: g.id, name: g.displayName })) : local

  if (q.group === 'servicePrincipals' || q.group === 'placeholders') {
    return (
      <p>
        <input
          type="text"
          placeholder="Object or app id in your tenant…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />{' '}
        <button disabled={query.trim().length < 8} onClick={() => onPick(query.trim(), query.trim())}>
          Use this id
        </button>
      </p>
    )
  }

  return (
    <div>
      <input
        type="search"
        placeholder={isGroup ? 'Search tenant groups…' : 'Search…'}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
      />
      {query.length > 0 && options.length > 0 && (
        <p>
          {options.map((o) => (
            <button key={o.id} className="chip" onClick={() => onPick(o.id, o.name)}>
              {o.name}
            </button>
          ))}
        </p>
      )}
    </div>
  )
}
