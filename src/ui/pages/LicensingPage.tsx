// Licensing guide (SPEC §12): what this tenant's licence enables, scored
// honestly — nothing locked, nothing "accepted risk". Higher tiers appear only
// as education, grounded in this tenant's numbers.
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { CATALOGUE } from '../../coverage/coverage.ts'
import ladder from '../../../data/free-tier-ladder.json' with { type: 'json' }

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
        <div className="card">
          <p>
            Once you <a href="#/scan">run a scan</a>, I'll show what your licence enables, where seat counts fall short
            of your user count, and which goals I score you on. Nothing is ever locked or marked accepted-risk because
            of licence — I harden what you have.
          </p>
        </div>
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
  const hasP1 = caps.entraP1.enabled

  return (
    <section>
      <h2>Licensing guide</h2>
      <div className="advisor">
        <p>
          <strong>I harden what you have.</strong> Every goal is scored against the best implementation your licence
          allows. If a tier is missing, the goals that need it simply aren't scored — they're listed below as education,
          never as a gap you "accepted".
        </p>
        {!hasP1 && (
          <p>
            Without Entra ID P1 there is no Conditional Access at all — your plan is the free-tier ladder below plus
            security defaults, and I say so plainly rather than pretending.
          </p>
        )}
      </div>

      <div className="card">
        <h3>What your tenant has</h3>
        <table className="viability">
          <thead>
            <tr>
              <th>Capability</th>
              <th>Status</th>
              <th>Seats</th>
              <th>Covers your users?</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(caps).map(([key, c]) => (
              <tr key={key}>
                <td>{CAP_LABEL[key] ?? key}</td>
                <td>
                  <span className={`chip ${c.enabled ? 'state-verified' : ''}`}>{c.enabled ? 'enabled' : 'not licensed'}</span>
                </td>
                <td>{c.enabled ? `${c.seats} (${c.consumed} assigned)` : '—'}</td>
                <td>
                  {c.enabled
                    ? c.seats >= users
                      ? 'yes'
                      : `no — ${users - c.seats} more user(s) than seats; features gate per assigned user`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Goals by the licence they need</h3>
        {[...goalsByTier.entries()].map(([tier, names]) => {
          const cap = TIER_CAP[tier]
          const have = cap ? caps[cap as keyof typeof caps]?.enabled : true
          return (
            <div key={tier}>
              <h4>
                {cap ? CAP_LABEL[cap] : tier}{' '}
                <span className={`chip ${have ? 'state-verified' : ''}`}>{have ? 'scored' : 'education only'}</span>
              </h4>
              <ul className="sections">
                {names.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="card">
        <h3>The free-tier ladder</h3>
        <p className="reason">
          The spine of every plan, regardless of licence — curated from Microsoft guidance (placeholders until curated).
        </p>
        <ol className="sections">
          {ladder.items.map((i) => (
            <li key={i.id}>{i.name}</li>
          ))}
        </ol>
      </div>
    </section>
  )
}
