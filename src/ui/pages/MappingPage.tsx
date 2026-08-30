// Setup: the questions a human actually answers (2026-08-27 redesign,
// restructured in prompt 16: required first, optional under Advanced
// options, answered questions collapse to a one-line summary). Everything
// else the baseline references is auto-resolved in wizard.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { getGroupMembers, searchGroups } from '../../graph/collect/onDemand.ts'
import type { GroupMembersCacheEntry } from '../../graph/collect/cache.ts'
import { detectFacets } from '../../coverage/applicability.ts'
import type { Facet } from '../../coverage/applicability.ts'
import { loadMappingState, saveMappingState } from '../../mapping/store.ts'
import { breakGlassFindings, exclusionGroupFindings, trustedLocationFindings } from '../../validation/report.ts'
import type { MappingState, ValidationResult } from '../../mapping/types.ts'
import { activeWizardQuestions, applyAutoResolution, applyWizardAnswers, wizardProgress } from '../../mapping/wizard.ts'
import type { WizardProgress, WizardQuestionDef, WizardQuestionId } from '../../mapping/wizard.ts'
import { schemaFor } from '../../mapping/questionSchema.ts'
import { suggestForWizard } from '../../mapping/wizardSuggest.ts'
import type { WizardSuggestContext } from '../../mapping/wizardSuggest.ts'
import { detectServiceAccounts } from '../../mapping/serviceAccounts.ts'
import { countryName, suggestCountries, tenantCountryLocation } from '../../mapping/countries.ts'
import { COMMON_TIMEZONES, FRAMEWORK_OPTIONS, SETUP_PAGE as C, SETUP_QUESTIONS } from '../../copy/setup.ts'
import { setDisplayTimeZone } from '../format.ts'
import { Button, Callout, Card, Chip, Confirm, Icon, InfoTip, Picker, Toast, Toggle, useToast } from '../components/index.ts'
import type { IconName, PickerOption } from '../components/index.ts'
import { ScanAge, StepFrame } from '../shell/AppShell.tsx'
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
  const [toast, notify] = useToast()
  const snapshot = scan?.snapshot ?? null
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

  const questions = useMemo(() => activeWizardQuestions(baseline?.pkg ?? null, { snapshot, state }), [baseline, snapshot, state])
  const progress = useMemo<WizardProgress>(
    () => (state ? wizardProgress(state, questions) : { answered: 0, total: 0, complete: false, requiredMissing: 0 }),
    [state, questions],
  )
  const [openFindings, setOpenFindings] = useState<Record<string, FindingCounts>>({})
  // Stable callback: children report by question id, so effects do not re-run per render.
  const reportFindings = useCallback((id: string, counts: FindingCounts) => {
    setOpenFindings((prev) =>
      prev[id]?.toFix === counts.toFix && prev[id]?.recommended === counts.recommended && prev[id]?.notes === counts.notes ? prev : { ...prev, [id]: counts },
    )
  }, [])
  useEffect(() => onProgress(progress), [progress, onProgress])
  useEffect(() => {
    if (state?.displayTimeZone) setDisplayTimeZone(state.displayTimeZone)
  }, [state?.displayTimeZone])

  // Pure updater; persistence happens once per committed state below (never
  // inside the updater, which StrictMode runs twice).
  const [dirty, setDirty] = useState(false)
  const update = (mut: (s: MappingState) => MappingState): void => {
    setState((prev) => {
      if (!prev || !baseline || !snapshot) return prev
      let next = mut(prev)
      next = applyWizardAnswers(next, baseline.pkg, snapshot)
      next = applyAutoResolution(next, baseline.pkg, snapshot).state
      return next
    })
    setDirty(true)
  }
  useEffect(() => {
    if (!dirty || !state) return
    setDirty(false)
    void saveMappingState(state)
  }, [dirty, state])

  // Which answered questions are open for editing (collapsed otherwise).
  const [editing, setEditing] = useState<Record<string, boolean>>({})
  const answered = (id: WizardQuestionId): void => {
    update((s) => ({ ...s, wizardAnswered: { ...s.wizardAnswered, [id]: true } }))
    setEditing((e) => ({ ...e, [id]: false }))
    const title = questions.find((q) => q.id === id)?.title ?? id
    notify(C.toast(title))
  }
  const reopen = (id: WizardQuestionId): void => {
    update((s) => {
      return { ...s, wizardAnswered: { ...s.wizardAnswered, [id]: false } }
    })
    setEditing((e) => ({ ...e, [id]: true }))
  }
  const suggestCtx: WizardSuggestContext | null = useMemo(
    () => (snapshot ? { snapshot, tenantPolicies: snapshot.config.caPolicies?.rows ?? [], knownGroups, breakGlassUserIds: state?.breakGlassUserIds ?? [] } : null),
    [snapshot, knownGroups, state?.breakGlassUserIds],
  )

  const needs = [
    { met: baseline !== null, text: baseline !== null ? C.needsBaseline : C.needBaseline, href: '#/baseline' },
    { met: scan !== null, text: scan !== null ? C.needsScan : C.needScan, href: '#/scan' },
  ]

  if (!baseline || !snapshot || !state || !suggestCtx) {
    const loading = baseline !== null && snapshot !== null
    return (
      <StepFrame title={C.title} does={C.does} needs={needs}>
        <Card>
          {loading ? (
            <p className="reason">{C.loading}</p>
          ) : (
            <p>
              {C.blocked} {!baseline && <a href="#/baseline">{C.loadBaseline}</a>}
              {!baseline && !scan && ' and '}
              {!scan && <a href="#/scan">{C.runScan}</a>}.
            </p>
          )}
        </Card>
      </StepFrame>
    )
  }

  const autoCount = Object.values(state.records).filter((r) => r.resolvedId !== null || r.doesNotExist).length
  const requiredLeft = questions.filter((q) => q.required && state.wizardAnswered[q.id] !== true)
  const section = (q: WizardQuestionDef) => (
    <QuestionSection
      key={q.id}
      index={questions.indexOf(q) + 1}
      def={q}
      state={state}
      snapshot={snapshot}
      baseline={baseline}
      knownGroups={knownGroups}
      suggestCtx={suggestCtx}
      update={update}
      answered={answered}
      reopen={reopen}
      editing={editing[q.id] === true}
      openFindings={openFindings[q.id] ?? { toFix: 0, recommended: 0, notes: 0 }}
      reportFindings={reportFindings}
    />
  )

  return (
    <StepFrame title={C.title} does={C.does} needs={needs} next="coverage" nextLabel={C.next}>
      {scan && <ScanAge at={scan.at} />}
      {/* C6: the banner said four things at once — what is left, two questions
          that were not asked, and what was resolved without asking. It says the
          first, which is the one the reader is here for; the rest are notes
          under it, where a note belongs. */}
      <Callout kind={progress.complete ? 'success' : 'info'} title={C.progress(progress.answered, questions.length, requiredLeft.length)}>
        {requiredLeft.length > 0 ? C.requiredOpen(requiredLeft.map((q) => q.title)) : C.allRequiredDone}
      </Callout>
      <p className="reason">
        {!questions.some((q) => q.id === 'serviceAccounts') && <span> {C.noServiceAccounts}</span>}
        {!questions.some((q) => q.id === 'trustedLocations') && <span> {C.noTrustedLocations}</span>}
        {autoCount > 0 && (
          <span>
            {' '}
            {C.autoResolved(autoCount)}
            <InfoTip title={C.referenceTip.title} text={C.referenceTip.text} />
          </span>
        )}
      </p>

      {questions.map(section)}
      <Toast message={toast} />
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
  answered: (id: WizardQuestionId) => void
  reopen: (id: WizardQuestionId) => void
  editing: boolean
  openFindings: FindingCounts
  reportFindings: (id: string, counts: FindingCounts) => void
}

