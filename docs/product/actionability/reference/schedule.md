# Schedule reference: step dates, phases and the When column

Extracted from the code at HEAD 4cde3e6 (2026-09-12). Descriptive only: nothing here changes behaviour. `file:line` references are to that tree. Where the code does not answer a question, the entry says "not found".

## Sources

- `docs/product/actionability/RUN-CONTEXT.md`
- `docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md` (grep only: schedule / date / when / window / report-only / freeze / cadence)
- `src/roadmap/stepSchedule.ts`
- `src/roadmap/schedule.ts`
- `src/roadmap/timing.ts`
- `src/roadmap/constants.ts`
- `src/roadmap/rings.ts` (grep: `soakDays`, `RING_BANDS`, `LONG_SOAK`)
- `src/roadmap/rhythm.ts`
- `src/roadmap/campaign.ts`
- `src/roadmap/forecast.ts`
- `src/roadmap/holds.ts` (grep: `holdOf`, `isHeld`, `HoldKind`)
- `src/roadmap/generate.ts` (grep plus lines 2076–2200)
- `src/roadmap/ics.ts`
- `src/roadmap/lifecycle.ts` (lines 295–345)
- `src/roadmap/tracking.ts` (grep: `readyOn`, `observationDaysFor`)
- `src/roadmap/cleanupPhase.ts` (grep)
- `src/roadmap/plan.ts` (grep: `freeze`, `decisions`, `firstDeployment`)
- `src/roadmap/decisions.ts` (grep)
- `src/roadmap/progress.ts` (grep: `firstDeployment`, `freeze`)
- `src/roadmap/prompts.ts` (lines 255–275)
- `src/derive/phases.ts`
- `src/derive/finish.ts`
- `src/derive/readyWhen.ts`
- `src/derive/planStart.ts`
- `src/derive/planHeader.ts`
- `src/ui/surfaces/rowWhen.ts`
- `src/ui/surfaces/planRows.ts`
- `src/ui/surfaces/planBoard.ts` (lines 30–100, 160–320)
- `src/ui/surfaces/Plan.tsx`
- `src/ui/surfaces/planData.ts` (lines 240–340 plus grep)
- `src/ui/surfaces/planLanes.ts` (grep)
- `src/ui/surfaces/PrintPlan.tsx` (grep)
- `src/ui/surfaces/Export.tsx` (grep plus lines 92–100, 198–216)
- `src/ui/surfaces/stepExport.ts` (lines 55–95)
- `src/ui/surfaces/stepContract.ts` (grep: `railOf`, `railTransition`)
- `src/ui/surfaces/stepVars.ts` (grep: `planDates`)
- `src/ui/surfaces/cleanupExport.ts` (grep: `cleanupWhen`)
- `src/ui/surfaces/StepSections.tsx` (grep: `wave`)
- `src/ui/demoFacts.ts`, `src/ui/scan/connectView.ts` (grep: `planWeeks`)
- `src/actionability/*.ts` (grep: schedule / wave / phase / date)
- `src/copy/dates.ts` (grep: `absoluteDate`, `formatter`)
- `src/copy/reasons.ts` (grep: `reaches`)
- `src/content/content.ts` (grep: exports)
- `docs/design/content.json` (grep for keys only; never read whole)
- Tests, read to confirm behaviour: `src/roadmap/schedule.test.ts`, `src/roadmap/stepSchedule.test.ts`, `src/roadmap/scheduleClamp.test.ts`

---

## 1. Pipeline at a glance

The order the code runs in for one Plan computation (`src/ui/surfaces/planData.ts` `computed` memo, lines ~273–335):

1. **Start and first deployment** are resolved from the plan record: `startDate` at planData.ts:260 and `firstDeployment` at planData.ts:265 (§3.1).
2. `generateRoadmap` (generate.ts) builds the steps and does the following:
   - it proposes rings (generate.ts:2094);
   - it reads the tenant rhythm (generate.ts:2097) and sizes the registration window (generate.ts:2102);
   - it calls **`buildSchedule`** (generate.ts:2123);
   - it dates Cleanup after `schedule.targetEnd` (generate.ts:2137);
   - it writes `events` (announce/remind/enforce) at generate.ts:2165 and `reportOnlyAt` at generate.ts:2168 onto each step.
3. `applySkips` and `applyProgress`: tracking settles each policy's lifecycle (`not-deployed` / `report-only` / `ready-to-enforce` / `enforced`) and each deployed report-only policy's `tracking.readyOn`.
4. **`settleForecast(steps, schedule)`** (forecast.ts:254, called at planData.ts:331) does four things:
   - it withdraws the placement of held steps and of steps whose enforcement is unearned (placement moves to `schedule.forecastOnly`; `events` and `comms` are nulled; held steps also lose `rings` and, unless gated-create, `reportOnlyAt`);
   - it re-reads the plan's shape (`readBackPlacement`, schedule.ts:842);
   - it calls **`settleSchedule`** (stepSchedule.ts:242). That writes `step.scheduled = stepScheduleOf(step, basisOf(...))` for every step, plus `schedule.phases = phasesOf(...)`.
