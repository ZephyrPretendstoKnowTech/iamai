# IBM Plex — provenance, licence and local readiness

Task 029. IAMAI's three type families are IBM Plex Serif, IBM Plex Sans and IBM Plex Mono
(`docs/brand/iamai-brand-contract.md` §3). This file records where the files in
`public/fonts/` came from, what licenses them, and what a later pack still has to do.

## Privacy rule

**No runtime request to Google Fonts or any other third-party font CDN, ever.** IAMAI reads
a customer's tenant in the customer's browser; a page that fetches a font from a third party
tells that third party who is reading, when, and from where. Every face is self-hosted from
the same origin as the application, preloaded from `index.html`, and declared by
`@font-face` in the generated `src/ui/tokens.css` and `home/theme.css`.

`src/brand/brand.test.ts` fails if a production file or a brand document introduces a remote
font URL. (Five superseded mockups under `docs/design/` still carry a Google Fonts link.
They are records of what was drawn, they ship nothing, and nothing loads them; the check is
scoped to what is served.)

## Licence

**SIL Open Font License, Version 1.1.** Copyright © 2017 IBM Corp. with Reserved Font Name
"Plex". The full text as distributed by IBM is committed beside the faces at
[`public/fonts/OFL.txt`](../../public/fonts/OFL.txt).

The OFL permits bundling, embedding and redistribution with the licence, which is what
self-hosting these subsets is. IAMAI does not rename, modify or sell the faces, and does not
use the Reserved Font Name for a modified version.

## Source

The upstream is IBM's own distribution of Plex on npm — the split `woff2` subsets, which is
the same set of files IBM publishes for exactly this use:

