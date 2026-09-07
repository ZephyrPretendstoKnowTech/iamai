// Types for scripts/walkContent.mjs so the content half of the walk can be run
// from a TypeScript test (src/content/contentChecks.test.ts) as well as from
// walk.mjs. The module itself stays plain ESM: it is a walk script, not source.
export type WalkFinding = { level: 'P0' | 'P1' | 'P2'; text: string }

export declare function strings(node: unknown, path?: string, out?: [string, string][]): [string, string][]
export declare const ACCEPTANCE: readonly Record<string, unknown>[]
export declare function contentLearnUrls(content: unknown): string[]
export declare function contentFindings(content: unknown, pinned?: unknown, contracts?: unknown): WalkFinding[]
export declare function probe(href: string): Promise<{ status?: number; error?: string }>
