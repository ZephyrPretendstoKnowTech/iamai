// A "masked" export masks a guest's sign-in name too (F-195). A guest's name
// carries the guest's own email before #EXT#, and the address pattern stopped
// at '#': it found nothing to mask, so the calendar and the prompts file kept
// every guest address whole under a card that says addresses are masked.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { redactIdentifiers } from '../redact.ts'
import { exportText, runbookRedaction } from './exportGuard.ts'

const GUEST = 'jane.doe_contoso.com#EXT#@fabrikam.onmicrosoft.com'

test('a guest sign-in name is masked whole, like any address, and keeps one placeholder per account', () => {
  const masked = redactIdentifiers(`Guests without MFA: ${GUEST} and ${GUEST.toUpperCase()}; member ann@fabrikam.com.`)
  assert.equal(masked, 'Guests without MFA: upn-1@redacted and upn-1@redacted; member upn-2@redacted.')
})

test('the masked calendar and prompts file carry no guest address', () => {
  const d = runbookRedaction(null)
  const ics = exportText('iamai-plan.ics', ['BEGIN:VCALENDAR', `DESCRIPTION:Require MFA for Guests reaches ${GUEST}`, 'END:VCALENDAR'].join('\r\n'), d)
  const md = exportText('iamai-prompts.md', `Guests: ${GUEST}`, d)
  for (const out of [ics, md]) {
    assert.equal(out.includes('contoso.com'), false, out)
    assert.equal(out.includes('#EXT#'), false, out)
    assert.match(out, /upn-1@redacted/)
  }
})