5. Surfaces read `scheduleOf(step)` (stepSchedule.ts:187), which recomputes from the step as it is now over the stored `basis`.

`settleForecast` is the only production caller of `settleSchedule` (grep). The test harness `src/roadmap/fixtures/run.ts:125` calls it the same way.

---

## 2. `src/roadmap/stepSchedule.ts`

### 2.1 Exported types

| Export | Line | Shape |
|---|---|---|
| `ScheduleClass` | 48 | `'complete' \| 'setAside' \| 'scheduled' \| 'observing' \| 'waiting'` |
| `ScheduledTransition` | 51 | `'prepare' \| 'decide' \| 'verify' \| 'createReportOnly' \| 'change' \| 'enforce' \| 'review'` |
| `EnforcementReadiness` | 59 | `'none' \| 'forecast' \| 'gated' \| 'earned'` |
| `ScheduleBasis` | 62–75 | what the finished schedule decided (below) |
| `StepSchedule` | 77–95 | the per-step result (below) |
| `ScheduledEvent` | 192 | `{ transition: ScheduledTransition; start: string; end: string }` |

**ScheduleClass values** (doc comment at stepSchedule.ts:36–47):
- `complete`: delivered, so nothing is left to schedule. Condition: `step.status === 'done'` (line 140).
- `setAside`: skipped by the operator. Condition: `status === 'skipped' || state.setAside` (line 141). A step marked "Doesn't apply here" gets `setAside: true` at generate.ts (device decision / notApplicable loops before line 2123).
- `scheduled`: the next milestone is placed on a day. `at` may still be null for a non-policy step with no placement, or for a create with no `reportOnlyAt`. The test at stepSchedule.test.ts:94 asserts that `scheduled` always has a day across the fixtures.
- `observing`: deployed in report-only and watched towards its review day.
- `waiting`: something holds it (`holdOf(step) !== null`, holds.ts:48) and nothing schedules what it waits on. This is the one meaning of Waiting on the Plan, and it is what the progress tile counts (Plan.tsx:247, via planState.ts:92).

**ScheduleBasis fields** (built by `basisOf`, stepSchedule.ts:102–113, from the `Schedule`):

| Field | Source |
|---|---|
| `placed: {start,end} \| null` | `schedule.placement.placed[step.id]` (the raw placement, even if later withdrawn) |
| `wave: number \| null` | `schedule.waveOf[step.id]` (after withdrawal re-read) |
| `forecastWave: number \| null` | `schedule.forecastOnly[step.id].wave`, only if that wave still exists in `schedule.waves` |
| `waveStarts: {wave,start}[]` | `schedule.waves` |
| `after: string[]` | the hard dependencies in `schedule.graph[step.id]` |
| `decisionOpen: boolean` | any `blockers` of kind `step` whose target step has `state.condition === 'needs-decision'` |

**StepSchedule fields**:

| Field | Meaning |
|---|---|
| `class` | ScheduleClass |
| `transition` | what the dated day is for, or null |
| `at` | day of the next milestone, or null |
| `range` | `{start: at, end: later(at, placed.end)}` for most scheduled branches; `{at, at}` for gated create and observing; null when `at` is null |
| `wave` | phase (wave number) the step belongs to, or null |
| `earliest` | `basis.placed.start`, or null |
| `enforcement` | EnforcementReadiness |
| `hold` | `HoldKind` from holds.ts:43 (`'unavailable' \| 'readiness' \| 'prerequisite' \| 'decision' \| 'conflict' \| 'review' \| 'evidence'`), or null |
| `after` | `basis.after`, or `[]` |
| `basis` | the ScheduleBasis, or null when no finished plan settled the step |

### 2.2 Exported functions

| Function | Line | Inputs | Output |
|---|---|---|---|
| `basisOf(step, schedule, byId)` | 102 | step (engine); `Schedule` from `buildSchedule` + `settleForecast`; `byId` map of all steps | `ScheduleBasis` |
| `createsWhileGated(step, basis)` | 121 | step, basis | true when basis present, `!decisionOpen`, `kind === 'create'`, `lifecycle === 'not-deployed'`, `holdOf(step).kind === 'readiness'` and `implementationOffered(step)` |
| `stepScheduleOf(step, basis)` | 135 | step, basis | `StepSchedule` (decision table §2.3) |
| `scheduleOf(step)` | 187 | step (reads `step.scheduled.basis`) | `StepSchedule` |
| `scheduledEventOf(step)` | 201 | step | `ScheduledEvent \| null`. Null unless class is `scheduled`/`observing` with a transition and `at`. Null for `decide`. `createReportOnly` and `review` are one day; other transitions end at `range.end` |
| `phasesOf(steps, schedule)` | 222 | steps, schedule | `WaveSchedule[]`: each wave's step ids are the wave's own that still have `scheduled.wave === w.wave`, plus any other step with that wave. Its range is widened to hold each drawn step's `scheduled.range` (drawn = not done, not floor, not doesntApply, line 214) |
| `settleSchedule(steps, schedule)` | 242 | steps, schedule | void. Writes `step.scheduled` and `schedule.phases`; idempotent |

