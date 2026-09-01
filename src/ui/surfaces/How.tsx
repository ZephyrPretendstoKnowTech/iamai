// How IAMAI works (prompt 49 Part 3, target-state §7): Permissions, What IAMAI
// reads, Every check, Baseline packages, Limits. The tables are generated from
// the same registries the code runs from, so the page cannot drift from the
// product. No page action buttons (the contract allows none here).
import { COLLECTOR_REGISTRY } from '../../graph/collect/registry.ts'
import type { CollectorSpec } from '../../graph/collect/registry.ts'
import { REGISTRY, ruleText, citationFor } from '../../validation/rules.ts'
import type { RuleSubject, RuleSeverity } from '../../validation/rules.ts'
import { scopeRows } from '../PermissionsDisclosure.tsx'
import { PERMISSIONS, SIGN_IN_SCOPES } from '../../copy/permissions.ts'
import { READS } from '../../copy/pages.ts'
import { ACCESS } from '../../copy/access.ts'
import { ROLE_FOR_SCOPE } from '../../graph/collect/roles.ts'
import { SEVERITY, SUBJECT, NEED_LABEL, CITATION, FIELD_PRACTICE } from '../../copy/validation.ts'
import { PACKAGE } from '../../copy/inventory.ts'
import { HOW as C } from '../../copy/how.ts'
import { Chip, DataTable } from '../components/index.ts'
import type { ChipStatus } from '../components/index.ts'

const SEVERITY_CHIP: Record<RuleSeverity, ChipStatus> = { blocker: 'blocked', warning: 'warning', note: 'neutral' }

export function How() {
  const permissions = scopeRows().filter((r) => !SIGN_IN_SCOPES.includes(r.scope) && r.usedBy.length > 0)
  const lanes: CollectorSpec['lane'][] = ['0', 'A', 'B', 'on-demand']
  const subjects = [...new Set(REGISTRY.map((r) => r.subject))] as RuleSubject[]

  return (
    <section className="surface page-wide how">
      <h1>{C.title}</h1>

      <h2>{C.permissions}</h2>
      <DataTable
        rows={permissions}
        rowKey={(r) => r.scope}
        columns={[
          { key: 'scope', header: PERMISSIONS.columns.permission, render: (r) => <code>{r.scope}</code> },
          { key: 'reads', header: PERMISSIONS.columns.reads, render: (r) => r.reads },
          { key: 'without', header: PERMISSIONS.columns.without, render: (r) => r.without },
        ]}
      />

      <h2>{C.reads}</h2>
      {lanes.map((lane) => (
        <DataTable
            key={lane}
            caption={READS.lanes[lane]}
            rows={COLLECTOR_REGISTRY.filter((s) => s.lane === lane)}
            rowKey={(s) => s.name}
            columns={[
              { key: 'name', header: READS.columns.data, render: (s) => s.name },
              { key: 'endpoint', header: READS.columns.endpoint, render: (s) => <code>{s.endpoint}</code> },
              { key: 'version', header: READS.columns.api, render: (s) => <Chip status="neutral">{s.version}</Chip> },
              { key: 'scopes', header: READS.columns.permissions, render: (s) => s.scopes.join(', ') },
              { key: 'role', header: ACCESS.roleColumn, render: (s) => ACCESS.roleFor([...new Set(s.scopes.map((sc) => ROLE_FOR_SCOPE[sc]?.least).filter((r): r is string => r !== undefined))]) },
              { key: 'gate', header: READS.columns.gate, render: (s) => s.gate },
              { key: 'purpose', header: READS.columns.why, render: (s) => s.purpose },
            ]}
          />
      ))}

      <h2>{C.checks}</h2>
      <p className="reason">{C.checksIntro}</p>
      {subjects.map((subject) => (
        <DataTable
            key={subject}
            caption={SUBJECT[subject] ?? subject}
            rows={REGISTRY.filter((r) => r.subject === subject)}
            rowKey={(r) => r.id}
            columns={[
              { key: 'what', header: 'What it looks for', render: (r) => ruleText(r.id).what },
              { key: 'severity', header: 'If it fails', render: (r) => <Chip status={SEVERITY_CHIP[r.severity]}>{SEVERITY[r.severity]}</Chip> },
              { key: 'why', header: 'Why it matters', render: (r) => ruleText(r.id).why },
              { key: 'needs', header: 'Needs', render: (r) => (r.needs.length === 0 ? 'nothing' : r.needs.map((n) => NEED_LABEL[n] ?? n).join(', ')) },
              {
                key: 'source',
                header: CITATION.source,
                render: (r) => {
                  const c = citationFor(r.id)
                  if (!c || c === FIELD_PRACTICE) return CITATION.fieldPracticeShort
                  return (
                    <a href={c.url} target="_blank" rel="noopener noreferrer">
                      {c.label}
                    </a>
                  )
                },
              },
            ]}
          />
      ))}

      <h2 id="package">{C.packages}</h2>
      <p className="reason">{PACKAGE.does}</p>
      <ol className="sections">
        <li>{PACKAGE.way1Title}</li>
        <li>{PACKAGE.way2Title}</li>
        <li>{PACKAGE.way3Title}</li>
      </ol>
      <pre className="mono">{PACKAGE.way2Commands.join('\n')}</pre>

      <h2>{C.limits}</h2>
      <ul className="sections">
        {C.limitsList.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </section>
  )
}