| Package | Version verified | Path inside the package |
|---|---|---|
| [`@ibm/plex-sans`](https://www.npmjs.com/package/@ibm/plex-sans) | 1.1.0 | `fonts/split/woff2/` |
| [`@ibm/plex-serif`](https://www.npmjs.com/package/@ibm/plex-serif) | 1.1.0 | `fonts/split/woff2/` |
| [`@ibm/plex-mono`](https://www.npmjs.com/package/@ibm/plex-mono) | 1.1.0 | `fonts/split/woff2/` |
| [`@ibm/plex`](https://www.npmjs.com/package/@ibm/plex) (umbrella) | 6.4.1 | `IBM-Plex-<Family>/fonts/split/woff2/` |

No IBM Plex package is a dependency of this repository. The faces are seven files totalling
about 150 KB; a ~4 MB (single family) to ~170 MB (umbrella) package in the lockfile to serve
seven of them would be a cost every `npm ci` pays for nothing. The files are copied from the
published package, and their SHA-256 is recorded here so the copy can be re-verified against
the source at any time:

```text
npm pack @ibm/plex-sans@1.1.0
tar -xzf ibm-plex-sans-1.1.0.tgz package/fonts/split/woff2/IBMPlexSans-Bold-Latin1.woff2
sha256sum package/fonts/split/woff2/IBMPlexSans-Bold-Latin1.woff2
```

**Nothing here was copied from an operator's machine or a font site.** Every byte is from
IBM's published package.

## The files

| File | Family | Weight | SHA-256 | Verified against |
|---|---|---|---|---|
| `IBMPlexSerif-Regular-Latin1.woff2` | IBM Plex Serif | 400 | `324a502545695a3e8dd9e9d9273ec56e3aa2a729689807756b9439e2c7a48071` | earlier Plex release (see below) |
| `IBMPlexSerif-Medium-Latin1.woff2` | IBM Plex Serif | 500 | `3c9cce76ac4f3ced490650e2688f926e19f3da6cb49245db0a3b1c35d45c3253` | earlier Plex release (see below) |
| `IBMPlexSans-Regular-Latin1.woff2` | IBM Plex Sans | 400 | `b5ad7bd39f996144915f0ad9849a90183b27d8c28ad97ed98af5b1bebc51f6b1` | `@ibm/plex-sans@1.1.0`, byte-identical |
| `IBMPlexSans-Medium-Latin1.woff2` | IBM Plex Sans | 500 | `b5610af04d0d4b5a14a621d96d974b993e945a065db1a8861918f69ef9321934` | `@ibm/plex-sans@1.1.0`, byte-identical |
| `IBMPlexSans-SemiBold-Latin1.woff2` | IBM Plex Sans | 600 | `fff0ab3a88b0b4aa0b693e4f0201359a15183b08e3fa5696d1918d8f0ade8ad5` | `@ibm/plex-sans@1.1.0`, byte-identical |
| `IBMPlexSans-Bold-Latin1.woff2` | IBM Plex Sans | 700 | `914f1400f363e636b6f9cc7965aa807ff01e93586e1437617525cba0a62aa78d` | `@ibm/plex-sans@1.1.0`, byte-identical |
| `IBMPlexMono-Regular-Latin1.woff2` | IBM Plex Mono | 400 | `e8993d946649b9d01abb1ed06d574b19d8ea3e66b5c3948602db335c44c18e56` | earlier Plex release (see below) |

Subset: **Latin-1**. IAMAI's interface is English, and tenant-derived names are Latin; the
Latin-2, Latin-3, Greek, Cyrillic and Pi subsets are not shipped. A name outside Latin-1
falls back to the system stack named in `FONTS` (`src/ui/tokens.ts`), which is a legible
fallback rather than a missing glyph.

**Italics are deliberately omitted.** Nothing in the product's voice needs one — IAMAI
emphasises with weight and with structure, not with slant — and an unshipped face is a
request never made. A browser will synthesise an oblique if some future CSS asks for italic;
the design lint's font rules are what stop that being asked for.

### The two the Sans release does not match

`IBMPlexSans-Regular/Medium` are byte-identical to `@ibm/plex-sans@1.1.0`. The Serif and Mono
faces predate that release: they are IBM Plex split Latin-1 `woff2` under the same OFL, from
an earlier Plex version than 6.4.1, and their bytes differ from the current publication.

This is recorded rather than repaired. Replacing a shipped face changes the metrics of every
rendered page, which is a typography change, and typography application belongs to the
restoration pack — where it can be seen against the approved packs instead of landing
invisibly inside an asset task. **Pack 030 should normalise all four Serif/Mono faces onto
one Plex release** at the same time it applies the type roles.

## Local readiness — what 029 did, what 030 owes

Task 029 added the two faces the brand contract's roles need and nothing else:

- `IBMPlexSans-SemiBold-Latin1.woff2` (600) — strong body, labels, controls;
- `IBMPlexSans-Bold-Latin1.woff2` (700) — the `IAMAI` wordmark.

They are **staged, not switched on**: `FONT_FILES` in `src/ui/tokens.ts` still lists the five
faces production renders, so `tokens.css`, the preloads in `index.html` and every rendered
page are byte-for-byte unchanged by their presence. Nothing downloads them yet.

That is deliberate. The wordmark's face has to exist before anything can typeset the wordmark
— a browser asked for weight 700 with no 700 face draws a synthesised fake bold, which is not
the approved wordmark — but turning the weights on is a production typography change, and
this task does not make one.

**Pack 030 owes:**

1. register 600 and 700 in `FONT_FILES`, regenerate `src/ui/tokens.css` (`node
   scripts/gen-tokens.mjs`) and `home/theme.css`, and preload only the faces the first paint
   actually uses;
2. widen `design-lint.test.ts` rule 4 from `400|500` to the weights the contract's role table
   names;
3. add IBM Plex Serif 600/700 for the display and heading roles, from the same release it
   normalises Serif onto;
4. typeset the header lockup as the mark asset beside the live text `IAMAI` in IBM Plex Sans
   700 — never as an exported SVG carrying `<text>`.