### 2.3 Where each input comes from

`stepScheduleOf` reads these fields of the step:

| Step field read | Set by | Ultimately from |
|---|---|---|
| `status`, `state.setAside`, `state.lifecycle`, `state.condition`, `kind`, `blockers` | generate.ts + lifecycle/tracking (`applyProgress`) | engine over **scan** + **plan record** (skips, step decisions, confirmations) |
| `holdOf(step)` (holds.ts:48) | derived | engine (operations.ts `unavailableReason`, `enforcementHeld`; lifecycle `heldForReview`; blockers `held` mark from `markHoldChains`) |
| `implementationOffered(step)` | operations.ts | engine (Foundation A) |
| `reportOnlyAt` | generate.ts:2168 from `schedule.reportOnlyAt`; nulled by forecast.ts:283 for held non-gated steps | **schedule**, driven by **settings** (start, first deployment) |
| `tracking.readyOn`, `tracking.noticedAt` | tracking.ts:481–482 (`since + observationDaysFor(step)` days) | **scan** (the scan that first saw the policy in report-only; plan record `observations`) |
| `events.enforce.at` | generate.ts:2165 `eventsFor` (timing.ts:181); nulled by forecast.ts:276 | schedule ring start + tenant rhythm + display time zone (**settings**) |
| `rings[0].plannedStart` | `buildSchedule` writes ring dates (schedule.ts:708–713); rings emptied at generate.ts:2094 (unavailable or readiness-held) and forecast.ts:280 (held) | schedule |
| `step.scheduled.basis` | `settleSchedule` | schedule (§2.1) |

### 2.4 `stepScheduleOf` decision order (stepSchedule.ts:135–184)

First match wins.

| # | Condition | class | transition | at | wave | enforcement |
|---|---|---|---|---|---|---|
| 1 | `status === 'done'` (140) | complete | null | null | null | none |
| 2 | `status === 'skipped' \|\| state.setAside` (141) | setAside | null | null | `basis.wave` | none |
| 3 | held, `reportOnlyAt` set and `createsWhileGated` (144–147) | scheduled | createReportOnly | `reportOnlyAt` | **0** | gated |
| 4 | held, otherwise (149) | waiting | null | null | null | `gated` if create/adjust, else `none` |
| 5 | not create/adjust (158–161) | scheduled | `decide` if condition needs-decision; `prepare` if kind prerequisite; else `verify` (this includes `check`, `verify` **and `enforce`** kinds) | `placed.start` | `basis.wave` | none |
| 6 | lifecycle `report-only` (163–173) | observing | review | `tracking.readyOn`, or null if the window closed before `noticedAt` | `basis.wave ?? basis.forecastWave ?? waveContaining(readyOn)` | forecast |
| 7 | lifecycle `ready-to-enforce` (174–177) | scheduled | enforce | `events.enforce.at ?? placed.start` | `basis.wave ?? waveContaining(at)` | earned |
| 8 | kind `create` and lifecycle not `enforced` (178–180) | scheduled | createReportOnly | `reportOnlyAt` | `basis.wave` (its **enforcement** wave) | forecast |
| 9 | otherwise, i.e. adjust (181–183) | scheduled | change | `events.enforce.at ?? rings[0].plannedStart ?? placed.start` | `basis.wave` | forecast |

`waveContaining` (128–132) returns the last standing wave whose start is ≤ `at`, or 0.

Row 8 notes: a not-deployed create's `at` is its early report-only creation day, but its `wave` is the enforcement wave. `range` spans from creation to the placement end, so `phasesOf` widens that phase back to the creation day. This is the fix the file header describes (stepSchedule.ts:3–16).

---

## 3. How a step's date is computed, end to end

### 3.1 Start date source

| Value | Where | Rule |
|---|---|---|
| Proposed start | derive/planStart.ts:39–41 `proposedStart` | today in the display zone, `T12:00:00.000Z` |
| Effective `startDate` | planData.ts:260 | `saved.startDate` (plan record) `?? proposedStart(displayTimeZone)` |
| User edits | Plan.tsx:287 (header Start date, before Start the plan) and Plan.tsx:637 (Settings → Plan starts) | `YYYY-MM-DDT12:00:00.000Z` via `data.setStart` |
| Start the plan | Plan.tsx:291 → planData.ts:411–414 | anchors `startDate`, `firstDeployment` and `startedAt` in the plan record |
| Engine fallback | generate.ts:2076 | `input.startDate ?? nextWorkingDay(snapshot.asOf)` (schedule.ts:296) |
| Day 0 | schedule.ts:475 | `toWeekday(startIso)`: Saturday/Sunday → Monday (UTC weekday) |

