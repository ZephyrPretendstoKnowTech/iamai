// Types for scripts/smokeEvidence.mjs so its helpers can be run from a TypeScript
// test (src/testing/smokeEvidence.test.ts) as well as from the smoke.
export declare const CDP_DEADLINE_MS: number
export declare function withDeadline<T>(promise: Promise<T>, ms: number, what: string): Promise<T>
export declare function pageEvidence(input: {
  /** The page's text; null leaves the page-text block out. */
  body: string | null
  pageErrors: readonly string[]
  logErrors: readonly string[]
  navigation: { url: string; errorText?: string | null } | null
  viteTail: string | null | undefined
}): string
