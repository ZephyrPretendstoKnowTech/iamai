# Baseline options: research, no decision (2026-10-04)

The owner's order: Jon's baseline first; another baseline is a later decision. This is the
research behind that decision. It records options and their risks, and recommends nothing.
Facts were read from GitHub and the authors' own pages on 2026-10-04. Anything not verified
says so.

## The current baseline
Jon Hope's baseline is used with his explicit permission; the owner holds the record. Jon
is a Microsoft MVP (Security, Identity and Access) and an M365 Solutions Architect at Inforcer
(<https://www.m365.fm/guests/jonathan-hope/>). His repository carries no licence file, so any
other baseline needs the same footing: a licence that allows redistribution, or its author's
permission.

## The options
| Option | Author | Kind and format | Policies | Licence: can a public MIT repo pin and redistribute it? | Last push |
|---|---|---|---|---|---|
| [Jhope188/ConditionalAccessPolicies](https://github.com/Jhope188/ConditionalAccessPolicies) (current) | Jon Hope, MVP; Inforcer | Policy set; Graph JSON and markdown | 38 pinned | No licence file; used with his permission | 2026-09-19 |
| [j0eyv/ConditionalAccessBaseline](https://github.com/j0eyv/ConditionalAccessBaseline) | Joey Verlinden, MVP (Windows & Devices; Security) | Persona-based; Graph JSON per policy, plus a MigrationTable | 35 | MIT (yes) | 2026-08-12 |
| [kennethvs/cabaseline202510](https://github.com/kennethvs/cabaseline202510) | Kenneth van Surksum, MVP since 2010 | Category-based; Graph JSON per policy, plus a MigrationTable | 48 | None (no). The 2022 edition is GPL-3.0 | 2025-11-26 |
| [DanielChronlund/DCToolbox](https://github.com/DanielChronlund/DCToolbox) | Daniel Chronlund (MVP status not re-checked) | Policies inside a PowerShell module | 23 | None (no) | 2024-11-26 |
| [microsoft/ConditionalAccessforZeroTrustResources](https://github.com/microsoft/ConditionalAccessforZeroTrustResources) | Claus Jespersen, Microsoft | Persona framework; DSC, Terraform and XLSX, no Graph JSON | 58 (DSC) | MIT, but Microsoft-owned guidance (fails the rule's spirit) | 2024-04-02 |
| [AlexFilipin/ConditionalAccess](https://github.com/AlexFilipin/ConditionalAccess) | Alex Filipin, Microsoft employee | Ring-based; Graph JSON | about 50 | MIT | 2025-02-28 |
| [ASD Blueprint for Secure Cloud](https://github.com/ASD-Blueprint/ASD-Blueprint-for-Secure-Cloud) | Australian Signals Directorate | Global set by category; Microsoft365DSC and markdown | 15 (DSC) / 17 (site) | CC BY 4.0 (yes, with attribution) | 2026-09-18 |
| [nathanmcnulty/azd-risk-based-ca](https://github.com/nathanmcnulty/azd-risk-based-ca) | Nathan McNulty, MVP (category not verified) | A risk-policy module; Graph JSON | 9 | Unlicense (yes) | 2026-10-03 |
| [Teuftis/ConditionalAccessBaseline-Hardened](https://github.com/Teuftis/ConditionalAccessBaseline-Hardened) | Anonymous author | Policy set with its own intent JSON | 45 | AGPL-3.0 (risky) | 2026-07-19 |
| [UniFy-Endpoint/Conditional-Access-Baseline](https://github.com/UniFy-Endpoint/Conditional-Access-Baseline) | Yoennis Olmo, consultant | Zero Trust set; Graph JSON | 54 | None (no) | 2026-07-28 |
| [Noble-Effeciency13/ConditionalAccess](https://github.com/Noble-Effeciency13/ConditionalAccess) | Sebastian Flæng Markdanner, MCT | Tiered privileged-access add-ons; Graph JSON | 19 | None (no) | 2025-10-16 |
| [wypbeu/conditional-access-baseline](https://github.com/wypbeu/conditional-access-baseline) | Unknown author | Four layers; Graph JSON | 16 | MIT (yes) | 2026-09-18 |

**Checks rather than policy sources:**
- [CISA ScubaGear](https://github.com/cisagov/ScubaGear): CC0, Entra controls MS.AAD.1–9. Each
  step could be tagged with the controls it meets.
- CIS Microsoft 365 benchmark: CC BY-NC-SA, so it may be cited by control number only.
- [Maester](https://github.com/maester365/maester): MIT, the community's Conditional Access
  test suite.

**Formats and tools, not baselines:** Microsoft365DSC, EntraOps, and CIPP. CIPP is an MSP
tool licensed AGPL; its Entra standards can deploy Microsoft's own templates.

**Searched, nothing found:**
- Jan Bakker, Fabian Bader (a 2022 documentation script only), Peter van der Woude, Andres
  Bohren, Ru Campbell, Tony Redmond: blog guidance, no machine-readable policy set.
- Inforcer: commercial, no public baseline.
- UK NCSC and NIST: no machine-readable Conditional Access set.
- A recognised Terraform baseline: none.

## Notes on the strongest-looking options
- **Joey Verlinden:**
  - The only MIT, actively maintained, per-policy Graph JSON set from an MVP.
  - It is persona-based: Global, Admins, Internals, ServiceAccounts, Guests, Agents.
  - Six policies carry a Microsoft built-in `templateId`, which needs a decision against the
    owner's rule.
  - The files hold the author's tenant id and object ids, mapped in its MigrationTable.
  - 31 policies are exported On.
  - The allowed-countries location defaults to BE/LU/NL.
- **ASD Blueprint:**
  - A government source, CC BY 4.0, with every policy report-only or disabled by default.
  - It is published as Microsoft365DSC, so it needs a translator to Graph JSON.
  - The DSC file and the website disagree on the count.
  - It is aimed at Australian government needs, and some policies need E5.
- **Kenneth van Surksum:** Graph JSON, report-only defaults, and a third philosophy
  (category-based). It has no licence, so it needs his written permission.
- **Nathan McNulty:** a narrow, modern module of nine risk policies under the Unlicense. It
  is not a full baseline; it could sit beside one.

## What any future baseline would need settled
1. **Licence bar:** MIT, Unlicense, CC0 and CC BY only? Or sources with no licence given the
   author's written permission? AGPL or GPL only after legal review?
2. **Microsoft templates:** a source's policy that carries a Microsoft `templateId` (Joey's six).
3. **Placeholder translation:**
   - each source's groups, locations, strengths and authentication contexts to IAMAI's tokens
     (MigrationTable GUIDs, name-based intent, or DSC);
   - the author's tenant data never committed (the tenant guard).
4. **Report-only:** IAMAI's rollout is report-only first, whatever state the source exports.
5. **Licensing needs:** P1, P2, E5, Workload ID and Global Secure Access shown per policy.
6. **Maintenance:**
   - how updates are reviewed (by stable policy id, as Jon's are);
   - what happens if an author stops maintaining or deletes the repository;
   - whether more than one baseline may be active at once (a core baseline plus a risk
     module, for example).
7. **Recognition bar:** MVP or government only, or unknown authors with sound mechanics?
