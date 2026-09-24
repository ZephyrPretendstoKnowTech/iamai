import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inPlaceStatement, missingStatement, partialControlStatement, partialScopeStatement, reportOnlyStatement } from './statements.ts'

test('no finding statement runs past two sentences (prompt 17 §5)', () => {
  const sentences = (s: string) => s.replace(/\*\*?[^*]+\*\*?/g, 'x').split(/\.\s+(?=[A-Z])/).filter(Boolean).length
  const samples = [
    inPlaceStatement('Require MFA', ['A', 'B'], 2),
    partialControlStatement('Admin sessions', 'MFA', 'phishing-resistant MFA', 3, 4, 'admin'),
    partialScopeStatement('Guests need MFA', 2, 5, 'guest', [{ reason: 'never targeted', count: 2 }, { reason: 'excluded', count: 1 }]),
    missingStatement('Block legacy authentication', null, 'CA001'),
    reportOnlyStatement('Require MFA', 'CA002', 9, 0),
  ]
  for (const s of samples) assert.ok(sentences(s) <= 2, s)
})
