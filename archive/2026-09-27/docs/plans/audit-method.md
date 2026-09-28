# How IAMAI is audited

The method the V1 audit runs on. It is taken from how the field does this, not
invented here; each part says where it comes from and why it earns its place in a
tool whose output an admin types into a live tenant.

## Why more than one method

Comparisons of the two standard inspection methods on real systems find they do
not overlap: heuristic evaluation finds **more problems at lower severity**,
cognitive walkthrough finds **fewer at higher severity**, and the walkthrough
finds far more of the learnability problems — the ones where a person cannot work
out what to do next (JAMIA 24(e1), and MeasuringU's comparison). A product like
this needs both, applied to different things:

- **Heuristic evaluation** for the parts that must be *consistent*: every Tasks
  Remaining tile, every Implementation Task, on every step. Breadth, conformity,
  one bar applied uniformly.
- **Cognitive walkthrough** for the part that must be *learnable*: the journey
  from Connect to a deployed policy. Depth, one scenario at a time, asking at
  every step whether the next action is discoverable and whether the person can
  tell it worked.

Running the same method twice would find the same class of fault twice.

## The four rubrics

### 1. The conformity bar (heuristic passes)

The Establish Emergency Access steps are the owner-approved bar. A tile or a task
conforms when it reads as they read: subject → what the scan found → where to do
it; a numbered procedure in plain sentences with exact portal paths and field
values; a dated source line. Nothing repeated between a tile and the procedure
below it.

### 2. Documentation quality (instruction passes)

The dimensions documentation audits use — accuracy, completeness, clarity,
structure, usability, accessibility, ownership — with two of their practices
adopted directly:

- **Walk the procedure while reading it.** A step is judged by following it, not
  by reading it. IAMAI never writes to a tenant, so "following it" means checking
  every portal path, blade name and field value against current Microsoft Learn
  and against the pinned baseline's own definition, and saying which was checked
  and when.
- **Read it as three people.** The admin who has never built a Conditional Access
  policy; the one who has and wants the difference; the person who has to answer
  for it later. Veterans and newcomers see different faults.

### 3. Plain language (wording passes)

ISO 24495-1's four governing principles: the reader can **find** what they need,
**understand** what they find, **use** it, and the text can be **evaluated**
against that. A sentence that cannot be acted on, or that only a specialist can
parse, fails whatever its accuracy.

### 4. Value (every pass)

HEART's Goals-Signals-Metrics, cut to what a tool with **no telemetry** can
honestly use. For each surface: the job it exists to do, the signal in the
artifact itself that it did it, and what would falsify that. No analytics, no
inferred engagement — this product collects nothing, so evidence is what a reader
can see on the screen or in the export.

## Severity, and what gets fixed first

Findings are rated 0–4 as Nielsen's scale does, from cosmetic to catastrophe,
judged on frequency × impact × persistence, and then placed on an impact/effort
matrix for scheduling. A finding is only actionable with all four of:

1. **The screen**, named as a person would name it.
2. **What it says today**, quoted.
3. **What a person would get wrong** because of it.
4. **The fix**, and its severity.

In this product, severity has a domain twist that overrides the usual reading:
**anything that could make an admin build a policy wider than intended, or lock
somebody out, is a 4 regardless of how rare it looks.** The "Configure: No matches
everything" class found on 2026-09-19 is the archetype — a cosmetic-looking
omission in a procedure that silently widens a policy to every client app.

## Rules of evidence

- Reproduce it or drop it. Every finding is checked against the current tree or
  the rendered demo before it is written down; a finding that no longer happens
  is deleted, not carried.
- Quote, don't paraphrase. The audit's value is that it says what the product
  says.
- Three independent passes, then merge. Inspection research is consistent that a
  single evaluator misses most of what a small group finds; independent passes
  that are merged afterwards beat one pass that tries to see everything.
- Separate **finding** from **fix**. The audit produces findings with
  recommendations; the fix pass decides and applies, so no audit silently becomes
  a rewrite.
- Frozen means frozen. A finding against a frozen step is written down, never
  applied, however small.

## Sources

- [Heuristic evaluation vs cognitive walkthrough](https://measuringu.com/he-cw/) — MeasuringU.
- [Comparison on a health information system](https://academic.oup.com/jamia/article/24/e1/e55/2631488) — JAMIA 24(e1): HE finds more, lower-severity; CW finds fewer, higher-severity, and more learnability faults.
- [How to audit documentation](https://www.writerresource.com/post/how-to-audit-your-existing-documentation-a-step-by-step-guide) — rubric dimensions, scoring, prioritisation.
- [ISO 24495-1:2023 Plain language](https://www.iso.org/standard/78907.html) — the four governing principles.
- [Google HEART and Goals-Signals-Metrics](https://www.productplan.com/learn/heart-framework-product-decisions) — value measured by the job, not the click.
- [Service blueprinting](https://www.nngroup.com/articles/service-blueprinting-faq/) and [pluralistic walkthrough](https://en.wikipedia.org/wiki/Pluralistic_walkthrough) — auditing an end-to-end journey with more than one kind of reader.
