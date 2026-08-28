// Dev-only component gallery (#/components in DEV builds). Every shared
// component in src/ui/components rendered once in each state, so a screenshot
// of this page is the reference for docs/design/components.md.
import { useState } from 'react'
import {
  Button,
  Callout,
  Card,
  Chip,
  DataTable,
  EmptyState,
  ExpandCard,
  FilterChip,
  Icon,
  InfoTip,
  LinkButton,
  Picker,
  ProgressBar,
  StatTile,
  Stats,
  Stepper,
  Tabs,
} from '../components/index.ts'
import type { ChipStatus, Column, IconName, PickerOption } from '../components/index.ts'
import { InventoryPage } from './InventoryPage.tsx'
import { MappingPage } from './MappingPage.tsx'
import { CoveragePage } from './CoveragePage.tsx'
import { RoadmapPage } from './RoadmapPage.tsx'
import type { BaselineResult } from './BaselinePage.tsx'
import { fixtureSnapshot } from './fixtureSnapshot.ts'

const FIXTURE = fixtureSnapshot()
const FIXTURE_BASELINE: BaselineResult = {
  source: 'synthetic baseline',
  fetchFailures: 0,
  origin: { kind: 'upload', files: [] },
  pkg: {
    policies: [
      {
        id: 'b-1',
        displayName: 'ACME - GLOBAL - BLOCK - LegacyAuth - ExludeSvcAccounts',
        state: 'enabled',
        conditions: {
          users: { includeUsers: ['All'], excludeGroups: ['11111111-1111-1111-1111-111111111111'] },
          applications: { includeApplications: ['All'] },
          clientAppTypes: ['exchangeActiveSync', 'other'],
        },
        grantControls: { operator: 'OR', builtInControls: ['block'] },
      },
    ],
    origins: {},
    report: { considered: 1, parsed: 1, skipped: [], errors: [], duplicates: [], warnings: [] },
    references: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        kind: 'group',
        portability: 'tenantSpecific',
        uses: [{ policyName: 'ACME - GLOBAL - BLOCK - LegacyAuth - ExludeSvcAccounts', side: 'exclude' }],
      },
    ],
    groupSignatures: [
      { id: '11111111-1111-1111-1111-111111111111', inferredRole: 'globalExclusion', confidence: 'high', evidence: 'excluded from 1 of 1 user-targeting policies, never included' },
    ],
    variantSets: [{ intentKey: 'countries', relation: 'variant', policyNames: ['Countries - allow list', 'Countries - block list'] }],
    docs: [],
  } as unknown as BaselineResult['pkg'],
}

const ICONS: IconName[] = [
  'shield', 'user', 'users', 'key', 'device', 'location', 'policy', 'chart', 'check', 'alert',
  'info', 'external-link', 'download', 'print', 'copy', 'refresh', 'lock', 'search', 'chevron', 'close',
]
const CHIPS: ChipStatus[] = ['done', 'ready', 'blocked', 'in-progress', 'warning', 'neutral']

type Row = { name: string; state: string; count: number }
const ROWS: Row[] = [
  { name: 'Require MFA for all users', state: 'In place', count: 142 },
  { name: 'Block legacy authentication', state: 'Partly', count: 9 },
  { name: 'Require compliant device', state: 'Missing', count: 0 },
]
const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'Goal', render: (r) => r.name, sortValue: (r) => r.name, csv: (r) => r.name },
  { key: 'state', header: 'State', render: (r) => <Chip status={r.state === 'In place' ? 'done' : r.state === 'Partly' ? 'warning' : 'blocked'}>{r.state}</Chip>, csv: (r) => r.state },
  { key: 'count', header: 'Users affected', render: (r) => r.count, sortValue: (r) => r.count, csv: (r) => r.count },
]
const PEOPLE: PickerOption[] = [
  { id: '1', name: 'Alex Morgan', secondary: 'alex@example.com', badge: 'Global admin' },
  { id: '2', name: 'Sam Lee', secondary: 'sam@example.com' },
  { id: '3', name: 'Break-glass 01', secondary: 'bg01@example.com', badge: 'break-glass' },
]

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} data-component={id} style={{ marginBottom: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--text-lg)', margin: '0 0 var(--space-3)' }}>{title}</h2>
      {children}
    </section>
  )
}

