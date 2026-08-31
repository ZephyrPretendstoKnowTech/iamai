// The product's name, in one place (prompt 47.1 Part 4, target-state §2). The
// page title, the wordmark, the home-page row and the descriptor read from
// here; nothing else spells the name out.
export const PRODUCT = {
  /** The family the tools belong to; the home page's wordmark. */
  family: 'IAMAI',
  /** The tool: header wordmark, README, SPEC, the home-page row. */
  name: 'IAMAI Planner',
  /** What it is, after the name in the page title. */
  descriptor: 'Conditional Access rollout planner',
  /** One sentence, on Connect under the heading. */
  tagline: 'Plan the journey to your Conditional Access baseline.',
} as const