**First deployment** is the day report-only creation and the registration window open:
- The proposal is `nextWorkingDay(toWeekday(start))` (planStart.ts:11–13).
- `effectiveFirstDeployment` (planStart.ts:22–27) uses the saved value if it is ≥ start. If the plan was started before the setting existed, it uses start. Otherwise it uses the proposal.
- The settings input is at Plan.tsx:640–643, and it has `min=start`.
- In buildSchedule, `creationDay = max(day0, toWeekday(firstDeployment))` (schedule.ts:494).

### 3.2 Calendar days vs working days

| Quantity | Unit | Code |
|---|---|---|
| Day 0 length `day0Days = min(5, 1 + open prerequisite/check steps)`, or 0 | calendar days, end clamped with `toWeekday` | schedule.ts:484–488 |
| Registration window | **working days** (`addWorkingDays`, rhythm-aware) | schedule.ts:505–507; size from campaign.ts:27–33 (`ceil(toSetUp / 5)`, max 20) |
| Per-step observation (report-only) window | calendar days (`addDays`) | schedule.ts:618 |
| Plan-level observation window (reported) | calendar days, end `toWeekday`; re-read to end at the first wave start | schedule.ts:549, 912–916 |
| Ring soak | calendar days (`addDays(cursor, soak)`); the end is not clamped | schedule.ts:670 |
| Tracking time gate `readyOn` | calendar days (`since + days × 86 400 000`) | tracking.ts:481–482 |
| Announce/remind notice | working days (`workingDaysBefore`) | timing.ts:18, 224, 239 |
| Cleanup rows | one working day each after `targetEnd` | cleanupPhase.ts:95–99 |
| Band expected length | `BANDS[band].weeks × 7` calendar days | schedule.ts:474; constants.ts:16–20 |

Working day definition (timing.ts:35–39): Monday–Friday always count. Saturday or Sunday count only if `rhythm.workingDays` includes them. `tenantRhythm` (rhythm.ts:88–164) derives those from sign-in buckets: a day counts when it carries ≥25% of the busiest day, and the default is `[0..4]`. Settings shows this read-only as "Eligible workdays" (Plan.tsx:630–631, 644–647); it cannot be edited.

### 3.3 Per-step durations (`buildSchedule`, schedule.ts:464–794)

Only `isWork` steps are placed. That excludes done, skipped, and steps where `unavailableReason !== null` (schedule.ts:308–310).

| Step kind | start | end |
|---|---|---|
| `prerequisite`, `check` | `day0` | `day0End` (schedule.ts:572) |
| `verify` | `verification.start = creationDay` | `addWorkingDays(creationDay, registrationDays)` (schedule.ts:573) |
| `create` | enforcement ring 0 start (below); `reportOnlyAt = creationDay` (schedule.ts:615) | last ring end |
| `adjust`, `enforce` | enforcement ring 0 start | last ring end |

**Earliest enforcement day** for an enforcement step (schedule.ts:614–651) is the latest of:
- `create`: `creationDay + observationDaysFor(step)` (3 or 7 days). `adjust`/`enforce`: `creationDay`.
- `afterDay0 = day0End + 1 day` when Day 0 has work, else `day0` (schedule.ts:621).
- **Phase order**: the first placed start of any lower `phase` (schedule.ts:633–639; reason `phase`).
- **Hard dependencies**: each placed dependency's `end` (schedule.ts:640–651; reason `verification` or `dependency`).

**Soak windows** (schedule.ts:656–662):
- With rings, each ring's `soakDays` applies. `RING_BANDS` in rings.ts:27–32 gives 5 days, or 7 for the >3000 band; `ringBandFor` makes it 10 when active > 10 000 (rings.ts:34–42).
- A step with no rings gets one window: 1 day if quiet (`nobodyAffected`, or family `other` when there is no effect reading), else `ringBandFor(activeUsers).soakDays`.

**Layout** (schedule.ts:664–675): ring 0 starts at `shift(earliest)`. Each later ring starts at `shift(previous ring end)`. Soft dependencies (`same-people`) move the whole step until ring *i* starts when the other step's ring *i* ends (schedule.ts:679–695; reason `soft`).

**Relaxation**, when the plan ends after `day0 + expectedDays + 7` (schedule.ts:726–744):
1. Shorten long soaks to `ringBandFor(active, false)`. This only matters above 10 000 active people.
2. Retry with `same-people` soft edges ignored, if that ends sooner.

Each relaxation is recorded in `derivation.relaxed`.

### 3.4 Dependency ordering

`dependencyGraph` (schedule.ts:341–420). Hard edges:
- the step's own `blockedBy`;
- every enforcement step → `s-prereq-exclusion-group`;
- a step that stops people → `s-prereq-break-glass`;
- a step that asks for a method → the `verify` step;
- a step that uses locations → `s-prereq-trusted-location` and `s-prereq-allowed-countries`.

If `analysisUnknown`, the step takes all of these edges. The soft edge `same-people` links two enforcement steps whose policies overlap, both prompt people, and fall in different non-`zero` batch classes.

Placement order is Kahn's algorithm over hard edges, with ties broken by lower `phase` and then declaration order (schedule.ts:423–456). A cycle falls back to generator order.