/** One line that says what was answered, for the collapsed state. */
function answerSummary(def: WizardQuestionDef, state: MappingState, snapshot: TenantSnapshot, knownGroups: GroupMembersCacheEntry[]): string {
  const userName = (id: string) => snapshot.users.find((u) => u.id === id)?.displayName ?? id
  const groupName = (id: string) => knownGroups.find((g) => g.groupId === id)?.displayName ?? id
  switch (def.id) {
    case 'breakGlass':
      return state.breakGlassUserIds.length > 0 ? state.breakGlassUserIds.map(userName).join(', ') : C.doesNotExist
    case 'globalExclusion': {
      const r = state.records['__globalExclusion']
      if (!r?.resolvedId) return C.doesNotExist
      const g = knownGroups.find((x) => x.groupId === r.resolvedId)
      return `${r.resolvedName ?? groupName(r.resolvedId)}${g ? ` · ${C.members(g.memberCount)}` : ''}`
    }
    case 'countries':
      return state.allowedCountries.length > 0 ? state.allowedCountries.map(countryName).join(', ') : C.noneChosen
    case 'highCare':
      return state.highCareUserIds.length > 0 ? state.highCareUserIds.map(userName).join(', ') : C.nobody
    case 'trustedLocations': {
      const locs = (snapshot.config.namedLocations?.rows ?? []) as { id?: string; displayName?: string }[]
      return state.trustedLocationIds.length > 0
        ? state.trustedLocationIds.map((id) => locs.find((l) => String(l.id) === id)?.displayName ?? id).join(', ')
        : C.doesNotExist
    }
    case 'serviceAccounts':
      return state.serviceAccountUserIds.length > 0 ? state.serviceAccountUserIds.map(userName).join(', ') : C.noneChosen
    case 'timeZone':
      return state.displayTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    case 'frameworks':
      return state.frameworks.length > 0 ? state.frameworks.join(', ') : C.noneChosen
    case 'applicability': {
      const on = Object.entries(detectFacets(snapshot, state.facetOverrides as never))
        .filter(([, f]) => f.on)
        .map(([k]) => C.workloadNames[k] ?? k)
      return on.length > 0 ? on.join(', ') : C.noneChosen
    }
  }
}

