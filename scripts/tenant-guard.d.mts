// Types for scripts/tenant-guard.mjs so its rules can be run from a TypeScript
// test (src/testing/tenantGuard.test.ts) as well as from CI. The module itself
// stays plain ESM: it is a CI script, not source.
export type TenantRule = 'tenant-domain' | 'product-domain' | 'fingerprint'

export declare const FINGERPRINTS_FILE: string
export declare const TENANT_DOMAIN: string
export declare const PRODUCT_DOMAIN: string
export declare const ALLOWED_ADDRESSES: string[]
export declare function fingerprint(value: string): string
export declare function findingsIn(text: string, fingerprints: ReadonlySet<string>): { line: number; rule: TenantRule }[]
export declare function loadFingerprints(cwd?: string): Set<string>
export declare function scanTracked(cwd?: string): { file: string; line: number; rule: string }[]
