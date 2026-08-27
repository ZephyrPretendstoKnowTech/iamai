import type { AccountInfo } from '@azure/msal-browser'
import { signIn, signOut } from '../../graph/msal.ts'

export function ConnectPage({ account }: { account: AccountInfo | null }) {
  if (account) {
    return (
      <section>
        <h2>Connected</h2>
        <p>
          Signed in as <strong>{account.username}</strong> (tenant {account.tenantId}).
        </p>
        <p>
          Head to <a href="#/readiness">Readiness</a> to scan the tenant, or{' '}
          <a href="#/baseline">Baseline</a> to load the target policy set.
        </p>
        <p>
          <button onClick={() => void signOut()}>Sign out</button>
        </p>
      </section>
    )
  }
  return (
    <section>
      <h2>Connect your tenant</h2>
      <ul>
        <li>
          IAMAI is read-only. It never creates, edits, or deletes anything in your tenant — not
          even report-only policies.
        </li>
        <li>
          Everything runs in your browser. No server, no telemetry: review the code, then connect.
        </li>
        <li>
          Admin consent creates an enterprise app named <strong>IAMAI</strong> in your tenant. To
          remove all access later, delete that enterprise app — nothing else is left behind.
        </li>
      </ul>
      <button onClick={() => void signIn()}>Sign in with Microsoft</button>
    </section>
  )
}
