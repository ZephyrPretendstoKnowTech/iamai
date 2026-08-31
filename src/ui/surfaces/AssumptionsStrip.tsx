// The assumptions strip (prompt 48 item 10, target-state §5). One line, each
// item a chip that edits in place. Three kinds: a detected fact (editable), a
// weak detection (with the signals that nominated it, confirmed on Save), and a
// question the tool cannot answer from evidence. One editor pattern: a picker,
// then one Save. This is Setup; no question is asked anywhere else.
import { useMemo, useState } from 'react'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineResult } from '../baseline.ts'
import type { MappingState } from '../../mapping/types.ts'
import { PLAN as C } from '../../copy/plan.ts'
import { detectEmergencyAccess, emergencySignals } from '../../mapping/emergencyAccess.ts'
import { detectServiceAccounts } from '../../mapping/serviceAccounts.ts'
import { sharedDeviceUsers } from '../../derive/sharedDevices.ts'
import { COMMON_TIMEZONES } from '../../copy/setup.ts'
import { Button, Picker, Status } from '../components/index.ts'
import type { PickerOption } from '../components/index.ts'
import type { PlanData, PlanComputed } from './planData.ts'

type Kind = 'fact' | 'weak' | 'question'
type Chip = { id: string; label: string; kind: Kind; signals?: string[]; editor: (close: () => void) => React.ReactNode }