### 3.5 The enforcement-day clamp (`shift`, schedule.ts:581–607)

Every enforcement ring start passes through `shift`:
1. `toEnforcementDay` (timing.ts:82–86): **Tuesday, Wednesday or Thursday**. Monday, Friday, Saturday and Sunday move to the next Tuesday.
2. If the cursor is inside the freeze or on the working day before it, jump to `toEnforcementDay(freeze.to + 1 day)` (reason `freeze`).
3. Capacity:
   - Joining an existing same-day, same-class batch is always allowed.
   - A new batch needs fewer than `EVENTS_PER_DAY[band]` batches that day (small 2 / mid 3 / large 4, schedule.ts:204) and fewer than `ENFORCEMENT_CAP[band]` batches that week (3 / 3 / 2, schedule.ts:183).
   - Otherwise try the next enforcement day (reason `cap`). The week is an ISO Monday-based UTC week (schedule.ts:313–318).
4. Batch class (schedule.ts:239–257): `zero` / `mfa` / `deviceSession` / `other`.

Test coverage:
- schedule.test.ts:123–130: Tuesday–Thursday.
- schedule.test.ts:189–202: the weekly cap.
- schedule.test.ts:276–294: a batch shares one day.
- scheduleClamp.test.ts:42–51: every fixture's start, observation end and wave starts are weekdays.

### 3.6 Waves and phases

`readBackPlacement` (schedule.ts:842–931):
- **Wave 0** holds every non-enforcement, runnable step, spanning `day0`→`day0End` (schedule.ts:873–875). Its label is "Preparation".
- **Waves 1..n**: one per ISO start week of the enforcement placements, in date order (schedule.ts:879–892). `phase` is the most common step phase, never lower than the previous wave's.
- `targetEnd` is the latest of `day0End`, `verification.end` and every wave end (schedule.ts:894). `weeks = max(1, round(totalDays / 7))` (schedule.ts:921).
- After `settleForecast` withdraws steps, this runs again without them (forecast.ts:291). `phasesOf` then widens each wave to its steps' scheduled ranges (stepSchedule.ts:222–239).

Labels (derive/phases.ts:9–15): phase 0 reads `phases.first` "Preparation"; other waves read `phases.middle` "Phase {n}", numbered in order; Cleanup reads `phases.last` "Cleanup" (content.json:329–335). `waveLabels` is used only by `PrintPlan.tsx:122`. The Plan screen draws lanes rather than phases (Plan.tsx:432–433), and `PlanRow` carries the wave only as a `data-wave` attribute (StepSections.tsx:72).

### 3.7 Weekends and holidays

- Weekends: clamped as described in §3.1, §3.2 and §3.5. Ring and observation ends reached with `addDays` are not clamped, and neither is tracking `readyOn`.
- Holidays: **not found**. schedule.ts:154–158 states the schedule's only inputs are start, freeze, rhythm and the registration window: "No pace, no windows-per-week, no holidays, no per-step dates."
- Time zone: all date arithmetic is on UTC days. Inputs are anchored at 12:00 UTC. Display goes through `absoluteDate` (copy/dates.ts:45–47): `Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: displayTimeZone })`, so the runtime default locale.

---

## 4. "Cadence"

**Not found** as a code concept. The only code hit is a comment in `src/roadmap/campaign.ts:4` about a registration-window "sign-in cadence model (prompt 43)" that has since been replaced. The playbook's one use is §19 (deferred): "forecast dates derived from the graph and cadence".

The nearest concepts in code:
- `ENFORCEMENT_CAP`: change windows per week (schedule.ts:183).
- `EVENTS_PER_DAY` (schedule.ts:204).
- Ring `soakDays` (rings.ts:27–42).
- `REGISTRATION_PER_WORKING_DAY = 5` and `REGISTRATION_MAX_WORKING_DAYS = 20` (constants.ts:27–29).
- `NOTICE_WORKING_DAYS` (timing.ts:18).
- The tenant rhythm's working days, working hours and peak (rhythm.ts).

---

## 5. The report-only window

| Aspect | Answer |
|---|---|
| Length | `OBSERVATION_DAYS = 7`; `OBSERVATION_DAYS_ZERO = 3` where the evidence proves nobody is affected (constants.ts:50–53) |
| Per-step selection | `observationDaysFor(step)`: 3 when `batchClassOf(step) === 'zero'`, i.e. `nobodyAffected` (timing.ts:150–173); otherwise 7 (schedule.ts:227–229) |
| Configurable | **No.** These are constants with no settings input; the Settings panel (Plan.tsx:610–679) has none |
| Effect on the enforce step, not yet deployed | a `create` step's earliest enforcement is `creationDay + observationDaysFor` calendar days (schedule.ts:618–622), then the §3.5 clamp. `adjust`/`enforce` steps do not wait for it |
| Plan-level reported window | `obsDays = 7` if any create/adjust work exists (schedule.ts:515–516), from `creationDay`; re-read to end on the first enforcement wave's start (schedule.ts:912–916). Print shows it as "Observation window · {days} days" (content.json:1671; PrintPlan.tsx:233–236) |
| Already deployed in report-only | the tracking time gate `readyOn = since + observationDaysFor` (tracking.ts:481–482) is one of two gates; the evidence gate is the other (derive/readyWhen.ts). While it is open: class `observing`, `at = readyOn`, and the row reads "ready {date}". The placed enforcement is withdrawn as unearned (forecast.ts:138–140, 254–295) until lifecycle reaches `ready-to-enforce`; then `at = events.enforce.at ?? placed.start` (stepSchedule.ts:175) |
| Where the playbook sits | §7: "No universal Report-only duration exists in this document." Observation is an evidence predicate |

