// How IAMAI works (prompt 49 Part 3, target-state §7): Permissions, What IAMAI
// reads, Every check, Baseline packages, Where it runs, Credits, Limits. The
// tables are generated from the same registries the code runs from, so the page
// cannot drift from the product. No page action buttons (the contract allows
// none here).
//
// This is the technical trust surface: the permission set, every endpoint, every
// check, where the public site is served from and where the tenant's data is
// not, and whose work the baseline is. The permissions and reads stay generated
// from GRAPH_SCOPES and COLLECTOR_REGISTRY — there is no second, hand-written
// list of what IAMAI can see.
import { COLLECTOR_REGISTRY } from '../../graph/collect/registry.ts'
import type { CollectorSpec } from '../../graph/collect/registry.ts'
import { REGISTRY, ruleText, citationFor } from '../../validation/rules.ts'
import type { RuleSubject, RuleSeverity } from '../../validation/rules.ts'
import { scopeRows } from '../PermissionsDisclosure.tsx'
import { PERMISSIONS, SIGN_IN_SCOPES } from '../../copy/permissions.ts'
import { SEVERITY, SUBJECT, NEED_LABEL, CITATION, FIELD_PRACTICE } from '../../copy/validation.ts'
import { PACKAGE } from '../../copy/inventory.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { REPO_URL } from '../shell/AppShell.tsx'
import { Chip, DataTable } from '../components/index.ts'
import type { ChipStatus } from '../components/index.ts'

const C = app.how
const SHELL = app.shell

/** Jon Hope's CA Policy Analyzer: a separate project, credited by its canonical repository. */
export const CA_POLICY_ANALYZER = 'https://github.com/Jhope188/ca-policy-analyzer'

/**
 * The commit and day this bundle was built (prompt 40 §24), under Limits: a
 * stale bundle and a fresh one look identical without it.
 */
const BUILD_COMMIT = typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'dev'
const BUILD_DATE = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : ''
const READS = app.how

const SEVERITY_CHIP: Record<RuleSeverity, ChipStatus> = { blocker: 'blocked', warning: 'warning', note: 'neutral' }

export function How() {
  const permissions = scopeRows().filter((r) => !SIGN_IN_SCOPES.includes(r.scope) && r.usedBy.length > 0)
  const lanes: CollectorSpec['lane'][] = ['0', 'A', 'B', 'on-demand']
  const subjects = [...new Set(REGISTRY.map((r) => r.subject))] as RuleSubject[]

  return (
    <section className="surface how">
      <h1>{C.h1}</h1>

      <h2>{C.permissions}</h2>
      <DataTable
        panel
        rows={permissions}
        rowKey={(r) => r.scope}
        columns={[
          // A Graph permission is ONE identifier and does not break mid-word —
          // the fact prompt 47.1 established for the consent disclosure, and the
          // same fact here. `.permission-name` is that rule; the column then
          // takes the width the name needs, and the panel scrolls if the screen
          // cannot give it.
          { key: 'scope', header: PERMISSIONS.columns.permission, render: (r) => <code className="permission-name">{r.scope}</code> },
          { key: 'reads', header: PERMISSIONS.columns.reads, render: (r) => r.reads },
          { key: 'without', header: PERMISSIONS.columns.without, render: (r) => r.without },
        ]}
      />

      <h2>{C.reads}</h2>
      {lanes.map((lane) => (
        <DataTable
            panel
            key={lane}
            caption={READS.lanes[lane]}
            rows={COLLECTOR_REGISTRY.filter((s) => s.lane === lane)}
            rowKey={(s) => s.name}
            columns={[
              { key: 'name', header: READS.columns.data, render: (s) => s.name },
              // A Graph path DOES break — it is long enough that refusing to
              // would push a six-column table past any screen — but not into
              // slivers: the floor keeps a short path on one or two lines and
              // lets the panel's own scroll handle the long ones.
              { key: 'endpoint', header: READS.columns.endpoint, minWidth: '15rem', render: (s) => <code>{s.endpoint}</code> },
              { key: 'version', header: READS.columns.api, render: (s) => <Chip status="neutral">{s.version}</Chip> },
              { key: 'scopes', header: READS.columns.permissions, render: (s) => s.scopes.join(', ') },
              { key: 'gate', header: READS.columns.gate, render: (s) => s.gate },
              { key: 'purpose', header: READS.columns.why, render: (s) => s.purpose },
            ]}
          />
      ))}

      <h2>{C.checks}</h2>
      <p className="reason">{C.checksIntro}</p>
      {subjects.map((subject) => (
        <DataTable
            panel
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
                // The citation's label is a sentence of ordinary words, not a
                // tenant object: with no floor the column collapsed to one word
                // per line. `main.page a[href]` breaks anywhere for a long URL
                // or a Graph path, which is right for those and wrong for this.
                minWidth: '12rem',
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

      {/* Where the public site runs, and where the tenant's data does not (task 016).
          Said once, here: the home page makes its own short read-only / browser /
          public-source claim and does not repeat this sentence. */}
      <h2>{C.hosting}</h2>
      <p className="reason">{C.hostingBody}</p>

      {/* Other people's work, named. The default baseline is Jon Hope's, and
          CA Policy Analyzer is a separate project of his; neither is an
          endorsement of IAMAI, and the note under them says so. */}
      <h2>{C.credits}</h2>
      <p className="reason">{C.creditBaseline}</p>
      <p className="reason">
        <a href={CA_POLICY_ANALYZER} target="_blank" rel="noopener noreferrer">
          {C.creditAnalyzer}
        </a>{' '}
        — {C.creditAnalyzerNote}
      </p>
      <p className="reason">{C.creditsNote}</p>

      <h2>{C.limits}</h2>
      <ul className="sections">
        {C.limitsList.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
        {/* The last line: one of the two places the feedback address appears (the other is the error page). */}
        <li key="feedback">{C.limitsFeedback}</li>
      </ul>
      <p className="reason">
        {BUILD_COMMIT === 'dev' ? (
          fillText(SHELL.footerBuildLocal, { date: absoluteDate(`${BUILD_DATE}T12:00:00.000Z`) })
        ) : (
          <a href={`${REPO_URL}/commit/${BUILD_COMMIT}`} target="_blank" rel="noopener noreferrer" title={SHELL.footerBuildTitle}>
            {fillText(SHELL.footerBuild, { commit: BUILD_COMMIT, date: absoluteDate(`${BUILD_DATE}T12:00:00.000Z`) })}
          </a>
        )}
      </p>
      <p className="reason">{(pages.how as Record<string, string>).noAi}</p>
    </section>
  )
}