// An answered question collapses to "Answered: <choice>" with an Edit link;
// the header keeps the status chip and, when there are findings, "N to fix".
function QuestionSection(props: QProps) {
  const { def, state, index, openFindings, editing, snapshot, knownGroups, reopen } = props
  const done = state.wizardAnswered[def.id] === true
  const collapsed = done && !editing
  return (
    <details className="card setup-question" id={`q-${index}`} open>
      <summary>
        <span className="row" style={{ justifyContent: 'space-between' }}>
          <span>
            <span className="muted">{C.questionNumber(index)} · </span>
            <strong>{def.question}</strong>
            <InfoTip title={C.explain} text={def.help} />
          </span>
          <span className="row">
            {openFindings.toFix > 0 && <Chip status="blocked">{C.mustFix(openFindings.toFix)}</Chip>}
            {openFindings.recommended > 0 && <Chip status="warning">{C.recommendedCount(openFindings.recommended)}</Chip>}
            {openFindings.toFix === 0 && openFindings.recommended === 0 && openFindings.notes > 0 && done && <Chip status="done">{C.notesCount(openFindings.notes)}</Chip>}
            {openFindings.toFix === 0 && openFindings.recommended === 0 && openFindings.notes === 0 && done && (def.id === 'breakGlass' || def.id === 'globalExclusion') && <Chip status="neutral">{C.nothingToCheck}</Chip>}
            <Chip status={done ? 'done' : 'warning'}>{done ? C.answered : C.required}</Chip>
          </span>
        </span>
      </summary>
      {collapsed ? (
        <p className="setup-answered">
          <span className="check">
            <Icon name="check" size={16} />
          </span>
          <span>{C.answeredAs(answerSummary(def, state, snapshot, knownGroups))}</span>
          <Button size="sm" variant="quiet" onClick={() => reopen(def.id)}>
            {C.edit}
          </Button>
        </p>
      ) : (
        <>
          <p className="setup-why">
            <strong>{C.whyMatters}:</strong> {def.why}
          </p>
          <QuestionBody {...props} />
        </>
      )}
      {collapsed && (openFindings.toFix > 0 || openFindings.recommended > 0 || def.id === 'globalExclusion' || def.id === 'breakGlass') && <QuestionFindings {...props} />}
    </details>
  )
}

