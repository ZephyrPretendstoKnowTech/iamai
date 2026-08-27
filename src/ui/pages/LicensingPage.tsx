// Licensing guide (SPEC §12): what this tenant's licence enables, scored
// honestly — nothing locked, nothing "accepted risk".
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { CATALOGUE } from '../../coverage/coverage.ts'
import ladder from '../../../data/free-tier-ladder.json' with { type: 'json' }
import { Card, Chip, DataTable, EmptyState, LinkButton } from '../components/index.ts'

const CAP_LABEL: Record<string, string> = {
  entraP1: 'Entra ID P1',
  entraP2: 'Entra ID P2',
  intune: 'Intune',
  workloadIdPremium: 'Workload Identities Premium',
  globalSecureAccess: 'Global Secure Access',
  defenderForCloudApps: 'Defender for Cloud Apps',
  purviewInsiderRisk: 'Purview Insider Risk',
}

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
        <h2>Licensing guide</h2>
        <EmptyState icon="key" text="After a scan, this page shows what your licence enables, where seat counts fall short, and which goals are scored." action={<LinkButton href="#/scan">Run a scan</LinkButton>} />
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
      <h2>Licensing guide</h2>
      <p className="advisor">
        IAMAI hardens what you have. Every goal is scored against the best implementation your licence allows. Goals
        that need a missing tier are listed as education, never as a gap you accepted.
        {!caps.entraP1.enabled && ' Without Entra ID P1 there is no Conditional Access; the plan is the free-tier ladder plus security defaults.'}
      </p>

      <Card title="What your tenant has">
        <DataTable
          rows={capRows}
          rowKey={(r) => r.key}
          columns={[
            { key: 'cap', header: 'Capability', render: (r) => CAP_LABEL[r.key] ?? r.key },
            { key: 'status', header: 'Status', render: (r) => <Chip status={r.enabled ? 'done' : 'neutral'}>{r.enabled ? 'enabled' : 'not licensed'}</Chip> },
            { key: 'seats', header: 'Seats', render: (r) => (r.enabled ? `${r.seats} (${r.consumed} assigned)` : '—') },
            {
              key: 'covers',
              header: 'Covers your users?',
              render: (r) => (r.enabled ? (r.seats >= users ? 'yes' : `no — ${users - r.seats} more user(s) than seats`) : '—'),
            },
          ]}
        />
      </Card>

      <Card title="Goals by the licence they need">
        {[...goalsByTier.entries()].map(([tier, names]) => {
          const cap = TIER_CAP[tier]
          const have = cap ? caps[cap as keyof typeof caps]?.enabled : true
          return (
            <div key={tier}>
              <h4>
                {cap ? CAP_LABEL[cap] : tier} <Chip status={have ? 'done' : 'neutral'}>{have ? 'scored' : 'education only'}</Chip>
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

      <Card title="The free-tier ladder">
        <p className="muted">The spine of every plan, regardless of licence — curated from Microsoft guidance (placeholders until curated).</p>
        <ol className="sections">
          {ladder.items.map((i) => (
            <li key={i.id}>{i.name}</li>
          ))}
        </ol>
      </Card>
    </section>
  )
}
