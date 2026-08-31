// One fingerprint of the copy and UI source, used by two callers that must
// agree: `npm run inventory` stamps it into the generated inventory, and the
// lint test recomputes it to refuse a stale one.
//
// It exists in one file because it lived in two, and two copies of a hash
// function is two chances to disagree. It sits at the src root rather than
// under src/ui, so it is not an input to the hash it computes.
//
// It hashes normalised text, not raw bytes. The first version hashed bytes, and
// that broke CI on every commit for a week: `src/ui/components/usePrinting.ts`
// had CRLF endings in a Windows working tree and LF in the committed blob, so
// the fingerprint stamped on one machine could never match the one computed on
// another. `git status` was clean throughout, correctly — .gitattributes says
// `* text=auto eol=lf`, so git had already decided line endings are not part of
// a file's identity.
//
// A fingerprint whose job is "has the source changed since this was generated"
// has to answer that question the same way git does. Anything it counts that
// git does not is a difference nobody made, and it will fire on the next person
// to open the project on a different platform.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** The directories whose content the inventory is generated from. */
export const FINGERPRINTED = ['src/copy', 'src/ui']
/**
 * Single files that also decide what the inventory holds. The surface contract
 * chooses which surfaces are walked, how each is reached, and what counts as a
 * row, so a change to it has to invalidate the inventory too (prompt 46 Part 1).
 */
export const FINGERPRINTED_FILES = ['docs/qa/page-contracts.json']

/**
 * Text as git stores it, so the same commit hashes the same on every platform.
 *
 * Three differences Windows editors introduce that git normalises away, and
 * that a byte-based hash would therefore see as changes:
 *
 * - CRLF line endings (the one that actually broke)
 * - a UTF-8 byte-order mark, which Notepad and some PowerShell redirections add
 * - a missing or doubled final newline
 */
export function normaliseSource(raw: Buffer | string): string {
  let text = typeof raw === 'string' ? raw : raw.toString('utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return text.replace(/\n+$/, '') + '\n'
}

/** Every fingerprinted source file, sorted, with forward slashes. */
export function sourceFiles(): string[] {
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      // Tests are not fingerprinted: a test changing must not invalidate the
      // inventory, which describes rendered copy.
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p)
    }
  }
  for (const dir of FINGERPRINTED) walk(dir)
  files.push(...FINGERPRINTED_FILES)
  // Sorted on the normalised path, so the order does not depend on the
  // platform's path separator either.
  return files.map((f) => f.split('\\').join('/')).sort()
}

export function sourceFingerprint(): string {
  const h = createHash('sha256')
  for (const f of sourceFiles()) h.update(f).update(normaliseSource(readFileSync(f)))
  return h.digest('hex').slice(0, 16)
}
