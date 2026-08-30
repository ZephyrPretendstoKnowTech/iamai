// Licensing guide (SPEC §12): what this tenant's licence enables, scored
// honestly: nothing locked, nothing "accepted risk".
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { CATALOGUE } from '../../coverage/coverage.ts'
import ladder from '../../../data/free-tier-ladder.json' with { type: 'json' }
import { LICENSING } from '../../copy/pages.ts'
import { stepIdForGoal } from '../../roadmap/generate.ts'
import { ladderStepId } from '../../roadmap/ladder.ts'
import { stepHref } from '../shell/AppShell.tsx'
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
  // No Entra ID P1 means no Conditional Access, so the ladder is the plan (SPEC §12).
  const onLadder = !caps.entraP1.enabled
  const users = snapshot.users.length
  const goalsByTier = new Map<string, { name: string; tldr: string | null }[]>()
  for (const g of CATALOGUE) {
    const tier = g.implementations[0]?.tier ?? 'p1'
    goalsByTier.set(tier, [...(goalsByTier.get(tier) ?? []), { name: g.name, tldr: g.tldr ?? null }])
  }
  // R19: only the capabilities a goal in the catalogue actually needs. Rows for
  // Purview Insider Risk and Defender for Cloud Apps described licences that
  // nothing in the plan would ever use, which reads as advice to buy them.
  const TIER_TO_CAP: Record<string, string> = { p1: 'entraP1', p2: 'entraP2', intune: 'intune', workloadId: 'workloadIdPremium' }
  const used = new Set(CATALOGUE.flatMap((g) => g.implementations.map((i) => TIER_TO_CAP[i.tier] ?? '')).filter(Boolean))
  const capRows = Object.entries(caps)
    .filter(([key]) => used.has(key))
    .map(([key, c]) => ({ key, ...c }))

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
              key: 'covers',
              header: LICENSING.columns.covers,
              render: (r) =>
                r.enabled ? (
                  <>
                    {/* R19: seat count alone changed nothing. A shortfall does:
                        it says who would be left out and what to do about it. */}
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
                {names.map((g) => (
                  <li key={g.name}>
                    {g.name}
                    {/* Reference-only goals say what the licence would unlock (ux-review-05 §27). */}
                    {!have && g.tldr && <span className="reason">: {g.tldr}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </Card>

      <Card title={LICENSING.ladderTitle}>
        <p className="muted">
          {LICENSING.ladderIntro}
          {onLadder && ` ${LICENSING.ladderInPlan}`}
          {/* C20: why some rungs have no step, said once rather than per rung. */}
          {ladder.items.some((i) => !(onLadder ? true : i.goalId)) && ` ${LICENSING.ladderNoStep}`}
        </p>
        <ol className="sections">
          {ladder.items.map((i) => {
            // On a free licence every rung is a step of its own; with Conditional
            // Access, only the rungs a catalogue goal covers have one.
            const href = onLadder ? stepHref(ladderStepId(i.id)) : i.goalId ? stepHref(stepIdForGoal(i.goalId)) : null
            return (
              <li key={i.id}>
                <strong>{i.name}</strong>
                {i.description && <span className="reason">: {i.description}</span>}
                {/* C20: every rung either links to its step or says why it
                    cannot. Seven of ten used to be dead text. */}
                {href ? (
                  <>
                    {' '}
                    <a href={href}>{LICENSING.openStep}</a>
                  </>
                ) : null}
              </li>
            )
          })}
        </ol>
      </Card>
      <p className="step-next">
        <LinkButton href="#/coverage">{LICENSING.nextAfterScan}</LinkButton>
      </p>
    </section>
  )
}
