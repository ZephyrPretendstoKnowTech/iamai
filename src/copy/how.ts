// How IAMAI works (prompt 49 Part 3, target-state §7): one reference page with
// Permissions, What IAMAI reads, Every check, Baseline packages and Limits. The
// tables come from the same registries the code runs from; this holds only the
// section intros and the five limits (SPEC §5, in product voice).
export const HOW = {
  title: 'How IAMAI works',
  permissions: 'Permissions',
  reads: 'What IAMAI reads',
  checks: 'Every check',
  checksIntro: 'Every check IAMAI runs, generated from the rules the code runs from.',
  packages: 'Baseline packages',
  limits: 'Limits',
  limitsList: [
    'IAMAI approximates how Microsoft evaluates a sign-in; report-only is the truth. Some conditions, like device filters and token state, it cannot reproduce.',
    'Without Entra ID P1 there is no impact analysis; the plan is licence, then security defaults, then Conditional Access.',
    'Sign-in history shows behaviour under today\'s policy; it cannot see who would register MFA when first prompted.',
    'There is no server: no scheduled re-scans, no alerts, no state shared across devices.',
    'A sign-in session lasts about a day; the plan file never depends on it, so save the plan to keep it.',
  ],
} as const