---

## 6. Change freeze

This is **implemented**. One freeze per plan.

| Aspect | Code |
|---|---|
| Type | `ChangeFreeze = { from: string; to: string }` (schedule.ts:67) |
| Option | `ScheduleOptions.freeze` (schedule.ts:160); accepted only if `from < to` by string compare, else null (schedule.ts:478) |
| Set by | Settings → "Change freeze" from/to inputs (Plan.tsx:648–655) → `data.setFreeze` (planData.ts:421–422) → plan record `freeze` (planData.ts:271) → `generateRoadmap({ changeFreeze })` (planData.ts:309) → `buildSchedule({ freeze })` (generate.ts:2124) |
| Persisted | plan record (decisions.ts:58–59; progress.ts:179); plan file `schedule.freeze` (plan.ts:64/169/222; Export.tsx:177, 211) |
| Rule | `inFreeze(iso)`: `from ≤ iso ≤ to`, by ISO string compare (schedule.ts:575). `dayBeforeFreeze`: not in the freeze, but the next working day is (schedule.ts:578). Either condition moves the cursor to `toEnforcementDay(freeze.to + 1 day)` (schedule.ts:584–588) |
| Scope | only **enforcement ring starts** pass through `shift`. Report-only creation, prerequisites, the verification window, ring ends and Cleanup days are not checked |
| Critical-path sentence | constraint `freeze` → `engine.critical.freeze` "the change freeze ends on {to} and {step} starts after it" (content.json:185; schedule.ts:992–994) |
| Words | `pages.plan.settings.freeze` "Change freeze", `freezeFrom` "from", `freezeTo` "to", `freezeNote` "No step enforces inside the freeze or on the last working day before it." (content.json:600–603) |
| Test | schedule.test.ts:204–211 (the freeze `to` in that test is `T23:59:59`) |

The following edge cases come from reading the code; no test covers them:
- If only "from" is entered, the input sets `to` equal to `from` (Plan.tsx:651). Then `from < to` is false, so the freeze is silently dropped (schedule.ts:478).
- The inputs store `new Date('YYYY-MM-DD').toISOString()`, which is midnight UTC (Plan.tsx:651, 653). Schedule cursors normally carry `T12:00`, so a cursor on the final freeze day compares greater than `to` and is not treated as inside the freeze.
- Blackout windows: grep for `blackout` finds nothing in code.

---

## 7. The When column

Two layers decide what the column shows. `rowWhen` (rowWhen.ts:50–120) produces a value. `boardWhenOf` → `boardWhen` (planBoard.ts:238–244, 276–297) turns that value into the words on the board. The Plan passes `when` to `<Row>` (Plan.tsx:213–215), and the opened step's rail reuses it (stepContract.ts:1229–1234).

### 7.1 `boardWhenOf` pre-check (planBoard.ts:280)

| Condition | Text | Key |
|---|---|---|
| `state.condition === 'baseline-conflict'` and not done/skipped | "Deferred" | `pages.app.plan.stepContract.rail.deferred` (content.json:1562) |

### 7.2 `rowWhen(step)`: the value (first match wins)

| # | Condition | Value | Key / text |
|---|---|---|---|
| R1 | `status === 'done'` (52) | `''` | — |
| R2 | `scheduleOf.class === 'scheduled'`, `at` set, and `isHeld` (58); this is the readiness-gated create | `absoluteDate(at)` | date |
| R3 | `readsThreshold(step)` (44–48, 59–62): writable, `heldByReadiness` (finish.ts:37–41), and not class `scheduled` | the readiness blocker's `binding` string | `pages.plan.blocked.readiness` "when {measure} reaches {threshold} (now {value})" (content.json:643, filled by copy/reasons.ts:58) |
| R4 | `heldForReview(step)` (68) | "held until reviewed" | `pages.plan.heldForReview` (content.json:555) |
| R5 | `holdOf(step).kind === 'evidence'` (71) | "held until the records clear" | `pages.plan.heldForEvidence` (content.json:554) |
| R6 | `isHeld(step)`, any other hold (76) | `''` | — |
| R7 | `readyWhen(step)` present and `status !== 'ready-to-enforce'` (90–93) | kind `now` → "ready now"; `since` → "held until the records clear"; `on` → "ready {date}" | `pages.plan.readyNow` (553), `heldForEvidence` (554), `readyOn` (552) |
| R8 | kind `prerequisite` or `check` (94) | "now" | `pages.plan.now` (content.json:551) |
| R9 | `unavailableReason(step) !== null` (100) | `''` | — |
| R10 | `awaitingDeployment` (lifecycle `not-deployed`) (109–112) | `absoluteDate(scheduled.at ?? reportOnlyAt)`, or `''` | date |
| R11 | otherwise (118–119) | `absoluteDate(scheduled.at)` (unsettled: `events.enforce.at ?? rings[0].plannedStart`); else "now" if `status === 'ready'`; else `''` | date / `pages.plan.now` |

