import type { AccountInfo } from '@azure/msal-browser'
import { signIn, signOut } from '../../graph/msal.ts'
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
      title="Connect"
      does="Signs in read-only so IAMAI can read your tenant's configuration and inventory."
      needs={[{ met: true, text: 'a Global Administrator or Global Reader account' }]}
      next={account ? 'baseline' : undefined}
      nextLabel="Baseline"
    >
      {account ? (
        <Card>
          <p>
            Signed in to <strong>{tenantName ?? 'your tenant'}</strong> as {account.username}
          </p>
          <p className="muted">
            Tenant ID <code>{account.tenantId}</code>
          </p>
          {lastScanAt && (
            <p className="muted">
              A scan from {new Date(lastScanAt).toLocaleString()}
              {userCount ? ` (${userCount} users)` : ''} is saved on this device — go straight to{' '}
              <a href="#/coverage">Findings</a> or <a href="#/roadmap">Roadmap</a>.
            </p>
          )}
          <p>
            <Button onClick={() => void signOut()}>Sign out</Button>
          </p>
        </Card>
      ) : (
        <Card>
          <ul>
            <li>
              IAMAI is read-only. It never creates, edits, or deletes anything in your tenant — not
              even report-only policies.
            </li>
            <li>
              IAMAI runs entirely in your browser and only reads.{' '}
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                The source is public
              </a>{' '}
              so anyone can verify that.
            </li>
            <li>
              Admin consent creates an enterprise app named <strong>IAMAI</strong> in your tenant.
              To remove all access later, delete that enterprise app — nothing else is left behind.
            </li>
          </ul>
          <Button variant="primary" onClick={() => void signIn()}>
            Sign in with Microsoft
          </Button>
        </Card>
      )}
    </StepFrame>
  )
}
