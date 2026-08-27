const COPY: Record<string, { title: string; text: string }> = {
  mapping: {
    title: 'Mapping',
    text: 'This page will resolve every tenant-specific reference the chosen baseline uses — break-glass accounts, exclusion groups, trusted locations, custom authentication strengths — with auto-suggestions, validation of each pick (cloud-only, correctly excluded, methods registered, not dynamic-swept), and a Phase 0 step generated for anything that does not exist yet.',
  },
  coverage: {
    title: 'Coverage',
    text: 'This page will show intent coverage: each baseline policy compiled to intents, and whether the tenant’s effective enabled policies cover each intent — enforced, partial (narrower scope, broad exclusions, report-only), or absent — with statements like "no policy named X, but Y and Z cover it, except group G is excluded from both." Naming and consolidation findings appear separately.',
  },
  roadmap: {
    title: 'Roadmap',
    text: 'This page will hold the plan itself: ordered phases from dependencies, each step with its why, auto-checked prerequisites, affected population with drill-down export, portal path and exact report-only JSON, pilot group, report-only exit criteria, rollback, and user-comms template — printable, and saveable as a single self-contained plan file that re-imports.',
  },
  licensing: {
    title: 'Licensing guide',
    text: 'This page will show what your licence enables and how coverage is scored against the best implementation your tier allows — plus a separate educational catalog of what higher tiers add, grounded in numbers from your own tenant. Nothing is locked or marked accepted-risk because of licence.',
  },
}

export function PlaceholderPage({ page }: { page: keyof typeof COPY }) {
  const c = COPY[page]
  return (
    <section>
      <h2>{c.title}</h2>
      <p className="notice">{c.text}</p>
    </section>
  )
}
