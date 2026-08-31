// Naming policies and groups (naming-and-consolidation.md §1, prompt 43 Part 1).
//
// Said once, and linked from every proposed name in the app, so the reasoning
// behind a suggested name is one click away instead of repeated beside each one.
//
// The worked examples are drawn from the tenant in front of the reader: the
// convention IAMAI read from their own policies, and the names it would propose
// in it. Where there is no convention to read, the page says so and labels the
// documented pattern as a proposal rather than presenting it as a match.
import { NAMING } from '../../copy/naming.ts'
import { detectConvention, proposeName, usable } from '../../roadmap/convention.ts'
import { Card, Chip, LinkButton } from '../components/index.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'

export function NamingPage({ scan = null }: { scan?: { snapshot: TenantSnapshot } | null }) {
  // The tenant's own policy names, which is what the convention is read from.
  const policyNames = ((scan?.snapshot.config.caPolicies?.rows ?? []) as { displayName?: string }[])
    .map((p) => String(p.displayName ?? '').trim())
    .filter(Boolean)
  const convention = detectConvention(policyNames)
  const strong = usable(convention)
  const agreement = Math.round((convention?.agreement ?? 0) * 100)

  const shape = strong
    ? [convention.numbered ? `${convention.prefix}<n>` : convention.prefix, ...Array.from({ length: Math.max(1, convention.segments - 1) }, () => '<...>')]
        .filter(Boolean)
        .join(convention.separator)
    : NAMING.policyPattern

  // Each example is threaded through the ones before it, so a numbered series
  // advances: this plan creates three objects, and it would not name them all
  // CA004.
  const taken = [...policyNames]
  const example = (parts: { prefix: string; rest: string[]; collapsed: string }) => {
    const p = proposeName(convention, taken, parts)
    taken.push(p.name)
    return p
  }

  const policy = example({ prefix: 'CA', rest: ['Global', 'Require', 'Phishing-resistant MFA'], collapsed: 'Require phishing-resistant MFA for admins' })
  const group = example({ prefix: 'CA', rest: ['Exclusion', 'Break-glass'], collapsed: 'Break-glass exclusions' })
  const location = example({ prefix: 'CA', rest: ['Trusted', 'Head office'], collapsed: 'Trusted head office' })

  return (
    <section>
      <h2>{NAMING.title}</h2>
      <p>{NAMING.does}</p>

      <h3>{NAMING.whyTitle}</h3>
      {NAMING.why.map((p, i) => (
        <p key={i}>{p}</p>
      ))}

      <h3>{NAMING.policyTitle}</h3>
      <pre className="code-block">{NAMING.policyPattern}</pre>
      <ul className="sections">
        {NAMING.policyParts.map((p) => (
          <li key={p.part}>
            <strong>{p.part}</strong>. {p.text}
          </li>
        ))}
      </ul>
      <ul className="sections">
        {NAMING.policyExamples.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>

      <h3>{NAMING.groupTitle}</h3>
      <pre className="code-block">{NAMING.groupPattern}</pre>
      <ul className="sections">
        {NAMING.groupExamples.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <p className="reason">{NAMING.groupNote}</p>

      <h3>{NAMING.locationTitle}</h3>
      <pre className="code-block">{NAMING.locationPattern}</pre>
      <ul className="sections">
        {NAMING.locationExamples.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>

      <Card title={NAMING.detectedTitle}>
        {/* Four branches: nothing to read, nothing agrees, a convention, and the
            shape it takes. Never a guess presented as a match. */}
        <p>
          {policyNames.length === 0
            ? NAMING.detectedNone
            : strong
              ? NAMING.detectedStrong(agreement, convention.sampled, shape)
              : NAMING.detectedWeak(agreement, policyNames.length)}
        </p>
        <h3>{NAMING.workedTitle}</h3>
        <ul className="sections">
          <li>
            <strong>{NAMING.workedPolicy}</strong>: {policy.name}{' '}
            <Chip status={policy.matchesTenant ? 'done' : 'neutral'}>{policy.matchesTenant ? NAMING.matchedChip : NAMING.proposalChip}</Chip>
          </li>
          <li>
            <strong>{NAMING.workedGroup}</strong>: {group.name}{' '}
            <Chip status={group.matchesTenant ? 'done' : 'neutral'}>{group.matchesTenant ? NAMING.matchedChip : NAMING.proposalChip}</Chip>
          </li>
          <li>
            <strong>{NAMING.workedLocation}</strong>: {location.name}{' '}
            <Chip status={location.matchesTenant ? 'done' : 'neutral'}>{location.matchesTenant ? NAMING.matchedChip : NAMING.proposalChip}</Chip>
          </li>
        </ul>
        {!strong && <p className="reason">{NAMING.proposalNote}</p>}
      </Card>

      <h3>{NAMING.renameTitle}</h3>
      <p>{NAMING.renameNote}</p>

      <p className="step-next">
        <LinkButton href="#/plan">{NAMING.next}</LinkButton>
      </p>
    </section>
  )
}
