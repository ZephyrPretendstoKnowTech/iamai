// What the smoke prints when a page it went to never drew, and the deadline on
// every DevTools call it makes. Plain ESM, so scripts/smoke.mjs runs it with no
// build step; its types are in smokeEvidence.d.mts for the unit test
// (src/testing/smokeEvidence.test.ts).
//
// Why it exists: CI's smoke found no Plan at #/plan on some runs ("main=(no
// main)") and hung on another until the job's 15-minute limit, and neither left
// anything to read. The page's own text, what it threw, what the browser
// refused to load and what the server said are the evidence for which of a
// throw, a stuck load or a dead request it was.

/** How long one DevTools call may go unanswered before the smoke names it and stops waiting. */
export const CDP_DEADLINE_MS = 60_000

/**
 * The promise, or a rejection naming what did not answer within `ms`. A renderer
 * whose main thread never comes back, or a navigation whose request never gets an
 * answer, otherwise leaves the smoke waiting until the job is cancelled, and the
 * log ends at the last check that passed.
 */
export function withDeadline(promise, ms, what) {
  let timer
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not answer within ${Math.round(ms / 1000)} s`)), ms)
  })
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer))
}

const BODY_CHARS = 400
const LAST_ERRORS = 6
const ERROR_CHARS = 600

// Every line of an entry indented, a multi-line stack included, so the block reads as one.
const block = (title, lines) => [`  --- ${title} ---`, ...(lines.length > 0 ? lines : ['(none)']).map((l) => `  ${String(l).replace(/\n/g, '\n  ')}`)].join('\n')

/**
 * The evidence for a page that did not draw, as printed lines: the page's text
 * (the first 400 characters, whitespace collapsed; left out when `body` is null,
 * as at the end of a run, when the page on screen is not the one that failed),
 * the last few errors it threw or logged, the browser's own load errors, the
 * last navigation's result, and the server's recent output (the smoke's vite preview).
 */
export function pageEvidence({ body, pageErrors, logErrors, navigation, viteTail }) {
  const text = String(body ?? '').replace(/\s+/g, ' ').trim().slice(0, BODY_CHARS)
  return [
    ...(body === null ? [] : [block('page text (first 400 characters)', text ? [text] : ['(empty)'])]),
    block(`page errors (${pageErrors.length})`, pageErrors.slice(-LAST_ERRORS).map((e) => String(e).slice(0, ERROR_CHARS))),
    block(`browser load errors (${logErrors.length})`, logErrors.slice(-LAST_ERRORS).map((e) => String(e).slice(0, ERROR_CHARS))),
    block('last navigation', navigation ? [`${navigation.url} -> ${navigation.errorText || 'committed'}`] : []),
    block('server', String(viteTail ?? '').split('\n').filter((l) => l.trim() !== '')),
  ].join('\n')
}
