// What the consent screen will ask for, and how to take it back (prompt 34 §1).
//
// Generated from the two lists the code actually runs from: `GRAPH_SCOPES` is
// what consent requests, and `COLLECTOR_REGISTRY` is what each scope is spent
// on. Neither can drift from the other without `permissions.test.ts` failing.
import { GRAPH_SCOPES } from '../graph/scopes.ts'
import { COLLECTOR_REGISTRY } from '../graph/collect/registry.ts'
import { PERMISSIONS as C, SCOPE_COPY, SIGN_IN_SCOPES } from '../copy/permissions.ts'
import { DataTable, ExpandCard } from './components/index.ts'

export type ScopeRow = { scope: string; reads: string; without: string; usedBy: string[] }

/** One row per requested scope, with the collectors that spend it. */
export function scopeRows(): ScopeRow[] {
  return GRAPH_SCOPES.map((scope) => {
    const copy = SCOPE_COPY[scope]
    return {
      scope,
      reads: copy?.reads ?? '',
      without: copy?.without ?? '',
      usedBy: COLLECTOR_REGISTRY.filter((s) => s.scopes.includes(scope)).map((s) => s.name),
    }
  })
}

export function PermissionsDisclosure({ compact = false }: { compact?: boolean }) {
  const rows = scopeRows()
  // Item 11 (P1): a permission nothing calls is not part of the working set, and
  // listing it there presents an unused scope as one the tool relies on. It sits
  // in its own group, with the reason and the recommendation, until the app
  // registration drops it.
  const tenantScopes = rows.filter((r) => !SIGN_IN_SCOPES.includes(r.scope) && r.usedBy.length > 0)
  const unused = rows.filter((r) => !SIGN_IN_SCOPES.includes(r.scope) && r.usedBy.length === 0)
  const signIn = rows.filter((r) => SIGN_IN_SCOPES.includes(r.scope))

  const body = (
    <>
      <p>{C.intro}</p>
      <p>{C.readOnly}</p>
      <DataTable
        rows={tenantScopes}
        rowKey={(r) => r.scope}
        columns={[
          { key: 'permission', header: C.columns.permission, render: (r) => <code>{r.scope}</code> },
          {
            key: 'reads',
            header: C.columns.reads,
            render: (r) => (
              <>
                {r.reads}
                <div className="reason">{C.usedFor(r.usedBy)}</div>
              </>
            ),
          },
          { key: 'without', header: C.columns.without, render: (r) => r.without },
        ]}
      />
      {unused.length > 0 && (
        <>
          <h4>{C.unusedGroup}</h4>
          {C.unusedNote.map((line) => (
            <p key={line} className="reason">
              {line}
            </p>
          ))}
          <DataTable
            rows={unused}
            rowKey={(r) => r.scope}
            columns={[
              { key: 'permission', header: C.columns.permission, render: (r) => <code>{r.scope}</code> },
              { key: 'reads', header: C.columns.reads, render: (r) => r.reads },
              { key: 'without', header: C.columns.without, render: (r) => r.without },
            ]}
          />
        </>
      )}
      <h4>{C.signInGroup}</h4>
      <DataTable
        rows={signIn}
        rowKey={(r) => r.scope}
        columns={[
          { key: 'permission', header: C.columns.permission, render: (r) => <code>{r.scope}</code> },
          { key: 'reads', header: C.columns.reads, render: (r) => r.reads },
          { key: 'without', header: C.columns.without, render: (r) => r.without },
        ]}
      />
      <p>{C.consentCreates}</p>
      <h4>{C.removalTitle}</h4>
      <ol className="sections">
        {C.removal.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <p>{C.removalNote}</p>
      {!compact && (
        <p>
          <a href="#/reads">{C.fullList}</a>
        </p>
      )}
    </>
  )

  if (compact) return <div>{body}</div>
  return (
    <ExpandCard summary={C.title} open={false}>
      {body}
    </ExpandCard>
  )
}
