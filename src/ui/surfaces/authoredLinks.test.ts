// A tenant's names never become links in IAMAI's authored text (security
// audit, 2026-09-29). Markdown-format blocks (an Entra procedure, AI Info, an
// Email) and the policy procedures bind group, person and policy names into
// IAMAI's own words, and the inline renderer cannot tell the two apart. A name
// such as "[Sign in again](https://evil.example/login)" drew as a link styled
// like IAMAI's own. An external link is now drawn only to a host IAMAI's own
// content links to; this file walks every authored link against that list, so
// content that links to a new host fails here until the host is listed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { AUTHORED_LINK_HOSTS, authoredParts, foldLineOf, inlineParts } from './authoredText.ts'
import type { InlinePart } from './authoredText.ts'
import { bindText, oneLine } from '../../content/implementation/project.ts'
import { createLines, openLine } from '../../roadmap/policyProcedure.ts'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from '../../content/implementation/protocol.ts'

/** Every inline part a block draws: each line, heading and list item, and a sub-line's pieces as FoldLine draws them. */
function drawnParts(text: string): InlinePart[] {
  const lines = authoredParts(text).flatMap((p) => (p.kind === 'list' ? p.items.flat() : p.kind === 'break' ? [] : [p.text]))
  return lines.flatMap((line) => {
    const fold = foldLineOf(line)
    const pieces = fold === null ? [line] : 'items' in fold ? [fold.title, ...fold.items] : [fold.title, fold.text]
    return pieces.flatMap(inlineParts)
  })
}
const linksIn = (text: string): Extract<InlinePart, { kind: 'link' }>[] => drawnParts(text).filter((p): p is Extract<InlinePart, { kind: 'link' }> => p.kind === 'link')

const CRAFTED = [
  '[Re-authenticate IAMAI here](https://evil.example/login)',
  '[Sign in again](https://entra.microsoft.com@evil.example/login)',
  '[Sign in again](https://entra.microsoft.com.evil.example/login)',
  '[Sign in again](https://entra.microsoft.com:8443/login)',
  '[Sign in again](https://evil.example/?next=https://entra.microsoft.com/)',
]

