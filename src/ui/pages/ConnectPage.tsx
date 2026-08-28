import type { AccountInfo } from '@azure/msal-browser'
import { signIn, signOut } from '../../graph/msal.ts'
import { CONNECT } from '../../copy/pages.ts'
import { whenAt } from '../../copy/dates.ts'
import { Button, Card } from '../components/index.ts'
import { REPO_URL, StepFrame } from '../shell/AppShell.tsx'

export function ConnectPage({
  account,
  tenantName,
  lastScanAt,
  userCount,
}: {
  account: AccountInfo | null
  tenantName: string | null
  lastScanAt?: string | null
  userCount?: number | null
}) {
  return (
    <StepFrame
      title={CONNECT.title}
      does={CONNECT.does}
      needs={[{ met: account !== null, text: CONNECT.needs }]}
      next={account ? 'baseline' : undefined}
      nextLabel={CONNECT.next}
    >
      {account ? (
        <Card>
          <p>
            {CONNECT.signedInTo} <strong>{tenantName ?? account.username}</strong> {CONNECT.as} {account.username}
          </p>
          <p className="muted">
            {CONNECT.tenantId} <code>{account.tenantId}</code>
          </p>
          {lastScanAt && (
            <p className="muted">
              {CONNECT.savedScan(whenAt(lastScanAt), userCount ?? null)} <a href="#/coverage">{CONNECT.findings}</a> {CONNECT.or}{' '}
              <a href="#/roadmap">{CONNECT.roadmap}</a>.
            </p>
          )}
          <p>
            <Button onClick={() => void signOut()}>{CONNECT.signOut}</Button>
          </p>
        </Card>
      ) : (
        <Card>
          <ul>
            {CONNECT.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
            <li>
              {CONNECT.sourceBefore}
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                {CONNECT.sourceLink}
              </a>
              {CONNECT.sourceAfter}
            </li>
          </ul>
          <Button variant="primary" onClick={() => void signIn()}>
            {CONNECT.signIn}
          </Button>
        </Card>
      )}
    </StepFrame>
  )
}
