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

No IBM Plex package is a dependency of this repository. The faces are nine files totalling
about 195 KB; a ~4 MB (single family) to ~170 MB (umbrella) package in the lockfile to serve
nine of them would be a cost every `npm ci` pays for nothing. The files are copied from the
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
| `IBMPlexSerif-Regular-Latin1.woff2` | IBM Plex Serif | 400 | `6ebe5b7a2bbe864712e0d87a785a77ebde8a58d940d6163c1f03c6ffab1cd9a9` | `@ibm/plex-serif@1.1.0`, byte-identical |
| `IBMPlexSerif-Medium-Latin1.woff2` | IBM Plex Serif | 500 | `63192198a475ef816e7bb4e8c08c92cb7a5375e7b2f49c0539dd81975ca03435` | `@ibm/plex-serif@1.1.0`, byte-identical |
| `IBMPlexSerif-SemiBold-Latin1.woff2` | IBM Plex Serif | 600 | `1d34d4612be8d2f06a25858a8bc3c3c3b5c4ec0ee1285501c3a4df2ddace7afa` | `@ibm/plex-serif@1.1.0`, byte-identical |
| `IBMPlexSerif-Bold-Latin1.woff2` | IBM Plex Serif | 700 | `73857a0df38d16f442de5b1dfcbd119c75d123e783aaa82de781dcb531c6320b` | `@ibm/plex-serif@1.1.0`, byte-identical |
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

### The one face the current release does not match

Every Sans and every Serif face is byte-identical to `@ibm/plex-sans@1.1.0` /
`@ibm/plex-serif@1.1.0`. Task 030's correction normalised the Serif family: Regular and
Medium predated 1.1.0, and adding SemiBold and Bold from 1.1.0 beside them would have left
one family typeset from two releases, so all four were replaced from the same package at the
same time. That is a metric change to every rendered serif heading, which is why it belongs
to a typography task and not to an asset task.

`IBMPlexMono-Regular-Latin1.woff2` still predates 1.1.0. It is a single face in a family of
one, so it cannot disagree with a sibling, and nothing in the type roles asks Mono for a
second weight. Normalising it changes the metrics of every code block and identifier for no
correctness gain; a pack that restores a technical surface can take it.

## Local readiness — what is switched on

Task 029 staged the two Sans faces the brand contract's roles need:

- `IBMPlexSans-SemiBold-Latin1.woff2` (600) — strong body, labels, controls;
- `IBMPlexSans-Bold-Latin1.woff2` (700) — the `IAMAI` wordmark.

Task 029 staged them without switching them on: `FONT_FILES` in `src/ui/tokens.ts` listed
five faces, so nothing downloaded the other two. Task 030 applied the type roles and its
correction finished them, and every weight the product sets now has a real face:

1. all nine faces are registered in `FONT_FILES`, so `@font-face` declares each one in the
   generated `src/ui/tokens.css` and `home/theme.css`;
2. `index.html` preloads the seven a first paint sets text in — Serif Regular, Medium and
   Bold, Sans Regular, Medium and SemiBold, Mono Regular. Serif SemiBold is declared and not
   preloaded, because no rule sets it yet;
3. `ROLE_WEIGHTS.display` is the brand's approved **700**, set in a real IBM Plex Serif Bold
   rather than a browser-synthesised fake bold;
4. `design-lint.test.ts` rule 4 admits a weight only through a named `--weight-*` role, and
   `src/ui/tokens.test.ts` fails if a role's weight has no staged face, if a staged file is
   undeclared, or if a declared file is unstaged. It also reads every rule in `src/ui/app.css`
   and `home/home.css` that names a Plex family beside a weight and fails when that pair has
   no staged face — a role is not the only way a page asks for a face, and Mono ships 400
   only, so production sets the technical role at 400. `src/brand/brand.test.ts` applies the
   same rule to `iamai-brand-system.html`, whose specimens are where a later pack reads the
   approved weights, and fails if the SHA-256 table above stops matching the bytes under
   `public/fonts/`.

**Still open for a later pack:** typeset the header lockup as the mark asset beside the live
text `IAMAI` in IBM Plex Sans 700 — never as an exported SVG carrying `<text>`.