export function AssumptionsStrip({ data, snapshot, baseline, computed }: { data: PlanData; snapshot: TenantSnapshot; baseline: BaselineResult | null; computed: PlanComputed }) {
  const [open, setOpen] = useState<string | null>(null)
  const m = data.mapping
  const chips = useMemo<Chip[]>(() => (m ? buildChips(m, snapshot, data) : []), [m, snapshot, data])
  void baseline
  void computed
  if (!m) return null
  return (
    <div className="assumptions-strip">
      <span className="muted">{C.assumes}</span>
      {chips.map((chip) => (
        <span key={chip.id} className="assumption">
          <button type="button" className={`chip status status-${chip.kind === 'weak' ? 'wait' : chip.kind === 'question' ? 'wait' : 'idle'}`} onClick={() => setOpen((o) => (o === chip.id ? null : chip.id))}>
            {chip.label} · {chip.kind === 'weak' ? C.confirm : chip.kind === 'question' ? 'answer' : C.change}
          </button>
          {open === chip.id && (
            <span className="assumption-editor">
              {chip.signals && chip.signals.length > 0 && <span className="reason">{C.signals(chip.signals.length, chip.signals.join(', '))}</span>}
              {chip.editor(() => setOpen(null))}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

function userOptions(snapshot: TenantSnapshot, query: string): PickerOption[] {
  const q = query.trim().toLowerCase()
  return snapshot.users
    .filter((u) => !q || `${u.displayName ?? ''} ${u.userPrincipalName ?? ''}`.toLowerCase().includes(q))
    .slice(0, 20)
    .map((u) => ({ id: u.id, name: u.displayName ?? u.userPrincipalName ?? u.id, secondary: u.userPrincipalName ?? undefined }))
}

function SaveRow({ onSave }: { onSave: () => void }) {
  return (
    <p className="actions">
      <Button variant="secondary" onClick={onSave}>
        {C.save}
      </Button>
    </p>
  )
}

function PeopleEditor({ snapshot, selected, placeholder, onSave }: { snapshot: TenantSnapshot; selected: string[]; placeholder: string; onSave: (ids: string[]) => void }) {
  const [q, setQ] = useState('')
  const [ids, setIds] = useState<string[]>(selected)
  const byId = useMemo(() => new Map(snapshot.users.map((u) => [u.id, u.displayName ?? u.userPrincipalName ?? u.id])), [snapshot])
  return (
    <>
      <Picker
        selected={ids.map((id) => ({ id, name: byId.get(id) ?? id }))}
        options={userOptions(snapshot, q)}
        onSearch={setQ}
        onChange={(next) => setIds(next.map((o) => o.id))}
        placeholder={placeholder}
      />
      <SaveRow onSave={() => onSave(ids)} />
    </>
  )
}

function buildChips(m: MappingState, snapshot: TenantSnapshot, data: PlanData): Chip[] {
  const save = (mut: (s: MappingState) => MappingState): void => data.saveMapping(mut(m))
  const chips: Chip[] = []

  // Emergency access — weak.
  const emCands = detectEmergencyAccess(snapshot, snapshot.config.caPolicies?.rows ?? [])
  const emSignals = emCands[0] ? emCands[0].signals.map((s) => C.editor.signalsFor[s] ?? s) : []
  chips.push({
    id: 'breakGlass',
    label: C.assumption.emergencyAccess(m.breakGlassUserIds.length),
    kind: 'weak',
    signals: emSignals,
    editor: (close) => (
      <PeopleEditor
        snapshot={snapshot}
        selected={m.breakGlassUserIds}
        placeholder={C.editor.emergencyAccount}
        onSave={(ids) => {
          save((s) => ({ ...s, breakGlassUserIds: ids, wizardAnswered: { ...s.wizardAnswered, breakGlass: true }, assumed: { ...(s.assumed ?? {}), breakGlass: 'confirmed' } }))
          close()
        }}
      />
    ),
  })

  // Exclusions group — fact (picker over the loaded groups).
  const rec = m.records['__globalExclusion']
  chips.push({
    id: 'exclusionsGroup',
    label: C.assumption.exclusionsGroup(rec?.resolvedName ?? null),
    kind: 'fact',
    editor: (close) => {
      const groupOptions: PickerOption[] = [...data.groups.entries()].map(([id, g]) => ({ id, name: g.displayName ?? id }))
      return (
        <GroupEditor
          options={groupOptions}
          selected={rec?.resolvedId ?? null}
          selectedName={rec?.resolvedName ?? null}
          onSave={(id, name) => {
            save((s) => ({ ...s, records: { ...s.records, __globalExclusion: { placeholder: '__globalExclusion', kind: 'group', group: 'globalExclusion', resolvedId: id, resolvedName: name, provenance: 'confirmed', doesNotExist: id === null, validation: null } }, wizardAnswered: { ...s.wizardAnswered, globalExclusion: true }, assumed: { ...(s.assumed ?? {}), globalExclusion: 'confirmed' } }))
            close()
          }}
        />
      )
    },
  })

  // Sign-in countries — fact.
  chips.push({
    id: 'countries',
    label: C.assumption.countries(m.allowedCountries),
    kind: 'fact',
    editor: (close) => <CountryEditor selected={m.allowedCountries} onSave={(codes) => { save((s) => ({ ...s, allowedCountries: codes, wizardAnswered: { ...s.wizardAnswered, countries: true }, assumed: { ...(s.assumed ?? {}), countries: 'confirmed' } })); close() }} />,
  })

  // Trusted locations — fact.
  chips.push({
    id: 'trustedLocations',
    label: C.assumption.trustedLocations(m.trustedLocationIds.length),
    kind: 'fact',
    editor: (close) => {
      const locs = ((snapshot.config.namedLocations?.rows ?? []) as { id?: string; displayName?: string; isTrusted?: boolean }[]).filter((l) => typeof l.id === 'string')
      const options: PickerOption[] = locs.map((l) => ({ id: l.id!, name: l.displayName ?? l.id!, badge: l.isTrusted ? 'trusted' : undefined }))
      return (
        <MultiPickerEditor
          options={options}
          selected={m.trustedLocationIds}
          placeholder={C.editor.location}
          onSave={(ids) => { save((s) => ({ ...s, trustedLocationIds: ids, wizardAnswered: { ...s.wizardAnswered, trustedLocations: true }, assumed: { ...(s.assumed ?? {}), trustedLocations: 'confirmed' } })); close() }}
        />
      )
    },
  })

  // Service accounts — weak.
  const svcCands = detectServiceAccounts(snapshot, [...m.breakGlassUserIds, ...m.serviceAccountRejectedIds])
  const svcSignals = svcCands[0] ? svcCands[0].evidence : []
  chips.push({
    id: 'serviceAccounts',
    label: C.assumption.serviceAccounts(m.serviceAccountUserIds.length),
    kind: 'weak',
    signals: svcSignals,
    editor: (close) => (
      <PeopleEditor
        snapshot={snapshot}
        selected={m.serviceAccountUserIds}
        placeholder={C.editor.person}
        onSave={(ids) => { save((s) => ({ ...s, serviceAccountUserIds: ids, wizardAnswered: { ...s.wizardAnswered, serviceAccounts: true }, assumed: { ...(s.assumed ?? {}), serviceAccounts: 'confirmed' } })); close() }}
      />
    ),
  })

  // Shared devices — fact (detected; the editor lists them).
  const shared = sharedDeviceUsers(snapshot)
  chips.push({
    id: 'sharedDevices',
    label: C.assumption.sharedDevices(shared.length),
    kind: 'fact',
    editor: (close) => (
      <>
        <ul className="sections">
          {shared.map((u) => (
            <li key={u.id}>{u.displayName ?? u.userPrincipalName ?? u.id}</li>
          ))}
          {shared.length === 0 && <li className="muted">None detected.</li>}
        </ul>
        <SaveRow onSave={close} />
      </>
    ),
  })

  // Time zone — fact.
  chips.push({
    id: 'timeZone',
    label: C.assumption.timeZone(m.displayTimeZone ?? 'UTC'),
    kind: 'fact',
    editor: (close) => <TimeZoneEditor selected={m.displayTimeZone ?? 'UTC'} onSave={(tz) => { save((s) => ({ ...s, displayTimeZone: tz, wizardAnswered: { ...s.wizardAnswered, timeZone: true }, assumed: { ...(s.assumed ?? {}), timeZone: 'confirmed' } })); close() }} />,
  })

  // The three questions the tool cannot answer from evidence.
  const qa = m.questionAnswers ?? {}
  const question = (id: string, label: string, prompt: string): Chip => ({
    id,
    label,
    kind: 'question',
    editor: (close) => <FreeTextEditor prompt={prompt} value={qa[id] ?? ''} onSave={(text) => { save((s) => ({ ...s, questionAnswers: { ...(s.questionAnswers ?? {}), [id]: text } })); close() }} />,
  })
  chips.push(question('mailDevices', C.assumption.mailDevices, C.editor.mailDevicesPrompt))
  chips.push(question('travel', C.assumption.travel, C.editor.travelPrompt))
  chips.push(question('partner', C.assumption.partner, C.editor.partnerPrompt))

  void Status
  return chips
}

function GroupEditor({ options, selected, selectedName, onSave }: { options: PickerOption[]; selected: string | null; selectedName: string | null; onSave: (id: string | null, name: string | null) => void }) {
  const [pick, setPick] = useState<{ id: string; name: string } | null>(selected ? { id: selected, name: selectedName ?? selected } : null)
  return (
    <>
      <Picker single selected={pick ? [pick] : []} options={options} onChange={(next) => setPick(next[0] ? { id: next[0].id, name: next[0].name } : null)} placeholder={C.editor.group} />
      <SaveRow onSave={() => onSave(pick?.id ?? null, pick?.name ?? null)} />
    </>
  )
}

function MultiPickerEditor({ options, selected, placeholder, onSave }: { options: PickerOption[]; selected: string[]; placeholder: string; onSave: (ids: string[]) => void }) {
  const byId = new Map(options.map((o) => [o.id, o.name]))
  const [ids, setIds] = useState<string[]>(selected)
  return (
    <>
      <Picker selected={ids.map((id) => ({ id, name: byId.get(id) ?? id }))} options={options} onChange={(next) => setIds(next.map((o) => o.id))} placeholder={placeholder} />
      <SaveRow onSave={() => onSave(ids)} />
    </>
  )
}

function CountryEditor({ selected, onSave }: { selected: string[]; onSave: (codes: string[]) => void }) {
  const [codes, setCodes] = useState<string[]>(selected)
  const [add, setAdd] = useState('')
  const toggle = (c: string): void => setCodes((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))
  return (
    <>
      <span className="picker">
        {codes.map((c) => (
          <Button key={c} variant="secondary" onClick={() => toggle(c)}>
            {c}
          </Button>
        ))}
        <input type="search" aria-label={C.editor.country} placeholder={C.editor.country} value={add} onChange={(e) => setAdd(e.currentTarget.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter' && /^[A-Z]{2}$/.test(add)) { toggle(add); setAdd('') } }} />
      </span>
      <SaveRow onSave={() => onSave(codes)} />
    </>
  )
}

function TimeZoneEditor({ selected, onSave }: { selected: string; onSave: (tz: string) => void }) {
  const [tz, setTz] = useState(selected)
  return (
    <>
      <label className="rows">
        <span>{C.editor.timeZone}</span>
        <select value={tz} onChange={(e) => setTz(e.currentTarget.value)}>
          {[selected, ...COMMON_TIMEZONES.filter((z) => z !== selected)].map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </label>
      <SaveRow onSave={() => onSave(tz)} />
    </>
  )
}

function FreeTextEditor({ prompt, value, onSave }: { prompt: string; value: string; onSave: (text: string) => void }) {
  const [text, setText] = useState(value)
  return (
    <>
      <label className="rows">
        <span className="reason">{prompt}</span>
        <textarea rows={3} value={text} onChange={(e) => setText(e.currentTarget.value)} aria-label={C.editor.freeText} />
      </label>
      <SaveRow onSave={() => onSave(text)} />
    </>
  )
}