// Findings stay visible under a collapsed answer so "N to fix" is never hidden.
function QuestionFindings(props: QProps) {
  if (props.def.id === 'breakGlass') return <BreakGlassQuestion {...props} findingsOnly />
  if (props.def.id === 'globalExclusion') return <GlobalExclusionQuestion {...props} findingsOnly />
  return null
}

function QuestionBody(props: QProps) {
  switch (props.def.id) {
    case 'breakGlass':
      return <BreakGlassQuestion {...props} />
    case 'globalExclusion':
      return <GlobalExclusionQuestion {...props} />
    case 'countries':
      return <CountriesQuestion {...props} />
    case 'highCare':
      return <HighCareQuestion {...props} />
    case 'trustedLocations':
      return <TrustedLocationsQuestion {...props} />
    case 'serviceAccounts':
      return <ServiceAccountsQuestion {...props} />
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
    let stale = false
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      void searchGroups(query)
        .then((r) => {
          if (!stale) setRemote(r)
        })
        .catch(() => {
          if (!stale) setRemote([])
        })
    }, 300)
    return () => {
      stale = true
      if (debounce.current) clearTimeout(debounce.current)
    }
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
  const toFix = v.toFix ?? (v.passed ? 0 : v.findings.length)
  const recommended = v.recommended ?? 0
  const items = v.findings.map((f, i) => ({ f, a: v.actions?.[i] ?? null, i }))
  // The registry returns must-fix, then recommended, then notes; the chips
  // count exactly these slices (validation-rules.md §5).
  const fails = items.slice(0, toFix)
  const advised = items.slice(toFix, toFix + recommended)
  const notes = items.slice(toFix + recommended)
  const render = (list: typeof items) => (
    <ul className="sections">
      {list.map(({ f, a, i }) => (
        <li key={i}>
          {f}
          {a && (
            <>
              {': '}
              <a href={a.href} target={a.href.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer">
                {a.label}
              </a>
            </>
          )}
        </li>
      ))}
    </ul>
  )
  const title = `${name ? `${name}: ` : ''}${toFix > 0 ? C.needsAttention : v.findings.length > 0 ? C.checksPassed : C.nothingToCheck}`
  return (
    <Callout kind={toFix > 0 ? 'warning' : 'success'} title={title}>
      {fails.length > 0 && (
        <>
          <p className="reason">{C.mustFixTitle}</p>
          {render(fails)}
        </>
      )}
      {advised.length > 0 && (
        <>
          <p className="reason">{C.recommendedTitle}</p>
          {render(advised)}
        </>
      )}
      {notes.length > 0 && (
        <>
          {(fails.length > 0 || advised.length > 0) && <p className="reason">{C.notesTitle}</p>}
          {render(notes)}
        </>
      )}
    </Callout>
  )
}

export type FindingCounts = { toFix: number; recommended: number; notes: number }

/** What the chips count is exactly what the list shows (validation-rules.md §5). */
function findingCounts(results: (ValidationResult | null)[]): FindingCounts {
  const toFix = results.reduce((n, r) => n + (r?.toFix ?? 0), 0)
  const recommended = results.reduce((n, r) => n + (r?.recommended ?? 0), 0)
  const shown = results.reduce((n, r) => n + (r?.findings.length ?? 0), 0)
  return { toFix, recommended, notes: Math.max(0, shown - toFix - recommended) }
}

/** The third answer every question allows (prompt 26 §2): not applicable to us, with a reason that goes in the plan. */
function DoesNotExist({ onClick }: { onClick: () => void }) {
  return (
    <p>
      <Button size="sm" variant="quiet" onClick={onClick}>
        {C.doesNotExist}
      </Button>
    </p>
  )
}

