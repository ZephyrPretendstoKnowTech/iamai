// "people" on MFA Readiness, the Plan and Connect: "user" names an Entra user object
// (Microsoft's own scope names) and nothing else.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { app, pages } from '../../content/content.ts'
import { consentRows } from '../../copy/permissions.ts'

test('"people" on MFA Readiness, the Plan and Connect; "user" only for an Entra user object', () => {
  // The consent rows are Microsoft's own wording and live with the permission
  // authority (src/copy/permissions.ts), not in the page's words (task 016), so
  // the page's words carry no "user" at all.
  // One owner-chosen exception (2026-09-11): the Impact column's "No user impact",
  // which says a policy reaches no one without calling the reach zero.
  // The words a page shows are the strings, not the keys that name them: a binding
  // key such as `policies.guests.mixed.target.users` is a package's vocabulary and
  // is never drawn (its displayed name is the value beside it).
  const strings = (v: unknown): string[] => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v !== null && typeof v === 'object' ? Object.values(v).flatMap(strings) : [])
  const words = JSON.stringify(strings({ readiness: pages.readiness, plan: pages.plan, connect: pages.connect, appReadiness: app.readiness, appPlan: app.plan, appConnect: app.connect })).replaceAll(JSON.stringify((pages.plan as { impact: { noUserImpact: string } }).impact.noUserImpact), '""').replace(/All users/g, 'Everyone').replace(/Per-user MFA/g, 'MFA').replace(/user accounts/g, 'accounts')
  assert.ok(!/\busers?\b/i.test(words), `no "user" outside Microsoft's scope names: ${(words.match(/[^"]{0,40}\busers?\b[^"]{0,40}/i) ?? [''])[0]}`)
  // Microsoft's consent rows name the user object, as Microsoft does.
  assert.ok(JSON.stringify(consentRows()).includes("Read all users' authentication methods"))
})
