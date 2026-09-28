// The tenant-data guard. CLAUDE.md: never commit tenant-derived data (UPNs,
// object ids, tenant GUIDs). The owner's own test tenant is the one most likely
// to leak, because every live walk and audit reads it, so this fails when a
// tracked file carries one of its addresses or a value on the fingerprint list.
//
// - Any address at the tenant's onmicrosoft.com domain fails.
// - Any address at the product domain fails, except the public feedback address.
// - Any GUID, email address, address domain, domain, hyphenated name or run of six
//   or more letters and digits whose SHA-256 (lower-cased, trimmed) is in
//   scripts/tenant-fingerprints.json fails, so a tenant's domain or name is caught
//   standing alone as well as in an address: a listed domain inside a longer host
//   (mail.DOMAIN), after an @ or a %40; a listed name of six or more letters and
//   digits before a full stop, inside another host (NAME.sharepoint.com), in a file
//   name. A shorter name is caught only as part of a listed domain. A tracked file's
//   path is read the same way. The list holds hashes, so the guard never publishes
//   the values it blocks, and neither does its output: a finding names the file (a
//   path's matching segments replaced), line and rule, never the value.
//
// Run by CI (Type and unit checks) and by `npm run verify`. The rules are a pure
// function so src/testing/tenantGuard.test.ts can prove them.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const FINGERPRINTS_FILE = 'scripts/tenant-fingerprints.json'
export const TENANT_DOMAIN = 'getiamai.onmicrosoft.com'
export const PRODUCT_DOMAIN = 'getiamai.com'
export const ALLOWED_ADDRESSES = ['feedback@getiamai.com']

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
// A domain or a tenant name standing alone: a fingerprinted one is a hit wherever it
// appears, not only inside an address (security audit S8, 2026-09-27: a committed doc
// named the owner's tenant bare; review, 2026-09-28: a name before a full stop, inside
// a SharePoint host or after %40 still passed). A dotted run is checked whole and by
// each parent domain; a hyphenated name whole; and every run of letters and digits.
const RUN = /[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi
const HYPHENATED = /[a-z0-9]+(?:-[a-z0-9]+)+/gi
const WORD = /[a-z0-9]{6,}/gi

/**
 * The fingerprint of one value: SHA-256 of it trimmed and lower-cased.
 * @param {string} value
 * @returns {string}
 */
export function fingerprint(value) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

/**
 * Every tenant-data finding in one text, one per token, in line order.
 * @param {string} text
 * @param {ReadonlySet<string>} fingerprints
 * @returns {{ line: number, rule: 'tenant-domain' | 'product-domain' | 'fingerprint' }[]}
 */
export function findingsIn(text, fingerprints) {
  /** @type {{ line: number, rule: 'tenant-domain' | 'product-domain' | 'fingerprint' }[]} */
  const findings = []
  const listed = (/** @type {string} */ value) => fingerprints.has(hashOf(value.toLowerCase()))
  const lines = text.split('\n')
  lines.forEach((raw, i) => {
    const line = i + 1
    const content = raw.replace(/%40/gi, '@')
    // One fingerprint finding per line, however many of its tokens are listed.
    let hit = false
    for (const [token] of content.matchAll(EMAIL)) {
      const address = token.toLowerCase()
      const domain = address.slice(address.lastIndexOf('@') + 1)
      if (domain === TENANT_DOMAIN || domain.endsWith(`.${TENANT_DOMAIN}`)) findings.push({ line, rule: 'tenant-domain' })
      else if ((domain === PRODUCT_DOMAIN || domain.endsWith(`.${PRODUCT_DOMAIN}`)) && !ALLOWED_ADDRESSES.includes(address)) findings.push({ line, rule: 'product-domain' })
      else if (fingerprints.size > 0 && listed(address)) hit = true
    }
    if (fingerprints.size > 0) {
      for (const [token] of content.matchAll(GUID)) if (!hit && listed(token)) hit = true
      for (const [run] of content.matchAll(RUN)) {
        const labels = run.toLowerCase().split('.')
        for (let k = 0; k < labels.length - 1 && !hit; k++) if (listed(labels.slice(k).join('.'))) hit = true
      }
      for (const [token] of content.matchAll(HYPHENATED)) if (!hit && listed(token)) hit = true
      for (const [token] of content.matchAll(WORD)) if (!hit && listed(token)) hit = true
    }
    if (hit) findings.push({ line, rule: 'fingerprint' })
  })
  return findings
}

/** Hashes already taken this run: most tokens repeat across the tree. */
const HASHES = new Map()
/** @param {string} value lower-cased */
function hashOf(value) {
  let h = HASHES.get(value)
  if (h === undefined) {
    h = fingerprint(value)
    HASHES.set(value, h)
  }
  return h
}

/**
 * The committed fingerprint list.
 * @param {string} [cwd]
 * @returns {Set<string>}
 */
export function loadFingerprints(cwd = process.cwd()) {
  const raw = JSON.parse(readFileSync(path.join(cwd, FINGERPRINTS_FILE), 'utf8'))
  return new Set(raw.sha256.map((/** @type {string} */ h) => h.toLowerCase()))
}

/**
 * The findings in a tracked file's path, one per rule. The path it reports has every
 * segment that holds a finding replaced, so the output never names the value either.
 * @param {string} file
 * @param {ReadonlySet<string>} fingerprints
 * @returns {{ file: string, line: number, rule: string }[]}
 */
export function pathFindings(file, fingerprints) {
  const rules = [...new Set(findingsIn(file, fingerprints).map((f) => f.rule))]
  if (rules.length === 0) return []
  const shown = file.split('/').map((segment) => (findingsIn(segment, fingerprints).length > 0 ? '<fingerprinted>' : segment)).join('/')
  return rules.map((rule) => ({ file: shown, line: 0, rule: `${rule} (path)` }))
}

/**
 * Every finding across the tracked files, binaries skipped.
 * @param {string} [cwd]
 * @returns {{ file: string, line: number, rule: string }[]}
 */
export function scanTracked(cwd = process.cwd()) {
  const fingerprints = loadFingerprints(cwd)
  const files = execFileSync('git', ['ls-files', '-z'], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter((f) => f !== '')
  /** @type {{ file: string, line: number, rule: string }[]} */
  const found = []
  for (const file of files) {
    found.push(...pathFindings(file, fingerprints))
    let bytes
    try {
      bytes = readFileSync(path.join(cwd, file))
    } catch {
      continue // deleted in the working tree, or a submodule
    }
    if (bytes.includes(0)) continue // binary
    for (const f of findingsIn(bytes.toString('utf8'), fingerprints)) found.push({ file, ...f })
  }
  return found
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const found = scanTracked()
  if (found.length > 0) {
    console.error(`tenant guard: ${found.length} tenant-derived value(s) in tracked files`)
    for (const f of found) console.error(`  ${f.file}:${f.line} · ${f.rule}`)
    console.error('Replace them with placeholders (admin@contoso.com, 00000000-0000-0000-0000-00000000000N, <tenant-id>).')
    process.exit(1)
  }
  console.log('tenant guard: no tenant-derived values in tracked files')
}
