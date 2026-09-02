# 08 — Design system v2 and shared components

Precondition: 07 committed. Read docs/design/ux-review-01.md first, especially §4.

## A. Tokens (replace the v1 file)
Dark (default): bg #0A1220, surface #0F182B, raised #152038, border #22304A, text #E6EDF7, muted #8FA3BF, accent #2DD4BF (teal), accent-hover #5EEAD4, accent-ink #04221E (text on accent), success #22C55E, warning #F5B301, danger #F04E4E, info #60A5FA, focus ring #5EEAD4 at 60%.
Light: bg #F6F8FB, surface #FFFFFF, raised #F1F5F9, border #DCE3EE, text #0F172A, muted #5B6B82, accent #0F9F8F, accent-hover #0B8478, accent-ink #FFFFFF, same status colours darkened 10% for contrast.
Type: system sans stack; sizes 30/22/17/15/13; numerals in tabular figures (`font-variant-numeric: tabular-nums`) and a monospace face for large stats and IDs.
Spacing 4/8/12/16/24/32/48; radius 12 (cards) / 8 (inputs) / 999 (chips); max content width 1100px.
Both themes must pass WCAG AA for text and chips; verify with a contrast check in tests.

## B. Components (one file each under src/ui/components, documented in a Storybook-free `docs/design/components.md` with a screenshot table generated from a dev-only /components page)
- Button: primary (accent), secondary (outline), quiet (text). Sizes md/sm. Loading state.
- Chip: status variants (done/ready/blocked/in-progress/warning/neutral) and selectable filter chips; consistent height 24px.
- InfoTip: ⓘ glyph, muted; hover and click open a popover with a title and 1–2 sentences; keyboard accessible. Replaces every "?" in the app.
- Card, Callout (info/warning/danger, left rule), Tabs (with count badges), Stat tile (mono numeral, label, optional InfoTip, clickable variant with active state).
- ProgressBar: determinate and indeterminate, with a caption line.
- Picker: typeahead multi-select over tenant objects. Empty state shows ranked suggestions (see prompt 11); results show display name, secondary line (UPN / member count / type), and a badge for inferred role; selected items render as removable chips; the list stays open until Esc, click-outside, or Done; full keyboard support.
- DataTable: sticky header, sortable columns, row hover, optional row expand, pagination at 50, CSV export hook, empty state.
- EmptyState: icon, one sentence, one action.
- Stepper: the left nav becomes a proper stepper (number, label, status chip); on widths under 900px it collapses to a horizontal strip at the top.
- Icon: one inline SVG set (1.5px stroke, 20px grid) covering shield, user, users, key, device, location, policy, chart, check, alert, info, external-link, download, print, copy, refresh, lock, search, chevron. No emoji anywhere.

## C. Fixes
- Header: tenant name only; ID moves to a tooltip on the name and to the Connect page. Nothing may overflow at 1280px.
- Footer on every page: "Read-only · nothing leaves your browser" on the left; the follow/GitHub/Source links on the right.
- Replace every ad-hoc styled element in existing pages with these components. No page keeps bespoke CSS for something a component covers.

Commit and push. Report the pages touched.
