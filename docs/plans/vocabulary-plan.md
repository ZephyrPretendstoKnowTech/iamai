# Vocabulary: a designed plan for the owner to approve

**Status: proposal. Nothing here is built.** Written 2026-09-21, after the second
gauntlet (`docs/qa/night/personas/SYNTHESIS.md` §6).

## 0. The constraint this plan is written under

> "I would approach the Vocabulary carefully. Explain too much, and we lose the
> experts. Focus on the voice we already have. Nobody felt entirely lost, or
> talked down to. Don't change the voice now." — owner, 2026-09-21

So the plan does **not** touch a single sentence of prose. The voice is working
and the evidence says so: the careful persona listed twenty concepts the tool
taught her, each with the sentence that did it; the expert persona named three
places where IAMAI's wording is better than her own. Whatever we build has to
leave all of that exactly as it is.

What is actually broken is narrower than "vocabulary". Four terms are **used in
instructions and never explained anywhere**: Temporary Access Pass (on four
steps, a hard blocker on one), AAGUID, attestation, and Inforcer. Everything
else the tool either explains in the sentence where it matters, or does not need
to.

## 1. What earns an entry

A term earns a definition only when **both** hold:

1. it appears inside an instruction somebody is expected to follow, and
2. getting it wrong changes what they do.

A term the prose already teaches in place does **not** get an entry — that would
be the same fact in two voices, and the second one is the weaker. This rule is
what keeps the list from growing into a glossary nobody reads.

### The candidate list, against that rule

| term | appears in | already taught in prose? | entry? |
| --- | --- | --- | --- |
| Temporary Access Pass | 4 steps; the only way out of the registration step | no | **yes** |
| AAGUID | the passkey-settings procedure and the approved-model list | no | **yes** |
| attestation | the passkey-settings procedure | no | **yes** |
| authentication strength | 3 policy procedures, and its own prerequisite step | partly (the step teaches it; the policies that use it do not) | **yes** |
| device compliance vs enrolment vs registration | the device steps | yes, and well ("enrolment ≠ compliance") | no |
| report-only | everywhere | yes, repeatedly and well | no |
| break-glass / emergency access | the gate | yes | no |
| exclusions group | every policy procedure | yes ("why exclusions go through a group") | no |
| security defaults | the cutover | yes — the best sentence in the product | no |
| named / trusted location | 3 steps | yes ("an observed address is not automatically trusted") | no |
| sign-in frequency, persistent browser session | the session steps | yes | no |
| plan tag | the JSON and PowerShell channels | yes, in the settings block | no |
| Inforcer | the first Direction question | no — and it is a **product name**, not a term | see §5 |

**Four entries at launch+1.** Not forty.

## 2. Where the definition lives

`src/copy/definitions.ts` already holds ninety-one definitions and is already
described as "definitions behind every state, tile and chip a user sees, written
for a novice". A new `GLOSSARY` record goes there, keyed by slug, with the same
`Definition` shape and the same 25-word ceiling the InfoTip contract already
measures. One authority, already tested, no new file.

## 3. How a term is marked

**Automatically, from the term list — never by markup in a content file.**

Authoring `{{term:tap}}` into content would mean editing the four content packs
that carry these words today and every pack written after, and the marking would
drift the first time somebody rephrases a line. The renderer should find the
terms instead.

Rules the matcher must obey, each of which is an acceptance test:

- **Prose only.** Never inside a fenced code block, a JSON body, a PowerShell
  script, a policy display name, a link's text, or an already-marked span. This
  is the rule most likely to be got wrong and it is where a bug would be most
  embarrassing: a dotted underline inside a body the operator is about to paste.
- **First occurrence per rendered section**, not per page and not every time. An
  expert reading a procedure should step over one marker, not nine.
- **Whole words, case-sensitive for initialisms** (AAGUID, not "aaguid" inside
  an id).
- **Never inside the Settings for This Action block**, which is a transcription
  target.

## 4. What it looks like

A **dotted underline on the term itself**, no icon, no colour change, no layout
shift. Hover or keyboard focus opens the existing popover.

`src/ui/components/InfoTip.tsx` already has everything hard about this solved:
portal to the top layer, flip-and-shift so it is never clipped, Escape to close,
`aria-describedby` while open, and a touch path that survives focus-then-click
firing in one gesture. The proposal is a `<Term>` wrapper that **reuses that
popover**, changing only the trigger from an "i" button to the word. No second
popover implementation.

## 5. Inforcer is a different problem

Inforcer is the name of a third-party product, not a concept. It does not want a
definition; it wants what every other hard-term step already has and this one
alone lacks — a Learn link. That is a one-line content fix, independent of
everything above, and it should be done whether or not this plan is approved.

## 6. The expert's escape hatch

One switch: **Explain terms**, in the same place as the other Plan display
toggles, remembered per browser.

Proposed default: **on**. A dotted underline on four words in a whole rollout is
close to silent, and the toggle is one click for someone who wants it gone. If
you would rather it defaulted off and be discovered, say so — it is a one-word
change to the plan and I have no strong case either way.

## 7. What this plan deliberately does not do

- No inline parentheticals. "Temporary Access Pass (a short-lived code…)" inside
  a procedure is exactly the change that would lose the experts.
- No "what is this?" links out to Microsoft Learn in place of a definition.
- No first-run tour, no glossary page, no search.
- No change to the reading level, length or structure of any existing sentence.
- No entry for a term the prose already teaches.

## 8. Acceptance

- Every `GLOSSARY` entry is at most 25 words and names no term that has no entry
  of its own (unit test, beside the existing InfoTip contract test).
- Across every fixture, no marked term appears inside a code block, a JSON body,
  a PowerShell script, a policy display name, a link, or the Settings block
  (rendering test over the step corpus).
- At most one marked occurrence per rendered section.
- The four terms are each marked at least once somewhere in a rendered plan —
  otherwise the feature exists and nobody sees it.
- Off, the rendered text is byte-for-byte what it is today.

## 9. Size

Small. One record in an existing file, one wrapper around an existing component,
one matcher with a hard exclusion list, one toggle, four tests. The risk is
entirely in §3's exclusion rules, which is why they are written as acceptance
tests rather than as guidance.

## 10. What I need from you

1. The rule in §1 — is "both, or no entry" the line you want?
2. The four terms in §1 — right list?
3. §6 — default on or off?
4. §5 — Inforcer's Learn link now, separately?
