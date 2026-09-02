// Prompt 52, walk-51 item 19: one theme preference across the home page, the demo
// and the signed-in app. The walk found light/dark differing between them; the
// app kept a separate "iamai-theme-demo" key while the home page used
// "iamai-theme". They share one key now.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('the home page, the demo and the app store the theme under one key', () => {
  const shell = readFileSync('src/ui/shell/AppShell.tsx', 'utf8')
  const home = readFileSync('home/index.html', 'utf8')
  assert.match(shell, /THEME_KEY = 'iamai-theme'/, 'the app uses the shared key')
  assert.doesNotMatch(shell, /iamai-theme-demo/, 'no separate demo theme key')
  assert.match(home, /'iamai-theme'/, 'the home page uses the shared key')
})
