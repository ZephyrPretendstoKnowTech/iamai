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

// Security audit, 2026-09-29: the pattern stopped at '!', '^' and '~', which
// Entra allows in a sign-in name, and at the other characters an email address
// (and so a guest's name before #EXT#) may hold. 'john!smith@contoso.com' came
// out 'john!upn-1@redacted': the start of the address stayed in a masked file.
test('a sign-in address is masked whole, whatever character Entra allows before the @', () => {
  for (const local of ['john!smith', 'jane~doe', 'a^b', "o'brien", 'a#b', 'a%b', 'a+b', 'a-b', 'a_b', 'a.b', '0123']) {
    assert.equal(redactIdentifiers(`Owner: ${local}@contoso.com.`), 'Owner: upn-1@redacted.', local)
  }
  assert.equal(redactIdentifiers("Owner: a!#%'+-^_~.9@contoso.com"), 'Owner: upn-1@redacted', 'every character at once')
  // Markdown and prose that wrap an address keep their wrapping, and the address keeps one placeholder.
  assert.equal(
    redactIdentifiers("**jane~doe@contoso.com**, `jane~doe@contoso.com`, 'jane~doe@contoso.com' and {jane~doe@contoso.com}"),
    "**upn-1@redacted**, `upn-1@redacted`, 'upn-1@redacted' and {upn-1@redacted}",
  )
  // The masked calendar and prompts file.
  const d = runbookRedaction(null)
  const ics = exportText('iamai-plan.ics', ['BEGIN:VCALENDAR', 'DESCRIPTION:Emergency access: sample.person~bg1@corp.example and john!smith@corp.example', 'END:VCALENDAR'].join('\r\n'), d)
  const md = exportText('iamai-prompts.md', 'Emergency access: **sample.person~bg1@corp.example**, a^b@corp.example', d)
  for (const out of [ics, md]) {
    assert.ok(!/sample|person|john|smith|a\^b|corp\.example/.test(out.replace(/\r\n[ \t]/g, '')), out)
    assert.match(out, /upn-1@redacted/)
  }
})

// Security review, 2026-09-29: widened to every character RFC 5322 allows, the
// pattern let a key, a path or another address start the match: 'upn=' and
// '/users/' went into the placeholder, two addresses joined by '/' became one,
// and one address got a different placeholder for each prefix. Entra allows only
// A-Z a-z 0-9 ' . - _ ! # ^ ~ before the @ (with a guest's + and % kept), so
// '/', '=', '?', '&', '*', '|', '{', '`' and '$' end the address as they did.
test('what stands before an address survives masking, and one address keeps one placeholder', () => {
  const cases: [string, string][] = [
    ['upn=jane@contoso.com; other=bob@contoso.com', 'upn=upn-1@redacted; other=upn-2@redacted'],
    ['Resource https://graph.microsoft.com/v1.0/users/jane@contoso.com/authentication/methods was not found', 'Resource https://graph.microsoft.com/v1.0/users/upn-1@redacted/authentication/methods was not found'],
    ['jane@contoso.com/bob@contoso.com', 'upn-1@redacted/upn-2@redacted'],
    ['Break glass: *jane@contoso.com (primary)', 'Break glass: *upn-1@redacted (primary)'],
    ['owner?jane@contoso.com&x=bob@contoso.com', 'owner?upn-1@redacted&x=upn-2@redacted'],
    ['|jane@contoso.com|', '|upn-1@redacted|'],
    ['$Upn=jane@contoso.com', '$Upn=upn-1@redacted'],
  ]
  for (const [text, masked] of cases) assert.equal(redactIdentifiers(text), masked, text)
  // One address, one placeholder, whatever stands before it.
  assert.equal(
    redactIdentifiers('jane@x.com, =jane@x.com, upn=jane@x.com, /users/jane@x.com, *jane@x.com* and `jane@x.com`'),
    'upn-1@redacted, =upn-1@redacted, upn=upn-1@redacted, /users/upn-1@redacted, *upn-1@redacted* and `upn-1@redacted`',
  )
})
