// The recovery card (prompt 44 Part 2).
//
// One page to print and keep. The audience is one person with no colleague to
// call: if a change goes wrong on a Friday evening, the worst moment to be
// reading a rollout plan is the moment they need it.
//
// It renders from the last saved scan and plan, with no fresh compute, because
// somebody locked out of the portal cannot run a scan. It never carries a
// credential — it says where the credential is recorded, which is what the
// Setup answer is for.
import { useEffect, useState } from 'react'
import { loadMappingState } from '../../mapping/store.ts'
import { RECOVERY } from '../../copy/recovery.ts'
import { SETUP_PAGE } from '../../copy/setup.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { buildNameDirectory } from '../../names.ts'
import { exportPrint, unredactedFrom } from '../exportGuard.ts'
import { Button, Callout, Card, EmptyState, LinkButton } from '../components/index.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { MappingState } from '../../mapping/types.ts'

export function Recovery({ scan = null }: { scan?: { snapshot: TenantSnapshot; at: string } | null }) {
  const snapshot = scan?.snapshot ?? null
  // The card loads its own Setup answers rather than being handed them, so it
  // renders on its own route with no dependency on the Roadmap having computed
  // a plan first. Somebody locked out cannot wait for a scan.
  const [mapping, setMapping] = useState<MappingState | null>(null)
  useEffect(() => {
    if (!snapshot) return
    void loadMappingState(snapshot.tenantId).then(setMapping)
  }, [snapshot])
  const generatedAt = new Date().toISOString()
  if (!snapshot) {
    return (
      <section>
        <h2>{RECOVERY.title}</h2>
        <EmptyState icon="shield" text={RECOVERY.noPlan} action={<LinkButton href="#/connect">{RECOVERY.title}</LinkButton>} />
      </section>
    )
  }

  const names = buildNameDirectory(snapshot, new Map())
  const bgIds = mapping?.breakGlassUserIds ?? []
  // The sign-in address comes from the snapshot's own user rows: the directory
  // resolves a display name, and an address is what somebody types to sign in.
  const upnOf = new Map((snapshot.users ?? []).map((u) => [u.id, u.userPrincipalName ?? null]))
  const accounts = bgIds.map((id) => ({ id, name: names.label(id), upn: upnOf.get(id) ?? null }))
  const credentialRecorded = mapping?.breakGlassAnswers?.credentialStorage === true
  const org = (snapshot.config.organization?.rows?.[0] ?? {}) as { displayName?: string; verifiedDomains?: { name?: string }[] }
  const tenantName = org.displayName ?? snapshot.tenantId
  const domains = (org.verifiedDomains ?? []).map((d) => d.name).filter((n): n is string => Boolean(n))

  return (
    <section className="recovery-card">
      <h2>{RECOVERY.title}</h2>
      <p>{RECOVERY.does}</p>
      <p className="reason">
        {RECOVERY.generated(absoluteDate(generatedAt))} {RECOVERY.reprint}
      </p>

      {/* The warning that earns the unredacted surface: this page names people
          and carries the tenant id, and it is meant to be printed and kept. */}
      <Callout kind="warning" title={RECOVERY.warningTitle}>
        {RECOVERY.warning} {RECOVERY.warningKeep}
      </Callout>

      <Card title={RECOVERY.accountsTitle}>
        {accounts.length === 0 ? (
          <p>{RECOVERY.accountsNone}</p>
        ) : (
          <>
            <p className="reason">{RECOVERY.accountsNote}</p>
            <ul className="sections">
              {accounts.map((a) => (
                <li key={a.id}>
                  <strong>{a.name}</strong>
                  {a.upn && <div className="sub">{a.upn}</div>}
                </li>
              ))}
            </ul>
            <h3>{RECOVERY.credentialTitle}</h3>
            <p>{credentialRecorded ? SETUP_PAGE.breakGlassAsk.credentialStorage : RECOVERY.credentialNone}</p>
          </>
        )}
      </Card>

      <Card title={RECOVERY.disableTitle}>
        <ol className="sections">
          {RECOVERY.disableSteps.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </Card>

      <Card title={RECOVERY.reportOnlyTitle}>
        <p className="reason">{RECOVERY.reportOnlyWhy}</p>
        <ol className="sections">
          {RECOVERY.reportOnlySteps.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </Card>

      <Card title={RECOVERY.blockedTitle}>
        <ol className="sections">
          {RECOVERY.blockedSteps.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </Card>

      <Card title={RECOVERY.tenantTitle}>
        <ul className="sections">
          <li>
            <strong>{RECOVERY.tenantIdLabel}</strong>: {snapshot.tenantId}
          </li>
          <li>
            <strong>{RECOVERY.domainLabel}</strong>: {domains.length > 0 ? domains.join(', ') : tenantName}
          </li>
        </ul>
        <p className="reason">{RECOVERY.supportNote}</p>
      </Card>

      <p className="row no-print">
        <Button icon="print" onClick={() => exportPrint(unredactedFrom('recovery-card'))}>
          {RECOVERY.print}
        </Button>
      </p>
    </section>
  )
}