`rowWhenWraps` (127–129) is true for R3, R4, R5 and R7-`since`. It means the value is a reason, not a date.

### 7.3 `boardWhen(when, …)`: the displayed text (first match wins)

The options passed in by `boardWhenOf` (planBoard.ts:284–296):
- `held` = `scheduleOf(step).class === 'waiting'`, or `isHeld(step)` when the step was never settled.
- `waitsOn`:
  - if held, built from `holdWaitsOn(step)`;
  - else if `status === 'blocked'`, built from its `step`-kind blockers;
  - else none.
  - Label (planBoard.ts:250–255): one step whose title is ≤ 32 characters (`AFTER_TITLE_CHARS`, planBoard.ts:247) gives "After {step}"; anything else gives "After prerequisites".
- `groupDay` = `absoluteDate(scheduled.at ?? waveStartOf(step))` (planBoard.ts:263–267, 288).

| # | Condition | Shown | Key / text |
|---|---|---|---|
| B1 | `status === 'done'` | "Complete" | `pages.plan.when.complete` (content.json:566) |
| B2 | value is exactly "now" (R8/R11) | `groupDay`, or "Not scheduled" | date / `pages.plan.when.notScheduled` (567) |
| B3 | `held` and the value is not a reason (`!rowWhenWraps`) | `waitsOn` label, or "Held" | `pages.plan.when.after` "After {step}" (568) / `pages.plan.when.afterPrerequisites` "After prerequisites" (569) / **"Held" is the code constant `BOARD.held` (planBoard.ts:84), not a content.json key** |
| B4 | value non-empty | the value (a date, or an R3/R4/R5/R7 reason) | as §7.2 |
| B5 | otherwise | `waitsOn` label, or "Not scheduled" | `pages.plan.when.after` / `afterPrerequisites` / `notScheduled` |

In short: a date shows when the step is scheduled or observing and has a day. "Held" shows when a hold has nothing it waits on that can be named. "Not scheduled" shows when there is no date, no hold, and nothing waited on, or when a prerequisite/check "now" has no phase day. "After prerequisites" shows for several waited-on steps, or one whose title is too long. "Deferred" shows for a baseline conflict.

### 7.4 Cleanup rows

`cleanupWhen(row, undated)` (cleanupExport.ts:37–40), used at Plan.tsx:511:
- done → "done {date}" (`pages.app.plan.cleanupDoneRow`, content.json:1169);
- the plan cannot finish (`planFinish(...).held`, Plan.tsx:155) → "Not scheduled" (`pages.plan.when.notScheduled`);
- otherwise → `absoluteDate(row.day)`.

### 7.5 Opened step rail

`railOf` (stepContract.ts:1202–1235):
- A scheduled or observing day (not `decide`) reads `absoluteDate(s.at)`, with sub-line `pages.app.plan.stepContract.railTransition.{createReportOnly|change|enforce}` ("Create in report-only" / "Change the existing policy" / "Turn the policy on", content.json:1570–1575), or else the milestone label.
- Held and undated, the rail reuses the When column's Held / After text.

---

## 8. Plan-level finish date

**Yes.** `planFinish(steps, cleanupEnd)` in `src/derive/finish.ts:54–94`:
- `finish` is the latest `rings.at(-1).plannedEnd` over steps that are not done/skipped, extended to the Cleanup end.
- `finish` is null whenever any required (non-floor) step is held. That includes a readiness-threshold hold.
- Only ring ends count (`lastRingEnd`, finish.ts:52). A ringless step's placement end and the verification end do not.
- `planWeeks` (finish.ts:110–113) is `ceil((finish − schedule.start) / 7 days)`. When there is no finish it falls back to `schedule.estimate.weeks` (set at forecast.ts:258), then `schedule.weeks`.

Related but separate:
- `Schedule.targetEnd` (schedule.ts:894) is the placement end, used by the grounding bundle and to date Cleanup (generate.ts:2137).
- `schedule.estimate.targetEnd` (forecast.ts:258) is the pre-withdrawal estimate.

