import type { AccountInfo } from '@azure/msal-browser'
import { signIn, signOut } from '../../graph/msal.ts'
import { REPO_URL, StepFrame } from '../shell/AppShell.tsx'

export function ConnectPage({ account, tenantName }: { account: AccountInfo | null; tenantName: string | null }) {
  return (
    <StepFrame
      title="Connect"
      does="Signs in read-only so IAMAI can read your tenant's configuration and inventory."
      needs={[{ met: true, text: 'a Global Administrator or Global Reader account' }]}
      next={account ? 'baseline' : undefined}
      nextLabel="Baseline"
    >
      {account ? (
        <div className="card">
          <p>
            Signed in to <strong>{tenantName ?? 'your tenant'}</strong> as {account.username}
          </p>
          <p className="sub">tenant ID {account.tenantId}</p>
          <p>
            <button onClick={() => void signOut()}>Sign out</button>
          </p>
        </div>
      ) : (
        <div className="card">
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
          <button className="primary" onClick={() => void signIn()}>
            Sign in with Microsoft
          </button>
        </div>
      )}
    </StepFrame>
  )
}
