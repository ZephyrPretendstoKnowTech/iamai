// Setup — the 5–9 questions a human actually answers (2026-08-27 redesign,
// polished in prompt 11). Everything else the baseline references is
// auto-resolved in wizard.ts.
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
import { activeWizardQuestions, applyAutoResolution, applyWizardAnswers, wizardProgress } from '../../mapping/wizard.ts'
import type { WizardProgress, WizardQuestionDef, WizardQuestionId } from '../../mapping/wizard.ts'
import { suggestForWizard } from '../../mapping/wizardSuggest.ts'
import type { WizardSuggestContext } from '../../mapping/wizardSuggest.ts'
import { COMMON_TIMEZONES, FRAMEWORK_OPTIONS, SETUP_PAGE as C } from '../../copy/setup.ts'
import { setDisplayTimeZone } from '../format.ts'
import { Button, Callout, Card, Chip, Icon, Picker, Toggle } from '../components/index.ts'
import type { IconName, PickerOption } from '../components/index.ts'
import { StepFrame } from '../shell/AppShell.tsx'
import type { BaselineResult } from './BaselinePage.tsx'

export function MappingPage({
  scan,
  baseline,
  onProgress,
}: {
  scan: { snapshot: TenantSnapshot; at: string } | null
  baseline: BaselineResult | null
  onProgress: (p: WizardProgress) => void
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
      const users = (raw as { conditions?: { users?: { includeGroups?: string[]; excludeGroups?: string[] } } }).conditions?.users
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

  const progress = useMemo<WizardProgress>(
    () => (state ? wizardProgress(state) : { answered: 0, total: 0, complete: false, requiredMissing: 0 }),
    [state],
  )
  const [openFindings, setOpenFindings] = useState<Record<string, number>>({})
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

  const answered = (id: string): void => update((s) => ({ ...s, wizardAnswered: { ...s.wizardAnswered, [id]: true } }))

  const questions = useMemo(() => activeWizardQuestions(baseline?.pkg ?? null), [baseline])
  const suggestCtx: WizardSuggestContext | null = useMemo(
    () => (snapshot ? { snapshot, tenantPolicies: snapshot.config.caPolicies?.rows ?? [], knownGroups } : null),
    [snapshot, knownGroups],
  )

  const needs = [
    { met: baseline !== null, text: baseline !== null ? C.needsBaseline : C.needBaseline, href: '#/baseline' },
    { met: scan !== null, text: scan !== null ? C.needsScan : C.needScan, href: '#/scan' },
  ]

  if (!baseline || !snapshot || !state || !suggestCtx) {
    return (
      <StepFrame title={C.title} does={C.does} needs={needs}>
        <Card>
          <p>
            {C.blocked} {!baseline && <a href="#/baseline">{C.loadBaseline}</a>}
            {!baseline && !scan && ' and '}
            {!scan && <a href="#/scan">{C.runScan}</a>}.
          </p>
        </Card>
      </StepFrame>
    )
  }

  const autoCount = Object.values(state.records).filter((r) => r.resolvedId !== null || r.doesNotExist).length
  const requiredLeft = questions.filter((q) => q.required && state.wizardAnswered[q.id] !== true)

  return (
    <StepFrame title={C.title} does={C.does} needs={needs} next="coverage" nextLabel={C.next}>
      <Callout kind={progress.complete ? 'success' : 'info'} title={C.progress(progress.answered, questions.length, requiredLeft.length)}>
        {requiredLeft.length > 0 ? C.requiredList(requiredLeft.map((q) => q.title)) : C.complete}
        {autoCount > 0 && <span className="reason"> {C.autoResolved(autoCount)}</span>}
      </Callout>

      {questions.map((q, i) => (
        <QuestionSection
          key={q.id}
          index={i + 1}
          def={q}
          state={state}
          snapshot={snapshot}
          baseline={baseline}
          knownGroups={knownGroups}
          suggestCtx={suggestCtx}
          update={update}
          answered={answered}
          openFindings={openFindings[q.id] ?? 0}
          reportFindings={(n) => setOpenFindings((prev) => (prev[q.id] === n ? prev : { ...prev, [q.id]: n }))}
        />
      ))}
    </StepFrame>
  )
}

// ---------- question sections ----------

type QProps = {
  index: number
  def: WizardQuestionDef
  state: MappingState
  snapshot: TenantSnapshot
  baseline: BaselineResult
  knownGroups: GroupMembersCacheEntry[]
  suggestCtx: WizardSuggestContext
  update: (mut: (s: MappingState) => MappingState) => void
  answered: (id: string) => void
  openFindings: number
  reportFindings: (n: number) => void
}

// Sections stay open after an answer (prompt 13 §4); the header carries the
// status chip and, when there are findings to fix, an "N to fix" chip.
function QuestionSection(props: QProps) {
  const { def, state, index, openFindings } = props
  const done = state.wizardAnswered[def.id] === true
  return (
    <details className="card setup-question" id={`q-${index}`} open>
      <summary>
        <span className="row" style={{ justifyContent: 'space-between' }}>
          <span>
            <span className="muted">{C.questionNumber(index)} · </span>
            <strong>{def.question}</strong>
          </span>
          <span className="row">
            {openFindings > 0 && <Chip status="warning">{C.toFix(openFindings)}</Chip>}
            <Chip status={done ? 'done' : def.required ? 'warning' : 'neutral'}>{done ? C.answered : def.required ? C.required : C.optional}</Chip>
          </span>
        </span>
      </summary>
      <p className="reason">{def.help}</p>
      <QuestionBody {...props} />
    </details>
  )
}

function QuestionBody(props: QProps) {
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

function suggestions(id: WizardQuestionId, ctx: WizardSuggestContext): PickerOption[] {
  return suggestForWizard(id, ctx).map((s) => ({ id: s.id, name: s.name, secondary: s.secondary, why: s.why }))
}

function UserMultiPicker({
  questionId,
  snapshot,
  suggestCtx,
  selected,
  onChange,
  placeholder,
}: {
  questionId: WizardQuestionId
  snapshot: TenantSnapshot
  suggestCtx: WizardSuggestContext
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const suggested = useMemo(() => suggestions(questionId, suggestCtx), [questionId, suggestCtx])
  const whyById = useMemo(() => new Map(suggested.map((s) => [s.id, s.why])), [suggested])
  const toOption = (u: TenantSnapshot['users'][number]): PickerOption => ({
    id: u.id,
    name: u.displayName ?? u.userPrincipalName ?? u.id,
    secondary: u.userPrincipalName ?? undefined,
    why: whyById.get(u.id),
  })
  const options = useMemo(() => {
    const q = query.toLowerCase()
    return snapshot.users
      .filter((u) => (u.displayName ?? '').toLowerCase().includes(q) || (u.userPrincipalName ?? '').toLowerCase().includes(q))
      .slice(0, 8)
      .map(toOption)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, query, whyById])
  const selectedOptions = selected.map((id) => {
    const u = snapshot.users.find((x) => x.id === id)
    return u ? toOption(u) : { id, name: id }
  })
  return (
    <Picker
      selected={selectedOptions}
      options={options}
      suggestions={suggested}
      onSearch={setQuery}
      onChange={(next) => onChange(next.map((o) => o.id))}
      placeholder={placeholder}
    />
  )
}

function GroupPicker({
  questionId,
  suggestCtx,
  selected,
  selectedName,
  knownGroups,
  onPick,
  onClear,
}: {
  questionId: WizardQuestionId
  suggestCtx: WizardSuggestContext
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
  const suggested = useMemo(() => suggestions(questionId, suggestCtx), [questionId, suggestCtx])
  const whyById = new Map(suggested.map((s) => [s.id, s.why]))
  const toOption = (g: GroupMembersCacheEntry): PickerOption => ({
    id: g.groupId,
    name: g.displayName ?? g.groupId,
    secondary: C.members(g.memberCount),
    badge: C.usedInPolicy,
    why: whyById.get(g.groupId),
  })
  const local = knownGroups.filter((g) => g.displayName !== null && g.displayName.toLowerCase().includes(query.toLowerCase())).map(toOption)
  const options: PickerOption[] = [...local, ...remote.filter((r) => !local.some((l) => l.id === r.id)).map((r) => ({ id: r.id, name: r.displayName }))]
  return (
    <Picker
      single
      selected={selected !== null ? [{ id: selected, name: selectedName ?? selected }] : []}
      options={options}
      suggestions={suggested}
      onSearch={setQuery}
      onChange={(next) => {
        const o = next[next.length - 1]
        if (!o) onClear()
        else onPick(o.id, o.name)
      }}
      placeholder={C.searchGroups}
    />
  )
}

function ValidationView({ v, name }: { v: ValidationResult | null; name?: string }) {
  if (!v) return null
  return (
    <Callout kind={v.passed ? 'success' : 'warning'} title={`${name ? `${name}: ` : ''}${v.passed ? C.checksPassed : C.needsAttention}`}>
      <ul className="sections">
        {v.findings.map((f, i) => {
          const a = v.actions?.[i] ?? null
          return (
            <li key={i}>
              {f}
              {a && (
                <>
                  {' — '}
                  <a href={a.href} target={a.href.startsWith('#') ? undefined : '_blank'} rel="noreferrer">
                    {a.label}
                  </a>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </Callout>
  )
}

function toFixCount(results: (ValidationResult | null)[]): number {
  return results.reduce((n, r) => n + (r?.toFix ?? 0), 0)
}

function DoesNotExist({ onClick }: { onClick: () => void }) {
  return (
    <p>
      <Button size="sm" variant="quiet" onClick={onClick}>
        {C.doesNotExist}
      </Button>
    </p>
  )
}

function BreakGlassQuestion({ state, snapshot, knownGroups, suggestCtx, update, answered, reportFindings }: QProps) {
  const [validations, setValidations] = useState<Record<string, ValidationResult>>({})
  useEffect(() => reportFindings(toFixCount(Object.values(validations))), [validations, reportFindings])
  const runValidation = (ids: string[]): void => {
    const tenantPolicies = snapshot.config.caPolicies?.rows ?? []
    const out: Record<string, ValidationResult> = {}
    for (const id of ids) {
      out[id] = validateBreakGlass(id, { snapshot, tenantPolicies, groupMembers: knownGroups, confirmedBreakGlassIds: ids })
    }
    setValidations(out)
  }
  useEffect(() => {
    if (state.breakGlassUserIds.length > 0) runValidation(state.breakGlassUserIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div>
      <UserMultiPicker
        questionId="breakGlass"
        snapshot={snapshot}
        suggestCtx={suggestCtx}
        selected={state.breakGlassUserIds}
        placeholder={C.searchUsers}
        onChange={(ids) => {
          update((s) => ({ ...s, breakGlassUserIds: ids }))
          runValidation(ids)
          if (ids.length > 0) answered('breakGlass')
        }}
      />
      {state.breakGlassUserIds.map((id) => (
        <ValidationView key={id} name={snapshot.users.find((u) => u.id === id)?.displayName ?? id} v={validations[id] ?? null} />
      ))}
      <DoesNotExist
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
      />
    </div>
  )
}

function GlobalExclusionQuestion({ state, snapshot, knownGroups, suggestCtx, update, answered, reportFindings }: QProps) {
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  useEffect(() => reportFindings(toFixCount([validation])), [validation, reportFindings])
  const rec = state.records['__globalExclusion']
  const validate = (id: string): void => {
    const entry = knownGroups.find((g) => g.groupId === id) ?? null
    const ctx = { snapshot, tenantPolicies: snapshot.config.caPolicies?.rows ?? [] }
    if (entry) setValidation(validateExclusionGroup(entry, ctx))
    else void getGroupMembers(snapshot.tenantId, id).then((g) => setValidation(validateExclusionGroup(g, ctx))).catch(() => setValidation(null))
  }
  useEffect(() => {
    if (rec?.resolvedId) validate(rec.resolvedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div>
      <GroupPicker
        questionId="globalExclusion"
        suggestCtx={suggestCtx}
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
              __globalExclusion: { placeholder: '__globalExclusion', kind: 'group', group: 'globalExclusion', resolvedId: id, resolvedName: name, provenance: 'confirmed', doesNotExist: false, validation: null },
            },
          }))
          answered('globalExclusion')
          validate(id)
        }}
      />
      <ValidationView v={validation} />
      <DoesNotExist
        onClick={() => {
          update((s) => ({
            ...s,
            records: {
              ...s.records,
              __globalExclusion: { placeholder: '__globalExclusion', kind: 'group', group: 'globalExclusion', resolvedId: null, resolvedName: null, provenance: 'confirmed', doesNotExist: true, validation: null },
            },
          }))
          answered('globalExclusion')
        }}
      />
    </div>
  )
}

function HighCareQuestion({ state, snapshot, suggestCtx, update, answered }: QProps) {
  return (
    <div>
      <UserMultiPicker
        questionId="highCare"
        snapshot={snapshot}
        suggestCtx={suggestCtx}
        selected={state.highCareUserIds}
        placeholder={C.searchVips}
        onChange={(ids) => {
          update((s) => ({ ...s, highCareUserIds: ids }))
          answered('highCare')
        }}
      />
      {state.highCareUserIds.length > 0 && <p className="reason">{C.careExplained(state.highCareUserIds.length)}</p>}
      <p>
        <Button size="sm" variant="quiet" onClick={() => answered('highCare')}>
          {C.nobodyNeedsCare}
        </Button>
      </p>
    </div>
  )
}

function TrustedLocationsQuestion({ state, snapshot, suggestCtx, update, answered, reportFindings }: QProps) {
  const locations = (snapshot.config.namedLocations?.rows ?? []) as { id?: string; displayName?: string; isTrusted?: boolean }[]
  const locValidations = state.trustedLocationIds.map((id) => {
    const loc = locations.find((l) => String(l.id) === id)
    return loc ? validateTrustedLocation(loc) : null
  })
  const toFix = toFixCount(locValidations)
  useEffect(() => reportFindings(toFix), [toFix, reportFindings])
  const suggested = useMemo(() => suggestions('trustedLocations', suggestCtx), [suggestCtx])
  const whyById = new Map(suggested.map((s) => [s.id, s.why]))
  const options: PickerOption[] = locations.map((l) => ({
    id: String(l.id ?? ''),
    name: l.displayName ?? String(l.id ?? ''),
    secondary: l.isTrusted ? C.markedTrusted : C.notMarkedTrusted,
    why: whyById.get(String(l.id ?? '')),
  }))
  const selected = options.filter((o) => state.trustedLocationIds.includes(o.id))
  return (
    <div>
      {locations.length === 0 && <p className="reason">{C.noNamedLocations}</p>}
      <Picker
        selected={selected}
        options={options}
        suggestions={suggested}
        onChange={(next) => {
          update((s) => ({ ...s, trustedLocationIds: next.map((o) => o.id) }))
          answered('trustedLocations')
        }}
        placeholder={C.searchLocations}
      />
      {state.trustedLocationIds.map((id) => {
        const loc = locations.find((l) => String(l.id) === id)
        return <ValidationView key={id} name={loc?.displayName ?? id} v={loc ? validateTrustedLocation(loc) : null} />
      })}
      <DoesNotExist
        onClick={() => {
          update((s) => ({ ...s, trustedLocationIds: [] }))
          answered('trustedLocations')
        }}
      />
    </div>
  )
}

function ServiceAccountsQuestion({ state, knownGroups, suggestCtx, update, answered }: QProps) {
  return (
    <div>
      <GroupPicker
        questionId="serviceAccounts"
        suggestCtx={suggestCtx}
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
        <Button
          size="sm"
          variant="quiet"
          onClick={() => {
            update((s) => ({ ...s, serviceAccountsGroupId: null }))
            answered('serviceAccounts')
          }}
        >
          {C.notApplicable}
        </Button>
      </p>
    </div>
  )
}

function VariantsQuestion({ state, baseline, update, answered }: QProps) {
  const sets = baseline.pkg.variantSets.filter((v) => v.relation === 'variant')
  const chosenAll = sets.every((v) => state.variantChoices[v.intentKey] !== undefined)
  useEffect(() => {
    if (sets.length > 0 && chosenAll && state.wizardAnswered.variants !== true) answered('variants')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenAll])
  return (
    <div className="grid-cards">
      {sets.map((v) => (
        <Card key={v.intentKey}>
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
        </Card>
      ))}
    </div>
  )
}

function TimeZoneQuestion({ state, update, answered }: QProps) {
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
            {z === browser ? C.browserZone(z) : z}
          </option>
        ))}
      </select>
    </p>
  )
}

function FrameworksQuestion({ state, update, answered }: QProps) {
  const noneChosen = state.wizardAnswered.frameworks === true && state.frameworks.length === 0
  return (
    <div className="row">
      {FRAMEWORK_OPTIONS.map((f) => {
        const on = state.frameworks.includes(f)
        return (
          <Button
            key={f}
            size="sm"
            variant={on ? 'primary' : 'secondary'}
            onClick={() => {
              update((s) => ({ ...s, frameworks: on ? s.frameworks.filter((x) => x !== f) : [...s.frameworks, f] }))
              answered('frameworks')
            }}
          >
            {f}
          </Button>
        )
      })}
      <Button
        size="sm"
        variant={noneChosen ? 'primary' : 'secondary'}
        onClick={() => {
          update((s) => ({ ...s, frameworks: [] }))
          answered('frameworks')
        }}
      >
        {C.frameworkNone}
      </Button>
    </div>
  )
}

const FACET_ICON: Record<string, IconName> = {
  avd: 'device',
  copilot: 'chart',
  azureDevOps: 'policy',
  intune: 'device',
  sharepoint: 'policy',
  workload: 'key',
  agents: 'users',
  azureManagement: 'shield',
}

function ApplicabilityQuestion({ state, snapshot, update, answered }: QProps) {
  const facets = detectFacets(snapshot, state.facetOverrides as Partial<Record<Facet, { on: boolean; reason: string }>>)
  const R = C.workloadReason
  const reasonText = (facet: string, f: { on: boolean; reason: string; source: string }): string => {
    if (f.source === 'override') return `${f.reason} ${C.yourAnswer}`
    if (facet === 'intune') return f.on ? R.licence('Intune') : R.noLicence('Intune')
    if (facet === 'workload') return f.on ? R.licence('Workload Identities Premium') : R.noLicence('Workload Identities Premium')
    return f.on ? R.seen : R.notSeen
  }
  return (
    <div>
      <div className="grid-cards">
        {(Object.entries(facets) as [Facet, (typeof facets)[Facet]][]).map(([facet, f]) => (
          <Card key={facet} className="workload-card">
            <Icon name={FACET_ICON[facet] ?? 'policy'} size={24} />
            <div className="grow">
              <strong>{C.workloadNames[facet] ?? facet}</strong>
              <div className="sub">{C.workloadEvidence(C.workloadNames[facet] ?? facet, reasonText(facet, f))}</div>
            </div>
            <Toggle
              on={f.on}
              label={C.workloadNames[facet] ?? facet}
              onChange={(on) => {
                update((s) => ({
                  ...s,
                  facetOverrides: { ...s.facetOverrides, [facet]: { on, reason: on ? C.confirmedByOperator : C.notUsed } },
                }))
                answered('applicability')
              }}
            />
          </Card>
        ))}
      </div>
      <p>
        <Button variant="primary" onClick={() => answered('applicability')}>
          {C.detectionsRight}
        </Button>
      </p>
    </div>
  )
}