function BreakGlassQuestion({ state, snapshot, knownGroups, suggestCtx, update, answered, reportFindings, findingsOnly = false }: QProps & { findingsOnly?: boolean }) {
  const [validations, setValidations] = useState<Record<string, ValidationResult>>({})
  useEffect(() => reportFindings('breakGlass', findingCounts(Object.values(validations))), [validations, reportFindings])
  const runValidation = (ids: string[]): void => {
    // Every check comes from the registry (validation-rules.md §1); nothing is
    // decided here.
    setValidations(breakGlassFindings({ snapshot, state: { ...state, breakGlassUserIds: ids }, groupMembers: knownGroups }))
  }
  useEffect(() => {
    if (state.breakGlassUserIds.length > 0) runValidation(state.breakGlassUserIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownGroups, state.breakGlassAnswers?.credentialStorage, state.breakGlassAnswers?.signInMonitoring])
  const answers = state.breakGlassAnswers ?? { credentialStorage: null, signInMonitoring: null }
  // Q1 is answered when the accounts are picked AND both attestations are
  // given, not when the picker changes (prompt 37 §8). Answering on the picker
  // collapsed the question and unmounted the two questions below it before they
  // could be reached, so they stayed null and two validation rules returned
  // unknown, printed as "an answer given in Setup could not be read on this
  // scan" (T10). No answer had been given, and nothing failed to be read.
  const attested = (a: typeof answers): boolean => a.credentialStorage !== null && a.signInMonitoring !== null
  const setAnswer = (key: 'credentialStorage' | 'signInMonitoring', value: boolean): void => {
    const next = { ...(state.breakGlassAnswers ?? { credentialStorage: null, signInMonitoring: null }), [key]: value }
    update((s) => ({ ...s, breakGlassAnswers: next }))
    if (state.breakGlassUserIds.length > 0 && attested(next)) answered('breakGlass')
  }
  const ask = (key: 'credentialStorage' | 'signInMonitoring') => (
    <li key={key}>
      {C.breakGlassAsk[key]}
      <div className="row" style={{ marginTop: '4px' }}>
        <Button size="sm" variant={answers[key] === true ? 'primary' : 'quiet'} onClick={() => setAnswer(key, true)}>
          {C.breakGlassAsk.yes}
        </Button>
        <Button size="sm" variant={answers[key] === false ? 'primary' : 'quiet'} onClick={() => setAnswer(key, false)}>
          {C.breakGlassAsk.no}
        </Button>
      </div>
    </li>
  )
  const findings = state.breakGlassUserIds.map((id) => (
    <ValidationView key={id} name={snapshot.users.find((u) => u.id === id)?.displayName ?? id} v={validations[id] ?? null} />
  ))
  if (findingsOnly) return <div>{findings}</div>
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
          if (ids.length > 0 && attested(answers)) answered('breakGlass')
        }}
      />
      {findings}
      {/* R21: the panel explained why these two are asked before asking them.
          The questions are self-explanatory; ask them. */}
      <ul className="sections">{ask('credentialStorage')}{ask('signInMonitoring')}</ul>
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

