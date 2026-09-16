import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, relative } from 'node:path'

const args = process.argv.slice(2)
if (!args.length || args.includes('--help')) {
  console.log('Focused: npm run verify -- src/path/example.test.ts [more tests]\nFast pre-push: npm run verify -- --prepush src/path/example.test.ts [more tests]\nRelease preflight: npm run verify -- --release\nUse focused checks while editing and the fast pre-push gate before pushing; CI performs full release validation.')
  process.exit(0)
}
const npm = process.env.npm_execpath
if (!npm) throw new Error('Run this command through npm run verify')
const release = args.length === 1 && args[0] === '--release'
const prepush = args[0] === '--prepush'
const tests = prepush ? args.slice(1) : args
if (prepush && tests.length === 0) throw new Error('Fast pre-push requires the relevant .test.ts files')
if (!release && tests.some(p => !p.endsWith('.test.ts') || relative(process.cwd(), resolve(p)).startsWith('..') || !existsSync(p))) throw new Error('Provide existing repository .test.ts files, --prepush followed by relevant tests, or --release')

const run = (name, command) => {
  const start = Date.now()
  console.log(`\n${name}`)
  const result = spawnSync(process.execPath, command, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
  console.log(`${name} passed in ${((Date.now() - start) / 1000).toFixed(1)}s`)
}

const runParallel = async (commands) => {
  const results = await Promise.all(commands.map(([name, command, options]) => new Promise((done) => {
    const start = Date.now()
    console.log(`\n${name}`)
    const child = spawn(process.execPath, command, { stdio: 'inherit', ...options })
    child.once('error', (error) => done({ name, error, status: null, seconds: (Date.now() - start) / 1000 }))
    child.once('exit', (status) => done({ name, error: null, status, seconds: (Date.now() - start) / 1000 }))
  })))
  for (const result of results) {
    if (result.error) throw result.error
    if (result.status !== 0) {
      console.error(`${result.name} failed in ${result.seconds.toFixed(1)}s`)
      process.exit(result.status ?? 1)
    }
    console.log(`${result.name} passed in ${result.seconds.toFixed(1)}s`)
  }
}

if (prepush) {
  // Build before the parallel phase so the generated site is complete before
  // Chrome starts. The smoke walk spends most of its time waiting on rendered
  // states, so it can overlap the CPU-bound focused tests without sharing state.
  // A unique browser endpoint/profile lets this quick gate run beside a dev
  // server or a previous smoke shutdown without inheriting either one's port
  // or Chrome state.
  const smokeSlot = process.pid % 400
  const smokeEnv = {
    ...process.env,
    SMOKE_PORT: String(5200 + smokeSlot),
    SMOKE_CDP_PORT: String(10000 + smokeSlot),
    SMOKE_PROFILE: join(tmpdir(), `iamai-smoke-profile-${process.pid}`),
  }
  run('Typecheck', [npm, 'exec', '--', 'tsc', '--noEmit'])
  run('Build', [npm, 'run', 'build:site'])
  await runParallel([
    ['Focused tests', ['--test', '--test-isolation=none', ...tests]],
    ['Browser smoke', [npm, 'run', 'smoke'], { env: smokeEnv }],
  ])
  process.exit(0)
}

const commands = [
  ['Typecheck', [npm, 'exec', '--', 'tsc', '--noEmit']],
  [release ? 'Full suite' : 'Focused tests', release ? [npm, 'test'] : ['--test', '--test-isolation=none', ...tests]],
  ...(release ? [['Build', [npm, 'run', 'build:site']], ['Browser smoke', [npm, 'run', 'smoke']]] : []),
]
for (const [name, command] of commands) {
  run(name, command)
}