test('a crafted directory name bound into authored text draws no link, and stays on screen as the text it is', () => {
  // a package block's binding (policy.current.removedExclusions): no '*' needed on this path
  for (const name of CRAFTED) {
    const bound = bindText("# This change removes {{policy.current.removedExclusions}} from the policy's exclusions.\n1. Remove {{policy.current.removedExclusions}}.", { 'policy.current.removedExclusions': ['Finance travellers', name] }, new Set())
    assert.ok('text' in bound)
    assert.deepEqual(linksIn(bound.text), [], name)
    assert.ok(drawnParts(bound.text).some((p) => p.kind === 'text' && p.text.includes(name.replace('](', '] ('))), `${name} is not drawn as text`)
  }
  // a policy procedure: one '*' in a group name broke the bold around it, and the next name on the line too
  {
    const G = '11111111-1111-4111-8111-111111111111'
    const U = '22222222-2222-4222-8222-222222222222'
    const names: Record<string, string> = {
      [G]: 'Finance *[Your IAMAI session expired - sign in again](https://evil.example/login)',
      [U]: 'Plain [Sign in](https://evil.example/u) user',
    }
    const ctx = { nameOf: (id: string) => oneLine(names[id] ?? id) }
    const policy = { displayName: 'P', state: 'enabledForReportingButNotEnforced', conditions: { users: { includeUsers: [], includeGroups: [G], excludeUsers: [U], excludeGroups: [] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }
    const text = createLines(policy as never, ctx as never, { name: 'P' }).join('\n')
    assert.match(text, /evil\.example/, 'the names are in the procedure')
    assert.deepEqual(linksIn(text).filter((l) => /evil/.test(l.href)), [])
  }
  // IAMAI's own links, and routes of the app, still draw as links
  assert.deepEqual(inlineParts('Open [Microsoft Entra](https://entra.microsoft.com/) or [the plan](#/plan).').filter((p) => p.kind === 'link'), [
    { kind: 'link', text: 'Microsoft Entra', href: 'https://entra.microsoft.com/', external: true },
    { kind: 'link', text: 'the plan', href: '#/plan', external: false },
  ])
})

// Security review, 2026-09-29: the host list let a name link to any page on an
// allowed host, worded as the name chose: an app's consent blade on
// entra.microsoft.com ("Grant the permissions IAMAI needs"), or a Microsoft Q&A
// page on learn.microsoft.com, which anyone can post. A bound name's link form
// is now broken where it is bound, so it never draws as a link, whatever host.
const ON_ALLOWED_HOSTS = [
  '[Grant the permissions IAMAI needs to finish this step](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/00000000-aaaa-4bbb-8ccc-000000000000)',
  '[Read how to finish this step](https://learn.microsoft.com/en-us/answers/questions/1234567/finish-this-step)',
  '[Open the policy](https://portal.azure.com/#view/attacker-chosen)',
  '[the plan](#/connect)',
]

test('a directory name linking to an allowed host draws no link either, in a package channel and in a policy procedure', () => {
  const blocks = Object.values((registry as unknown as { packages: Record<string, CompiledPackage> }).packages).flatMap((pkg) => Object.values(pkg.blocks))
  const block = blocks.find((b) => b.meta.format === 'markdown' && b.text.includes('{{policy.current.removedExclusions}}'))
  assert.ok(block, 'no Markdown block binds the removed exclusions')
  for (const name of ON_ALLOWED_HOSTS) {
    const words = /^\[([^\]]+)\]/.exec(name)![1]
    // a package channel: a real Markdown block, bound as the projection binds it
    const bound = bindText(block.text, { 'policy.current.removedExclusions': ['Finance travellers', name] }, new Set(), undefined, block.meta.format)
    assert.ok('text' in bound && bound.text.includes(words), `${block.meta.id} does not draw the name`)
    assert.deepEqual(linksIn(bound.text).filter((l) => l.text === words), [], `${block.meta.id}: ${name}`)
    // a policy procedure: an included group, an excluded person, the policy's own name, a role list
    const G = '11111111-1111-4111-8111-111111111111'
    const U = '22222222-2222-4222-8222-222222222222'
    const R = '33333333-3333-4333-8333-333333333333'
    const ctx = { nameOf: (id: string) => oneLine(id === G ? `Travel *${name}` : id === U ? name : id === R ? name : id) }
    const policy = { displayName: name, state: 'enabledForReportingButNotEnforced', conditions: { users: { includeUsers: [], includeGroups: [G], includeRoles: [R], excludeUsers: [U], excludeGroups: [] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }
    const text = [openLine(name), ...createLines(policy as never, ctx as never, { name })].join('\n')
    assert.ok(text.includes(words), 'the names are in the procedure')
    assert.deepEqual(linksIn(text).filter((l) => l.text.includes(words) || l.href !== 'https://entra.microsoft.com/'), [], name)
  }
  // The same words IAMAI authors itself still draw as links (the walk below reads every one).
  assert.equal(linksIn('Open [Microsoft Entra admin center](https://entra.microsoft.com/).').length, 1)
})

/** Every source of authored text: the words, the implementation content, and the code that writes procedures. */
function authoredSources(): { file: string; text: string }[] {
  const root = new URL('../../../', import.meta.url)
  const read = (rel: string) => ({ file: rel, text: readFileSync(new URL(rel, root), 'utf8') })
  const walk = (dir: string, keep: (f: string) => boolean): string[] =>
    (readdirSync(new URL(dir, root), { recursive: true }) as string[]).map((f) => join(dir, f).replaceAll('\\', '/')).filter(keep)
  return [
    read('docs/design/content.json'),
    read('src/content/implementation/registry.generated.json'),
    ...walk('docs/implementation-content', (f) => f.endsWith('.md')).map(read),
    ...walk('src', (f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts')).map(read),
  ]
}

test('every link in IAMAI\'s authored content is to a listed host, and still draws as a link', () => {
  const found: { file: string; link: string; href: string }[] = []
  for (const { file, text } of authoredSources()) {
    for (const m of text.matchAll(/\[[^\]\n]+\]\((https:\/\/[^)\s]*)\)/g)) found.push({ file, link: m[0], href: m[1] })
  }
  assert.ok(found.length >= 30, `only ${found.length} authored links found: the walk is not reading the content`)
  for (const { file, link, href } of found) {
    const host = URL.canParse(href) ? new URL(href).hostname : `(not a URL: ${href})`
    assert.ok(AUTHORED_LINK_HOSTS.has(host), `${file}: ${link} links to ${host}, which is not in AUTHORED_LINK_HOSTS (authoredText.ts). Add the host there if IAMAI means to link to it.`)
    assert.ok(inlineParts(link).some((p) => p.kind === 'link' && p.href === href), `${file}: ${link} no longer draws as a link`)
  }
})