function GlobalExclusionQuestion({ state, snapshot, knownGroups, suggestCtx, update, answered, reportFindings, findingsOnly = false }: QProps & { findingsOnly?: boolean }) {
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  useEffect(() => reportFindings('globalExclusion', findingCounts([validation])), [validation, reportFindings])
  const rec = state.records['__globalExclusion']
  const validate = (id: string): void => {
    const entry = knownGroups.find((g) => g.groupId === id) ?? null
    const inputs = { snapshot, state, groupMembers: knownGroups }
    if (entry) setValidation(exclusionGroupFindings(entry, inputs))
    else void getGroupMembers(snapshot.tenantId, id).then((g) => setValidation(exclusionGroupFindings(g, { ...inputs, groupMembers: [...knownGroups, g] }))).catch(() => setValidation(null))
  }
  useEffect(() => {
    if (rec?.resolvedId) validate(rec.resolvedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (findingsOnly) return <ValidationView v={validation} />
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

// Countries (§A4): pre-selected from sign-in records and usage locations; the
// operator adds or removes, then confirms.
function CountriesQuestion({ state, snapshot, update, answered }: QProps) {
  const suggested = useMemo(() => suggestCountries(snapshot), [snapshot])
  const [query, setQuery] = useState('')
  // Pre-select once: the first time the question is seen with nothing chosen.
  useEffect(() => {
    if (state.allowedCountries.length === 0 && state.wizardAnswered.countries !== true && suggested.countries.length > 0) {
      update((s) => ({ ...s, allowedCountries: suggested.countries.map((c) => c.code) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested])
  const chosen = new Set(state.allowedCountries)
  const toggle = (code: string) =>
    update((s) => ({ ...s, allowedCountries: chosen.has(code) ? s.allowedCountries.filter((c) => c !== code) : [...s.allowedCountries, code] }))
  const evidence = (c: { users: number; usageLocationUsers: number }): string =>
    [c.users > 0 ? C.countriesSeen(c.users) : '', c.usageLocationUsers > 0 ? C.countriesUsage(c.usageLocationUsers) : ''].filter(Boolean).join(' · ')
  const extra = state.allowedCountries.filter((code) => !suggested.countries.some((c) => c.code === code))
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return ALL_COUNTRY_CODES.filter((code) => !chosen.has(code) && (code.toLowerCase() === q || countryName(code).toLowerCase().includes(q))).slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, state.allowedCountries])
  const existing = tenantCountryLocation(snapshot, state.allowedCountries)
  return (
    <div>
      {suggested.countries.length === 0 ? (
        <p className="reason">{C.countriesNone}</p>
      ) : (
        !suggested.hasSignInLocations && <p className="reason">{C.countriesNoSignIns}</p>
      )}
      <div className="country-chips">
        {suggested.countries.map((c) => (
          <Button key={c.code} size="sm" variant={chosen.has(c.code) ? 'primary' : 'secondary'} title={evidence(c)} onClick={() => toggle(c.code)}>
            {countryName(c.code)} <span style={{ opacity: 0.75 }}>({c.code})</span>
          </Button>
        ))}
        {extra.map((code) => (
          <Button key={code} size="sm" variant="primary" onClick={() => toggle(code)}>
            {countryName(code)} <span style={{ opacity: 0.75 }}>({code})</span>
          </Button>
        ))}
      </div>
      <ul className="sections">
        {suggested.countries
          .filter((c) => chosen.has(c.code))
          .map((c) => (
            <li key={c.code}>
              {countryName(c.code)}: {evidence(c)}
            </li>
          ))}
      </ul>
      <input type="search" value={query} placeholder={C.addCountry} onChange={(e) => setQuery(e.currentTarget.value)} />
      {matches.length > 0 && (
        <div className="row" style={{ marginTop: '4px' }}>
          {matches.map((code) => (
            <Button
              key={code}
              size="sm"
              onClick={() => {
                toggle(code)
                setQuery('')
              }}
            >
              + {countryName(code)} ({code})
            </Button>
          ))}
        </div>
      )}
      <p className="reason">
        {C.countriesChosen(state.allowedCountries.length)}. {existing ? C.countriesExisting(existing.displayName) : state.allowedCountries.length > 0 ? C.countriesToCreate : ''}
      </p>
      <Confirm onConfirm={() => answered('countries')} />
    </div>
  )
}

const ALL_COUNTRY_CODES: string[] = (() => {
  const codes: string[] = []
  for (let a = 65; a <= 90; a += 1) for (let b = 65; b <= 90; b += 1) codes.push(String.fromCharCode(a) + String.fromCharCode(b))
  // Keep only codes the runtime can name (real regions).
  return codes.filter((c) => countryName(c) !== c)
})()

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
      {/* Choosing nobody and confirming is the same answer the second button
          used to give (R2). One affordance, one label. */}
      <Confirm onConfirm={() => answered('highCare')} />
    </div>
  )
}

function TrustedLocationsQuestion({ state, snapshot, suggestCtx, update, answered, reportFindings }: QProps) {
  const locations = (snapshot.config.namedLocations?.rows ?? []) as { id?: string; displayName?: string; isTrusted?: boolean }[]
  const locValidations = state.trustedLocationIds.map((id) => {
    const loc = locations.find((l) => String(l.id) === id)
    return loc ? trustedLocationFindings(loc, { snapshot, state }) : null
  })
  const counts = findingCounts(locValidations)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => reportFindings('trustedLocations', counts), [counts.toFix, counts.notes, reportFindings])
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
        return <ValidationView key={id} name={loc?.displayName ?? id} v={loc ? trustedLocationFindings(loc, { snapshot, state }) : null} />
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

// Service accounts (§A5): detected candidates with evidence; Confirm / Not a
// service account per row. Confirmed accounts map to a group that already
// holds all of them, else the plan creates one in phase 0.
function ServiceAccountsQuestion({ state, snapshot, knownGroups, update, answered }: QProps) {
  const candidates = useMemo(
    () => detectServiceAccounts(snapshot, [...state.breakGlassUserIds, ...state.serviceAccountRejectedIds]),
    [snapshot, state.breakGlassUserIds, state.serviceAccountRejectedIds],
  )
  const confirmed = new Set(state.serviceAccountUserIds)
  const pending = candidates.filter((c) => !confirmed.has(c.id))
  const resolveGroup = (ids: string[]): string | null => {
    if (ids.length === 0) return null
    const g = knownGroups.find((x) => !x.sampled && x.membershipRule === null && ids.every((id) => x.memberIds.includes(id)))
    return g?.groupId ?? null
  }
  const setConfirmed = (ids: string[]) => update((s) => ({ ...s, serviceAccountUserIds: ids, serviceAccountsGroupId: resolveGroup(ids) }))
  const groupName = state.serviceAccountsGroupId ? (knownGroups.find((g) => g.groupId === state.serviceAccountsGroupId)?.displayName ?? state.serviceAccountsGroupId) : null
  const row = (c: (typeof candidates)[number], isConfirmed: boolean): ReactNode => (
    <div key={c.id} className="candidate-row">
      <div className="grow">
        <strong>{c.name}</strong> {c.upn && <span className="sub">{c.upn}</span>}
        <ul className="sections">
          {c.evidence.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </div>
      <span className="row">
        {isConfirmed ? (
          <Chip status="done">{C.confirmService}</Chip>
        ) : (
          <Button size="sm" variant="primary" onClick={() => setConfirmed([...state.serviceAccountUserIds, c.id])}>
            {C.confirmService}
          </Button>
        )}
        <Button
          size="sm"
          variant="quiet"
          onClick={() =>
            update((s) => {
              const ids = s.serviceAccountUserIds.filter((id) => id !== c.id)
              return { ...s, serviceAccountUserIds: ids, serviceAccountsGroupId: resolveGroup(ids), serviceAccountRejectedIds: [...s.serviceAccountRejectedIds, c.id] }
            })
          }
        >
          {C.notService}
        </Button>
      </span>
    </div>
  )
  return (
    <div>
      <p className="reason">{C.serviceCount(candidates.length)}</p>
      {candidates.map((c) => row(c, confirmed.has(c.id)))}
      {candidates.length === 0 && <p className="reason">{C.serviceNoneLeft}</p>}
      {state.serviceAccountUserIds.length > 0 && (
        <p className="reason">
          {C.serviceConfirmed(state.serviceAccountUserIds.length)}. {groupName ? C.serviceGroupFound(groupName) : C.serviceGroupMissing}
        </p>
      )}
      <Confirm onConfirm={() => answered('serviceAccounts')} title={pending.length > 0 ? C.serviceCount(pending.length) : undefined} />
    </div>
  )
}

function TimeZoneQuestion({ state, update, answered }: QProps) {
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone
  const zones = [browser, ...COMMON_TIMEZONES.filter((z) => z !== browser)]
  return (
    <div className="row">
      <select
        aria-label={SETUP_QUESTIONS.timeZone.title}
        value={state.displayTimeZone ?? browser}
        onChange={(e) => {
          const value = e.currentTarget.value
          update((s) => ({ ...s, displayTimeZone: value }))
          answered('timeZone')
        }}
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {z === browser ? C.browserZone(z) : z}
          </option>
        ))}
      </select>
      {/* A pre-filled default always has a one-click confirm (prompt 26 §4, §5). */}
      <Confirm
        onConfirm={() => {
          update((s) => ({ ...s, displayTimeZone: s.displayTimeZone ?? browser }))
          answered('timeZone')
        }}
      />
    </div>
  )
}

function FrameworksQuestion({ state, update, answered }: QProps) {
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
      {/* Selecting none and confirming says "none" (R3). */}
      <Confirm onConfirm={() => answered('frameworks')} />
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

// Workloads (§5): "Detected" with evidence, "Marked in use by you" when
// toggled on without evidence; toggling off a detected workload asks why.
function ApplicabilityQuestion({ state, snapshot, update, answered }: QProps) {
  const auto = detectFacets(snapshot)
  const facets = detectFacets(snapshot, state.facetOverrides as Partial<Record<Facet, { on: boolean; reason: string }>>)
  const [askingOff, setAskingOff] = useState<{ facet: Facet; reason: string } | null>(null)
  const R = C.workloadReason
  const evidenceText = (facet: string, f: { on: boolean }): string => {
    if (facet === 'intune') return f.on ? R.licence('Intune') : R.noLicence('Intune')
    if (facet === 'workload') return f.on ? R.licence('Workload Identities Premium') : R.noLicence('Workload Identities Premium')
    return f.on ? R.seen : R.notSeen
  }
  const label = (facet: Facet): { chip: string; status: 'done' | 'ready' | 'neutral'; text: string } => {
    const f = facets[facet]
    const detected = auto[facet].on
    if (f.on && detected) return { chip: C.detected, status: 'done', text: evidenceText(facet, auto[facet]) }
    if (f.on && !detected) return { chip: C.markedInUse, status: 'ready', text: evidenceText(facet, auto[facet]) }
    if (!f.on && f.source === 'override') return { chip: C.markedOff, status: 'neutral', text: `${f.reason} ${C.yourAnswer}` }
    return { chip: C.notUsed.replace(/ in Setup$/, ''), status: 'neutral', text: evidenceText(facet, auto[facet]) }
  }
  const setFacet = (facet: Facet, on: boolean, reason: string) => {
    update((s) => ({ ...s, facetOverrides: { ...s.facetOverrides, [facet]: { on, reason } } }))
    answered('applicability')
  }
  return (
    <div>
      <div className="grid-cards">
        {(Object.keys(facets) as Facet[]).map((facet) => {
          const l = label(facet)
          return (
            <Card key={facet} className="workload-card">
              <Icon name={FACET_ICON[facet] ?? 'policy'} size={24} />
              <div className="grow">
                <strong>{C.workloadNames[facet] ?? facet}</strong> <Chip status={l.status}>{l.chip}</Chip>
                <div className="sub">{l.text}</div>
                {askingOff?.facet === facet && (
                  <div style={{ marginTop: '6px' }}>
                    <div className="sub">{C.offReasonPrompt}</div>
                    <input type="text" value={askingOff.reason} placeholder={C.offReasonPlaceholder} onChange={(e) => setAskingOff({ facet, reason: e.currentTarget.value })} />
                    <div className="row" style={{ marginTop: '4px' }}>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={askingOff.reason.trim().length === 0}
                        onClick={() => {
                          setFacet(facet, false, askingOff.reason.trim())
                          setAskingOff(null)
                        }}
                      >
                        {C.confirmOff}
                      </Button>
                      <Button size="sm" variant="quiet" onClick={() => setAskingOff(null)}>
                        {C.cancel}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <Toggle
                on={facets[facet].on}
                label={C.workloadNames[facet] ?? facet}
                onChange={(on) => {
                  if (!on && auto[facet].on) setAskingOff({ facet, reason: '' })
                  else setFacet(facet, on, on ? C.confirmedByOperator : C.notUsed)
                }}
              />
            </Card>
          )
        })}
      </div>
      <Confirm onConfirm={() => answered('applicability')} />
    </div>
  )
}
