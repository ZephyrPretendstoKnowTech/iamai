// Writes home/theme.css from the tool's tokens (prompt 47.1 Part 3 item 11), so
// the home page wears the same palette, type scale and fonts as the planner
// without depending on the bundle. Run by `vite build` (vite.config.ts) and
// directly: node scripts/build-home.ts. home.test.ts fails while the file and
// the tokens disagree, the way tokens.test.ts guards tokens.css.
//
// The fonts are the planner's own files, referenced through the tool-path
// placeholder that scripts/assemble-site.mjs substitutes, so the path lives in
// one place (/rollout/fonts/… on the published site).
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderTokensCss } from '../src/ui/tokens.ts'

export function renderHomeTheme(): string {
  return renderTokensCss()
    .replace(/^\/\* GENERATED[\s\S]*?\*\/\n/, '/* GENERATED from src/ui/tokens.ts by scripts/build-home.ts (run by vite build). Do not edit by hand:\n   home.test.ts fails when this file and tokens.ts disagree. */\n')
    .replaceAll("url('/fonts/", "url('/{{TOOL_PATH}}/fonts/")
}

export function buildHome(): void {
  writeFileSync('home/theme.css', renderHomeTheme())
  console.log('build-home: wrote home/theme.css')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) buildHome()
