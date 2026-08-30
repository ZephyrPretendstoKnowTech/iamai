// Reading a tenant's naming convention (naming-and-consolidation.md §2,
// prompt 43 Part 2).
//
// The property that matters: below 60% agreement there is NO convention, and
// saying there is one is worse than proposing the documented pattern and
// labelling it a proposal.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AGREEMENT_FLOOR, applyCasing, casingOf, detectConvention, nextSerial, proposeName, usable } from './convention.ts'

const GOLDEN = ['CA001 - Require MFA for all users', 'CA002 - Block legacy authentication', 'CA003 - Admins phishing-resistant']
const DOCUMENTED = ['Core - Global - Block - Legacy authentication', 'Core - Admins - Require - Phishing-resistant MFA', 'Core - Guests - Require - MFA']

test('a serial prefix is read as a series, not as a literal', () => {
  const c = detectConvention(GOLDEN)!
  assert.ok(usable(c))
  assert.equal(c.separator, ' - ')
  assert.equal(c.segments, 2)
  assert.equal(c.prefix, 'CA')
  assert.equal(c.numbered, true, 'CA001/CA002/CA003 is a series')
  assert.equal(c.agreement, 1)
})

test('a proposal continues the series at the tenant’s own width', () => {
  const c = detectConvention(GOLDEN)
  const p = proposeName(c, GOLDEN, { prefix: 'Core', rest: ['Global', 'Require', 'MFA'], collapsed: 'Require MFA for admins' })
  assert.equal(p.name, 'CA004 - Require MFA for admins')
  assert.equal(p.matchesTenant, true)
  // Padding follows what the tenant already writes: CA004, never CA4.
  assert.equal(nextSerial('CA', GOLDEN, ' - '), 'CA004')
  assert.equal(nextSerial('P', ['P7 | x', 'P8 | y'], ' | '), 'P9')
})

test('a four-segment convention keeps all four segments', () => {
  const c = detectConvention(DOCUMENTED)!
  assert.equal(c.segments, 4)
  assert.equal(c.prefix, 'Core')
  assert.equal(c.numbered, false)
  const p = proposeName(c, DOCUMENTED, { prefix: 'Core', rest: ['Global', 'Require', 'Phishing-resistant MFA'] })
  assert.equal(p.name, 'Core - Global - Require - Phishing-resistant MFA')
})

test('no detectable convention returns a labelled proposal, never a guess', () => {
  const messy = ['MFA policy', 'Block old stuff', 'CA-admins_v2', 'temporary DO NOT DELETE']
  const c = detectConvention(messy)
  assert.equal(usable(c), false, `${c?.agreement} is below the ${AGREEMENT_FLOOR} floor`)
  const p = proposeName(c, messy, { prefix: 'Core', rest: ['Global', 'Require', 'MFA'] })
  assert.equal(p.matchesTenant, false, 'and it says so')
  assert.equal(p.name, 'Core - Global - Require - MFA', 'falling back to the documented pattern')
})

test('one policy, or none, is not a convention', () => {
  assert.equal(usable(detectConvention(['Require MFA'])), false)
  assert.equal(detectConvention([]), null)
  assert.equal(usable(detectConvention(['  ', ''])), false)
})

test('the separator the tenant uses is the separator proposals use', () => {
  const piped = ['ACME | GLOBAL | BLOCK', 'ACME | ADMINS | REQUIRE', 'ACME | GUESTS | BLOCK']
  const c = detectConvention(piped)!
  assert.equal(c.separator, ' | ')
  assert.equal(c.prefixCasing, 'upper')
  const p = proposeName(c, piped, { prefix: 'Core', rest: ['Global', 'Require MFA'] })
  assert.ok(p.name.startsWith('ACME | '), p.name)
  assert.equal(p.name.includes(' - '), false, 'never the tool’s own separator')
})

test('casing is read, and applied without destroying acronyms', () => {
  assert.equal(casingOf('ACME'), 'upper')
  assert.equal(casingOf('core'), 'lower')
  assert.equal(casingOf('Global Block'), 'title')
  assert.equal(casingOf('Require MFA for all users'), 'mixed')
  // Sentence case touches the first letter only: lowercasing the rest turns
  // MFA into mfa, and these names are mostly acronyms.
  assert.equal(applyCasing('require MFA now', 'sentence'), 'Require MFA now')
  // Title case capitalises word starts, not letters after a hyphen.
  assert.equal(applyCasing('phishing-resistant mfa', 'title'), 'Phishing-resistant Mfa')
})

test('agreement is the weakest link, not the strongest', () => {
  // Every name shares the separator; almost nothing else agrees. A tenant like
  // this has no convention worth copying, and reporting the separator's 100%
  // would claim one.
  const c = detectConvention(['A - one', 'B - two - three', 'C - four - five - six', 'D - seven - eight'])
  assert.ok((c?.agreement ?? 1) < AGREEMENT_FLOOR, `agreement was ${c?.agreement}`)
  assert.equal(usable(c), false)
})
