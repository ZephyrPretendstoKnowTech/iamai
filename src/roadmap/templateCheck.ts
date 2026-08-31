// Proves a goal template is the goal it claims to be (prompt 46 item 12):
// resolved with stand-in objects, its facts match the implementation's own
// signature and satisfy its floor, it carries a grant or session control, and
// it uses only the seven placeholders. Shared by the template test and by
// scripts/check-template.mjs, so an author and the suite disagree on nothing.
// Pure.
import { policyFacts } from '../coverage/facts.ts'
import { matchesSignature } from '../coverage/classify.ts'
import { buildStrengthLookup, satisfiesFloor } from '../coverage/strength.ts'
import type { Goal, Implementation } from '../coverage/types.ts'
import { SAMPLE_VALUES, placeholdersIn, resolveTemplate, unknownPlaceholdersIn } from './template.ts'
import type { TemplateBody } from './template.ts'

/** The only raw ids a template may carry: Microsoft first-party apps, identical in every tenant, and the built-in strengths. */
export const WELL_KNOWN_IDS: ReadonlySet<string> = new Set([
  '797f4846-ba00-4fd7-ba43-dac1f8f63013', // Windows Azure Service Management API
  'd4ebce55-015a-49b5-a083-c84d1797ae8c', // Microsoft Intune Enrollment
  '00000002-0000-0ff1-ce00-000000000000', // Office 365 Exchange Online (token protection targets only these three)
  '00000003-0000-0ff1-ce00-000000000000', // Office 365 SharePoint Online
  'cc15fd57-2c6c-4117-a88c-83b1d56b4bbe', // Microsoft Teams Services
  '00000000-0000-0000-0000-000000000002', // built-in strength: MFA
  '00000000-0000-0000-0000-000000000003', // built-in strength: Passwordless MFA
  '00000000-0000-0000-0000-000000000004', // built-in strength: Phishing-resistant MFA
  'd29b2b05-8046-44ba-8758-1e26182fcf32', // Directory Synchronization Accounts, excluded from MFA and strength (prompt 48 item 13)
])
const GUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
/** Set by the engine, never by a template. */
const FORBIDDEN_KEYS = ['id', 'state', 'description', 'createdDateTime', 'modifiedDateTime', 'templateId']
const EXCLUSION_PLACEHOLDER: Record<string, string> = {
  breakGlass: '{breakGlass}',
  globalExclusion: '{exclusionsGroup}',
  serviceAccounts: '{serviceAccountsGroup}',
}
export const SHORT_NAME_MAX_WORDS = 6

const strengths = buildStrengthLookup([])

export type TemplateCheck = {
  ok: boolean
  problems: string[]
  facts: {
    who: { all: boolean; roles: number; groups: number; guests: string[] | null }
    apps: { all: boolean; ids: string[]; userActions: string[] }
    grant: { controls: string[]; strength: string | null; operator: string } | null
  } | null
}

export function checkTemplate(goal: Pick<Goal, 'shortName'>, impl: Pick<Implementation, 'signature' | 'floor' | 'allowedExclusions' | 'template'>): TemplateCheck {
  const problems: string[] = []
  const template = impl.template as TemplateBody | undefined
  if (!template || typeof template !== 'object') return { ok: false, problems: ['no template'], facts: null }
  const shortName = goal.shortName
  if (typeof shortName !== 'string' || shortName.trim() === '') problems.push('shortName missing')
  else {
    const words = shortName.trim().split(/\s+/).length
    if (words > SHORT_NAME_MAX_WORDS) problems.push(`shortName is ${words} words; the limit is ${SHORT_NAME_MAX_WORDS}`)
  }
  for (const k of FORBIDDEN_KEYS) if (k in template) problems.push(`template must not carry "${k}" (the engine sets it)`)
  if (!template.conditions || typeof template.conditions !== 'object') problems.push('template has no conditions')
  const unknown = unknownPlaceholdersIn(template)
  if (unknown.length > 0) problems.push(`unknown placeholders: ${unknown.join(', ')}`)
  const used = placeholdersIn(template)
  for (const [exclusion, placeholder] of Object.entries(EXCLUSION_PLACEHOLDER)) {
    const allowed = impl.allowedExclusions.includes(exclusion)
    if (allowed && !used.includes(placeholder as (typeof used)[number])) problems.push(`allowedExclusions has ${exclusion} but the template never excludes ${placeholder}`)
    if (!allowed && used.includes(placeholder as (typeof used)[number])) problems.push(`template excludes ${placeholder} but ${exclusion} is not in allowedExclusions`)
  }
  const raw = JSON.stringify(template)
  const guids = [...new Set((raw.match(GUID_RE) ?? []).map((g) => g.toLowerCase()))].filter((g) => !WELL_KNOWN_IDS.has(g))
  if (guids.length > 0) problems.push(`raw ids that are not well-known: ${guids.join(', ')} (use a placeholder)`)

  const { body, unresolved } = resolveTemplate(template, SAMPLE_VALUES)
  if (unresolved.length > 0) problems.push(`sample values left unresolved: ${unresolved.join(', ')}`)
  const facts = policyFacts({ ...body, displayName: 'check', state: 'enabled' }, strengths)
  if (!matchesSignature(facts, impl.signature)) {
    const failing = Object.entries(impl.signature)
      .filter(([k, v]) => !matchesSignature(facts, { [k]: v }))
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    problems.push(`does not match its own signature; failing keys: ${failing.join('; ') || '(combination)'}`)
  }
  if (!satisfiesFloor(facts.grant, facts.session, impl.floor)) problems.push(`does not satisfy its floor ${JSON.stringify(impl.floor)}`)
  const hasGrant = facts.grant !== null && facts.grant.controls.size > 0
  const s = facts.session
  const hasSession =
    s.signInFrequencyHours !== null || s.signInFrequencyEveryTime || s.persistentBrowser !== null || s.secureSignInSession || s.cloudAppSecurity !== null || s.appEnforced
  if (!hasGrant && !hasSession) problems.push('no grant control and no session control')
  return {
    ok: problems.length === 0,
    problems,
    facts: {
      who: { all: facts.who.all, roles: facts.who.roles.size, groups: facts.who.groups.size, guests: facts.who.guests },
      apps: { all: facts.apps.all, ids: [...facts.apps.ids], userActions: [...facts.apps.userActions] },
      grant: facts.grant ? { controls: [...facts.grant.controls], strength: facts.grant.strength, operator: facts.grant.operator } : null,
    },
  }
}
