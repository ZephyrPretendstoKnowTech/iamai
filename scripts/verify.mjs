import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const args = process.argv.slice(2)
if (!args.length || args.includes('--help')) {
  console.log('Focused: npm run verify -- src/path/example.test.ts [more tests]\nRelease preflight: npm run verify -- --release\nUse focused checks while editing; CI performs full release validation.')
  process.exit(0)
}
const npm = process.env.npm_execpath
if (!npm) throw new Error('Run this command through npm run verify')
const release = args.length === 1 && args[0] === '--release'
if (!release && args.some(p => !p.endsWith('.test.ts') || relative(process.cwd(), resolve(p)).startsWith('..') || !existsSync(p))) throw new Error('Provide existing repository .test.ts files, or --release')
const commands = [
  ['Typecheck', [npm, 'exec', '--', 'tsc', '--noEmit']],
  [release ? 'Full suite' : 'Focused tests', release ? [npm, 'test'] : ['--test', '--test-isolation=none', ...args]],
  ...(release ? [['Build', [npm, 'run', 'build:site']], ['Browser smoke', [npm, 'run', 'smoke']]] : []),
]
for (const [name, command] of commands) {
  const start = Date.now()
  console.log(`\n${name}`)
  const result = spawnSync(process.execPath, command, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
  console.log(`${name} passed in ${((Date.now() - start) / 1000).toFixed(1)}s`)
}