export function ComponentsPage() {
  const [filter, setFilter] = useState<Set<string>>(new Set(['done']))
  const [picked, setPicked] = useState<PickerOption[]>([PEOPLE[0]])
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const results = PEOPLE.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      <h1>Component gallery</h1>
      <p className="muted">Every shared component in one place. Development builds only.</p>

      <Section id="button" title="Button">
        <div className="row">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="primary" loading>
            Scanning
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button size="sm" icon="download">
            Small with icon
          </Button>
          <LinkButton href="#/components">Link button</LinkButton>
        </div>
      </Section>

      <Section id="chip" title="Chip and FilterChip">
        <div className="row">
          {CHIPS.map((s) => (
            <Chip key={s} status={s}>
              {s}
            </Chip>
          ))}
        </div>
        <div className="row" style={{ marginTop: 'var(--space-3)' }}>
          {CHIPS.map((s) => (
            <FilterChip
              key={s}
              selected={filter.has(s)}
              onToggle={() =>
                setFilter((f) => {
                  const n = new Set(f)
                  if (n.has(s)) n.delete(s)
                  else n.add(s)
                  return n
                })
              }
            >
              {s}
            </FilterChip>
          ))}
        </div>
      </Section>

      <Section id="infotip" title="InfoTip">
        <p>
          142 active users
          <InfoTip title="Active user" text="A user with at least one successful sign-in in the last 90 days." />
        </p>
      </Section>

      <Section id="card" title="Card and ExpandCard">
        <div className="grid-cards">
          <Card title="Card title">Body text sits inside the card with its own padding.</Card>
          <ExpandCard summary={<strong>Expandable card</strong>} open>
            <p>Details shown when open.</p>
          </ExpandCard>
        </div>
      </Section>

      <Section id="callout" title="Callout">
        <Callout kind="info" title="Info">Something worth knowing.</Callout>
        <Callout kind="warning" title="Warning">Verify before enforcing.</Callout>
        <Callout kind="danger" title="Danger">This would lock out 3 users today.</Callout>
        <Callout kind="success" title="Success">Checks passed.</Callout>
      </Section>

      <Section id="tabs" title="Tabs">
        <Tabs
          tabs={[
            { id: 'a', label: 'Overview', render: () => <p>Overview panel.</p> },
            { id: 'b', label: 'Steps', badge: 12, render: () => <p>Steps panel.</p> },
            { id: 'c', label: 'Danger areas', badge: 2, render: () => <p>Danger panel.</p> },
          ]}
        />
      </Section>

      <Section id="stattile" title="StatTile and Stats">
        <Stats>
          <StatTile value={142} label="Active users" tip={{ title: 'Active user', text: 'Signed in within 90 days.' }} />
          <StatTile value={128} label="MFA-ready" tone="success" />
          <StatTile value={9} label="Needs attention" tone="warning" onClick={() => setActive((a) => (a === 'w' ? null : 'w'))} active={active === 'w'} />
          <StatTile value={3} label="Blocked" tone="danger" />
          <StatTile value="14 days" label="To enforcement" tone="info" />
        </Stats>
      </Section>

      <Section id="progressbar" title="ProgressBar">
        <ProgressBar percent={62} caption="Reading sign-ins · 62%" />
        <ProgressBar percent={null} caption="Waiting…" />
      </Section>

      <Section id="picker" title="Picker">
        <Picker selected={picked} options={results} suggestions={PEOPLE} onSearch={setQuery} onChange={setPicked} placeholder="Search people…" />
      </Section>

      <Section id="datatable" title="DataTable">
        <DataTable rows={ROWS} columns={COLUMNS} rowKey={(r) => r.name} csvName="gallery.csv" expand={(r) => <p>Details for {r.name}.</p>} />
      </Section>

      <Section id="emptystate" title="EmptyState">
        <EmptyState icon="search" text="No sign-ins matched." action={<Button size="sm">Clear filters</Button>} />
      </Section>

      <Section id="stepper" title="Stepper">
        <div style={{ maxWidth: '16rem' }}>
          <Stepper
            active="baseline"
            steps={[
              { route: 'start', label: 'Start', status: 'done' },
              { route: 'connect', label: 'Connect', status: 'done' },
              { route: 'baseline', label: 'Baseline', status: 'inProgress' },
              { route: 'scan', label: 'Scan', status: 'attention' },
              { route: 'mapping', label: 'Setup' },
            ]}
            reference={[{ route: 'reads', label: 'What IAMAI reads' }]}
          />
        </div>
      </Section>

      <Section id="setup" title="Setup (synthetic tenant)">
        <MappingPage scan={{ snapshot: FIXTURE, at: FIXTURE.asOf }} baseline={FIXTURE_BASELINE} onProgress={() => {}} />
      </Section>

      <Section id="findings" title="Findings (synthetic tenant)">
        <CoveragePage scan={{ snapshot: FIXTURE, at: FIXTURE.asOf }} baseline={FIXTURE_BASELINE} />
      </Section>

      <Section id="roadmap" title="Roadmap (synthetic tenant)">
        <RoadmapPage scan={{ snapshot: FIXTURE, at: FIXTURE.asOf }} baseline={FIXTURE_BASELINE} operator={{ userId: 'u-1', userPrincipalName: 'alex@example.com' }} />
      </Section>

      <Section id="inventory" title="Inventory (synthetic tenant)">
        <InventoryPage snapshot={FIXTURE} />
      </Section>

      <Section id="icon" title="Icon">
        <div className="row">
          {ICONS.map((n) => (
            <span key={n} className="row" title={n} style={{ gap: 4 }}>
              <Icon name={n} /> <span className="sub">{n}</span>
            </span>
          ))}
        </div>
      </Section>
    </div>
  )
}