| Surface | Uses finish? | Where |
|---|---|---|
| Plan screen header | Computes `planFinish` (Plan.tsx:146) but **does not print the date**. The progress tiles replaced the header line (Plan.tsx:258–260). It uses `finish.held` for Cleanup "Not scheduled" and `planWeeks` inside the length InfoTip: `pages.plan.lengthTip` "The plan is {weeks} because {constraint}." / `lengthTipEstimate` (content.json:548–549; Plan.tsx:153–163, 270) | Plan.tsx |
| Print | Yes: `headerLine1` → `pages.plan.line1` "… finishes {finish} · {weeks}" or `line1CannotFinish` (content.json:546–547); the cover date range is `schedule.start → finish ?? targetEnd` | PrintPlan.tsx:127, 145, 153, 173; derive/planHeader.ts:33–40 |
| ICS | No finish event. `planFinish(steps).held` suppresses Cleanup entries | ics.ts:90–92 |
| Grounding bundle (Export) | Yes: `plan.finish`, plus `targetEnd` and `weeks` (null while held) | prompts.ts:264–271 |
| Connect sample tile | weeks only, via `planWeeks` | ui/demoFacts.ts:22–25; ui/scan/connectView.ts:490 |
| `line1Started` "… started {start} · finishes {finish}" | defined (content.json:674, planHeader.ts:38), but the only caller (PrintPlan) passes `startedFrom: null` | planHeader.ts, PrintPlan.tsx:153 |

---

## 9. Other consumers of the schedule

| Consumer | Reads | Where |
|---|---|---|
| Plan board When column | `rowWhen`, `boardWhenOf`, `waveStartOf`, `scheduleOf` | rowWhen.ts; planBoard.ts:263–297; Plan.tsx:213–215 |
| Plan Waiting tile / row state | `scheduleOf(step).class === 'waiting'` | planState.ts:92; Plan.tsx:247–252 |
| Opened step | `ctx.reportOnlyAt`, `ctx.scheduledOn = waveStart` (Plan.tsx:589); `stepContract.schedule = scheduleOf` (stepContract.ts:776); `railOf` (stepContract.ts:1202); `nextMilestone` (lifecycle.ts:306, 339) | — |
| Step variables | `planDates(steps, schedule.start, …)`: first enforce, MFA enforce, enrol window days (from `events.enforce.at`) | stepVars.ts:460–468; Plan.tsx:141; Export.tsx:223 |
| Lanes (actionability engine) | **Not consumed.** "The schedule is not an input … a step's tab cannot move when its phase does" (planLanes.ts:13–15); engine test `lanes.test.ts:181` | — |
| Print | `planPhases` (`schedule.phases ?? waves`), `phaseRows`, `undatedRows`, `floorRows` (planRows.ts); `waveLabels`; verification and observation window rows; Cleanup heading `phases.heading`; `headerLine1` | PrintPlan.tsx:117–122, 173, 226–236, 287 |
| ICS | `scheduledEventOf` per step (DTSTART = start, DTEND = end + 1 day); SUMMARY uses `railTransition` words; Cleanup rows on `row.day` unless held | ics.ts:53–104 |
| Export: Dates line | `datesLineFor`: `{datesDeploy}` / `{datesObserve}` / `{datesReview}` / `{datesNew}` / `{datesChange}` (`shared.dates*`, content.json:56–60); a held gated create keeps `{datesDeploy}` via `scheduledEventOf` | stepExport.ts:67–84 |
| Export: prompt pack and grounding bundle | `schedule.derivation.criticalPath`, `start`, `targetEnd`, `weeks`, `planFinish` | Export.tsx:230, 334; prompts.ts:264–271 |
| Export: plan file | `schedule: { startDate, band, freeze }` plus a `decisions` block (`startedAt`, …). grep finds **no `firstDeployment`** in plan.ts or Export.tsx, so it appears not to be written to the plan file; on load, progress.ts:177 reads it only if present | Export.tsx:177, 205–213; plan.ts:214–220 |
| Export: CSV | no schedule (readiness and inventory tables only) | Export.tsx:95–98 |
| Communications | `{DATE}` in the step's announcement is filled from ring 0 start / wave start / plan start; `eventsFor` gives announce/remind/enforce (hour spread inside working hours) | generate.ts:2155–2165; timing.ts:181–243 |
| Cleanup phase | dated from `schedule.targetEnd` | generate.ts:2137; cleanupPhase.ts:95–101 |

---

## 10. Notes where the code disagrees with its own words

These are listed as found; nothing was changed.
- `pages.plan.howTo.items[2]` says "A step that waits on another step is held until that step is done." (content.json, `howTo`). But `boardWhenOf` keeps the date for a step that is only sequenced after another; only a `holdOf` hold reads Held (planBoard.ts:270–275, 285).
- The Settings panel comment (Plan.tsx:611–615) says the start date is in the header. The panel also renders "Plan starts" and "First deployment" inputs (Plan.tsx:635–643).
- `rowWhen`'s `waveStart` parameter is accepted and deliberately ignored (`void waveStart`, rowWhen.ts:117). `boardWhenOf` uses the wave start only for the generic "now" (planBoard.ts:288).
- `stepScheduleOf` row 5 gives an `enforce`-kind step the transition `verify` (stepSchedule.ts:159). `buildSchedule` treats `enforce` as enforcement work (schedule.ts:310).
