// Licensing guide (SPEC §12): what this tenant's licence enables, scored
// honestly: nothing locked, nothing "accepted risk".
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { CATALOGUE } from '../../coverage/coverage.ts'
import ladder from '../../../data/free-tier-ladder.json' with { type: 'json' }
import { LICENSING } from '../../copy/pages.ts'
import { TILE } from '../../copy/definitions.ts'
import { Card, Chip, DataTable, EmptyState, InfoTip, LinkButton } from '../components/index.ts'
import { ScanAge } from '../shell/AppShell.tsx'

const TIER_CAP: Record<string, string> = {
  p1: 'entraP1',
  p2: 'entraP2',
  intune: 'intune',
  workloadId: 'workloadIdPremium',
  gsa: 'globalSecureAccess',
  mcas: 'defenderForCloudApps',
}

export function LicensingPage({ scan }: { scan: { snapshot: TenantSnapshot; at: string } | null }) {
  const snapshot = scan?.snapshot ?? null
  if (!snapshot) {
    return (
      <section>
        <h2>{LICENSING.title}</h2>
        <EmptyState icon="key" text={LICENSING.empty} action={<LinkButton href="#/scan">{LICENSING.runScan}</LinkButton>} />
      </section>
    )
  }
  const caps = snapshot.capabilities
  const users = snapshot.users.length
  const goalsByTier = new Map<string, string[]>()
  for (const g of CATALOGUE) {
    const tier = g.implementations[0]?.tier ?? 'p1'
    goalsByTier.set(tier, [...(goalsByTier.get(tier) ?? []), g.name])
  }
  const capRows = Object.entries(caps).map(([key, c]) => ({ key, ...c }))

  return (
    <section>
      <h2>{LICENSING.title}</h2>
      <ScanAge at={scan!.at} />
      <p className="advisor">
        {LICENSING.intro}
        {!caps.entraP1.enabled && ` ${LICENSING.noP1}`}
      </p>

      <Card title={LICENSING.hasTitle}>
        <DataTable
          rows={capRows}
          rowKey={(r) => r.key}
          columns={[
            { key: 'cap', header: LICENSING.columns.capability, render: (r) => LICENSING.caps[r.key] ?? r.key },
            {
              key: 'status',
              header: LICENSING.columns.status,
              render: (r) => <Chip status={r.enabled ? 'done' : 'neutral'}>{r.enabled ? LICENSING.enabled : LICENSING.notLicensed}</Chip>,
            },
            {
              key: 'seats',
              header: LICENSING.columns.seats,
              render: (r) =>
                r.enabled ? (
                  <>
                    {LICENSING.seats(r.seats, r.consumed)}
                    <InfoTip title={TILE.seats.title} text={TILE.seats.text} />
                  </>
                ) : (
                  '—'
                ),
            },
            {
              key: 'covers',
              header: LICENSING.columns.covers,
              render: (r) =>
                r.enabled ? (
                  <>
                    {r.seats >= users ? LICENSING.covers : LICENSING.short(users - r.seats)}
                    <InfoTip title={TILE.seatShortfall.title} text={TILE.seatShortfall.text} />
                  </>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      </Card>

      <Card title={LICENSING.goalsTitle}>
        {[...goalsByTier.entries()].map(([tier, names]) => {
          const cap = TIER_CAP[tier]
          const have = cap ? caps[cap as keyof typeof caps]?.enabled : true
          return (
            <div key={tier}>
              <h4>
                {cap ? LICENSING.caps[cap] : tier} <Chip status={have ? 'done' : 'neutral'}>{have ? LICENSING.scored : LICENSING.reference}</Chip>
              </h4>
              <ul className="sections">
                {names.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )
        })}
      </Card>

      <Card title={LICENSING.ladderTitle}>
        <p className="muted">{LICENSING.ladderIntro}</p>
        <ol className="sections">
          {ladder.items.map((i) => (
            <li key={i.id}>{i.name}</li>
          ))}
        </ol>
      </Card>
      <p className="step-next">
        <LinkButton href="#/coverage">{LICENSING.nextAfterScan}</LinkButton>
      </p>
    </section>
  )
}
