// Every check IAMAI runs, generated from the rule registry the code runs from
// (validation-rules.md §5). Documentation and proof in one page: a rule that
// is not in the registry is not on this page, and a rule that is cannot be
// dropped without the regression test failing.
import { REGISTRY, citationFor, ruleText } from '../../validation/rules.ts'
import type { RuleSeverity, RuleSubject } from '../../validation/rules.ts'
import { CHECKS_PAGE, CITATION, FIELD_PRACTICE, NEED_LABEL, SEVERITY, SEVERITY_WHY, SUBJECT } from '../../copy/validation.ts'
import { Card, Chip, DataTable, LinkButton } from '../components/index.ts'
import type { ChipStatus } from '../components/index.ts'

const SEVERITY_CHIP: Record<RuleSeverity, ChipStatus> = { blocker: 'blocked', warning: 'warning', note: 'neutral' }

export function ChecksPage() {
  const subjects = [...new Set(REGISTRY.map((r) => r.subject))] as RuleSubject[]
  const counts = {
    blocker: REGISTRY.filter((r) => r.severity === 'blocker').length,
    warning: REGISTRY.filter((r) => r.severity === 'warning').length,
    note: REGISTRY.filter((r) => r.severity === 'note').length,
  }
  return (
    <section>
      <h2>{CHECKS_PAGE.title}</h2>
      <p>{CHECKS_PAGE.intro}</p>
      <p className="reason">{CHECKS_PAGE.counts(counts.blocker, counts.warning, counts.note)}</p>
      <p className="reason">{CHECKS_PAGE.unknownRule}</p>
      <p className="reason">{CHECKS_PAGE.sources}</p>
      <p className="reason">{CHECKS_PAGE.bySubject(subjects.length)}</p>
      {subjects.map((subject) => {
        const rows = REGISTRY.filter((r) => r.subject === subject)
        const mix = CHECKS_PAGE.sectionCount(
          rows.filter((r) => r.severity === 'blocker').length,
          rows.filter((r) => r.severity === 'warning').length,
          rows.filter((r) => r.severity === 'note').length,
        )
        return (
          <div key={subject}>
            <h3>{SUBJECT[subject] ?? subject}</h3>
            <p className="reason">{mix}</p>
            <DataTable
              rows={rows}
              rowKey={(r) => r.id}
              columns={[
                { key: 'what', header: CHECKS_PAGE.columns.what, render: (r) => ruleText(r.id).what },
                {
                  key: 'severity',
                  header: CHECKS_PAGE.columns.severity,
                  minWidth: '9rem',
                  render: (r) => (
                    <Chip status={SEVERITY_CHIP[r.severity]} title={SEVERITY_WHY[r.severity]}>
                      {SEVERITY[r.severity]}
                    </Chip>
                  ),
                },
                { key: 'why', header: CHECKS_PAGE.columns.why, render: (r) => ruleText(r.id).why },
                {
                  key: 'needs',
                  header: CHECKS_PAGE.columns.needs,
                  render: (r) => (r.needs.length === 0 ? CHECKS_PAGE.needsNone : r.needs.map((n) => NEED_LABEL[n] ?? n).join(', ')),
                },
                {
                  // A check with no source is a check nobody has verified
                  // (audit-program §6); field practice says so in as many words.
                  key: 'source',
                  header: CITATION.source,
                  render: (r) => {
                    const c = citationFor(r.id)
                    if (c === undefined) return null
                    if (c === FIELD_PRACTICE) return <span className="reason">{CITATION.fieldPracticeShort}</span>
                    return (
                      <a href={c.url} target="_blank" rel="noopener noreferrer">
                        {c.label}
                      </a>
                    )
                  },
                },
              ]}
            />
          </div>
        )
      })}
      {REGISTRY.length === 0 && <Card>{CHECKS_PAGE.empty}</Card>}
      <p className="step-next">
        <LinkButton href="#/mapping">{CHECKS_PAGE.next}</LinkButton>
      </p>
    </section>
  )
}
