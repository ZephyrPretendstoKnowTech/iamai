// F-121: a personal (registered) Windows computer that signed in with Windows
// Hello read "Best option · Windows Hello for Business" in MFA Readiness's
// drawer, while the same drawer says Windows Hello for Business needs a joined
// computer. A device that signs in with what is built into it says what it
// signs in with, by the credential's class, and gives no advice.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pages } from '../../content/content.ts'
import { panelDevices } from './readinessCells.ts'
import type { ReadinessRow } from '../../derive/mfaReadiness.ts'
import type { DeviceReading } from '../../scoring/phishingResistant.ts'

const P = (pages.readiness as unknown as { panel: { best: string; signsInWith: string }; methods: Record<string, string>; options: Record<string, string> })

const device = (over: Partial<DeviceReading>): DeviceReading => ({
  os: 'Windows', type: 'computer', lastSeen: '2026-09-30T00:00:00Z', trust: 'registered', version: null,
  best: 'windowsHelloPasskey', builtIn: true, possible: 'yes', whyNot: null, offer: 'windowsHelloPasskey',
  proof: null, covered: false, seamless: false, ...over,
})
const rowWith = (devices: DeviceReading[]): ReadinessRow => ({ readiness: { devices } } as unknown as ReadinessRow)

test('a personal Windows computer that signs in with Windows Hello says so, and is offered nothing', () => {
  const [item] = panelDevices(rowWith([device({ proof: { cls: 'windowsHello', at: '2026-09-29T00:00:00Z' }, covered: true, seamless: true })]))
  assert.deepEqual(item.facts[0], [P.panel.signsInWith, P.methods.windowsHello])
  assert.equal(item.facts.some(([label]) => label === P.panel.best), false)
  assert.doesNotMatch(item.facts.map(([, v]) => v).join(' '), /Windows Hello for Business/)
})

test('a Mac that signs in with Platform SSO says so', () => {
  const [item] = panelDevices(rowWith([device({ os: 'macOS', trust: 'joined', best: 'platformSso', offer: 'platformSso', proof: { cls: 'platformCredential', at: '2026-09-29T00:00:00Z' }, covered: true, seamless: true })]))
  assert.deepEqual(item.facts[0], [P.panel.signsInWith, P.methods.platformCredential])
})

test('a device with something still to set up keeps its best option', () => {
  const [item] = panelDevices(rowWith([device({ trust: 'joined', best: 'windowsHello', offer: 'windowsHello' })]))
  assert.equal(item.facts[0][0], P.panel.best)
  assert.equal(item.facts[0][1], P.options.windowsHello)
})
