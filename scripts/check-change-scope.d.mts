// Types for scripts/check-change-scope.mjs so its rules can be run from a
// TypeScript test (src/testing/changeScope.test.ts) as well as from CI. The
// module itself stays plain ESM: it is a CI script, not source.
export type ScopedCommit = { sha: string; message: string; files: string[] }

export declare const SNAPSHOT_PREFIX: string
export declare const PACKAGE_PREFIX: string
export declare const SOURCE_PREFIX: string
export declare const REGISTRY: string
export declare const TAG: string
export declare function violationsOf(commit: ScopedCommit): string[]
export declare function commitsInRange(range: string, cwd?: string): ScopedCommit[]
