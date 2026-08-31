// Communications as a plan (comms-and-bridges.md §1): audiences computed
// from populations, one bulletin per audience per week, high-disruption
// steps claiming their own message, named audiences never bundled, a
// warning at more than three messages a month. Copy-out only. Pure.
import { AUDIENCE, BULLETIN, COMMS_PLAN } from '../copy/comms.ts'
import { NO_ANNOUNCEMENT } from '../copy/announcements.ts'
import { absoluteDate } from '../copy/dates.ts'
import type { Step, StepEvent } from './types.ts'

export type AudienceKind = 'everyone' | 'segment' | 'named' | 'admins' | 'helpdesk' | 'none'
export type Audience = { kind: AudienceKind; label: string; ids: string[] }

export type CommsContext = {
  enabledUsers: number
  adminIds: Set<string>
  guestIds: Set<string>
  departmentOf: Map<string, string>
  nameOf: (id: string) => string
  upnOf: (id: string) => string | null
  tenantName: string
  timeZone: string
}

export const NAMED_BELOW = 10
const EVERYONE_SHARE = 0.9
const SEGMENT_SHARE = 0.8
const HIGH_DISRUPTION = 4
export const MONTHLY_WARNING_ABOVE = 3

/** The audiences a step speaks to, from its population; more than one is common. */
export function audiencesFor(step: Step, ctx: CommsContext): Audience[] {
  if (step.kind === 'prerequisite' || step.kind === 'verify' || step.kind === 'recurring' || step.kind === 'check') return []
  if (step.status === 'done' || step.status === 'skipped') return []
  if (step.safeToday || step.comms === NO_ANNOUNCEMENT || step.comms === null || step.population.total === 0) return [{ kind: 'none', label: AUDIENCE.none, ids: [] }]
  const ids = step.population.ids
  const out: Audience[] = []
  const allAdmins = ids.every((id) => ctx.adminIds.has(id))
  if (step.readiness.family === 'admin' || allAdmins) {
    out.push({ kind: 'admins', label: AUDIENCE.admins, ids })
  } else if (ids.length < NAMED_BELOW) {
    out.push({ kind: 'named', label: AUDIENCE.named(ids.length), ids })
  } else if (ids.length >= ctx.enabledUsers * EVERYONE_SHARE) {
    out.push({ kind: 'everyone', label: AUDIENCE.everyone, ids })
  } else if (ids.every((id) => ctx.guestIds.has(id))) {
    out.push({ kind: 'segment', label: AUDIENCE.guests, ids })
  } else {
    // A department that holds most of the population names the segment; otherwise the count does.
    const byDept = new Map<string, number>()
    for (const id of ids) {
      const d = ctx.departmentOf.get(id)
      if (d) byDept.set(d, (byDept.get(d) ?? 0) + 1)
    }
    const top = [...byDept.entries()].sort((a, b) => b[1] - a[1])[0]
    out.push({ kind: 'segment', label: top && top[1] >= ids.length * SEGMENT_SHARE ? AUDIENCE.department(top[0]) : AUDIENCE.segment(`${ids.length} people`), ids })
  }
  // Handle-with-care people are always contacted individually first, whatever the broadcast.
  const care = step.highCare.userIds.filter((id) => ids.includes(id))
  if (care.length > 0 && out[0].kind !== 'named') out.push({ kind: 'named', label: AUDIENCE.named(care.length), ids: care })
  out.push({ kind: 'helpdesk', label: AUDIENCE.helpdesk, ids: [] })
  return out
}

export type BulletinStep = { stepId: string; title: string; plainTitle: string; enforceAt: string; enforceDay: string; enforceTime: string; whatChanges: string; whatToDo: string }

export type Bulletin = {
  id: string
  audience: Audience
  /** Monday of the week the covered steps enforce in. */
  weekKey: string
  kind: 'bulletin' | 'solo' | 'individual'
  sendAt: string
  remindAt: string | null
  subject: string
  steps: BulletinStep[]
  /** Solo messages this bulletin points to. */
  references: { subject: string; day: string }[]
  channels: { email: string; teams: string; helpdesk: string; portal: string }
  reminder: string
  recipients: string[]
}

function weekKeyOf(iso: string): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

function whatToDoFor(step: Step): string {
  const f = step.readiness.family
  if (f === 'mfa' || f === 'guest') return BULLETIN.whatToDoMfa
  if (f === 'admin') return BULLETIN.whatToDoAdmin
  if (f === 'device') return BULLETIN.whatToDoDevice
  if (f === 'location') return BULLETIN.whatToDoTravel
  return BULLETIN.whatToDoNothing
}

function bulletinStep(s: Step, e: StepEvent): BulletinStep {
  return { stepId: s.id, title: s.title, plainTitle: s.plainTitle || s.title, enforceAt: e.at, enforceDay: e.day, enforceTime: e.time, whatChanges: s.whatChanges, whatToDo: whatToDoFor(s) }
}

function compose(kind: Bulletin['kind'], audience: Audience, steps: BulletinStep[], references: Bulletin['references'], ctx: CommsContext, week: string): Pick<Bulletin, 'subject' | 'channels' | 'reminder'> {
  const first = steps[0]
  const subject = kind === 'solo' ? BULLETIN.subjectSolo(first.plainTitle) : kind === 'individual' ? BULLETIN.subjectNamed(first.plainTitle) : BULLETIN.subject(steps.length, week)
  const lead =
    kind === 'individual'
      ? BULLETIN.leadNamed('{NAME}', ctx.tenantName, first.plainTitle, `${first.enforceDay} ${absoluteDate(first.enforceAt)}`)
      : audience.kind === 'admins'
        ? BULLETIN.leadAdmins(ctx.tenantName, steps.length)
        : audience.kind === 'segment'
          ? BULLETIN.leadSegment(ctx.tenantName, audience.label, steps.length)
          : BULLETIN.lead(ctx.tenantName, steps.length)
  const blocks = steps.map((s) => BULLETIN.block(s.plainTitle, `${s.enforceDay} ${absoluteDate(s.enforceAt)}, ${s.enforceTime}`, s.whatChanges)).join('\n\n')
  const todo = [...new Set(steps.map((s) => s.whatToDo))]
  const refs = references.map((r) => BULLETIN.reference(r.subject, r.day)).join('\n')
  const email = [lead, blocks, `${BULLETIN.whatToDoTitle}\n${todo.map((t) => `- ${t}`).join('\n')}`, refs, BULLETIN.contact, BULLETIN.signOff].filter(Boolean).join('\n\n')
  const titles = steps.map((s) => s.plainTitle).join('; ')
  const when = steps.length === 1 ? `${first.enforceDay} ${first.enforceTime}` : `in the week of ${week}`
  return {
    subject,
    channels: {
      email,
      teams: BULLETIN.teams(steps.length, when, titles),
      helpdesk: BULLETIN.helpDeskNote(titles, `${first.enforceDay} ${absoluteDate(first.enforceAt)}`),
      portal: BULLETIN.portal(steps.length, week, titles),
    },
    reminder: [steps.length === 1 ? BULLETIN.reminderLead(`${first.enforceDay} ${first.enforceTime}`) : BULLETIN.reminderLead(`this week: ${titles}`), blocks, BULLETIN.contact, BULLETIN.signOff].join('\n\n'),
  }
}

/** One bulletin per audience per week; solo messages for high-disruption steps; individual notes for named people. */
export function bulletinsFor(steps: Step[], ctx: CommsContext): Bulletin[] {
  const out: Bulletin[] = []
  const groups = new Map<string, { audience: Audience; week: string; steps: Step[] }>()
  const solos: { step: Step; audience: Audience }[] = []
  const individuals = new Map<string, { audience: Audience; steps: Step[] }>()
  for (const s of steps) {
    if (!s.events?.enforce) continue
    for (const a of audiencesFor(s, ctx)) {
      if (a.kind === 'none' || a.kind === 'helpdesk') continue
      if (a.kind === 'named') {
        const key = a.ids.slice().sort().join(',')
        const g = individuals.get(key) ?? { audience: a, steps: [] }
        g.steps.push(s)
        individuals.set(key, g)
        continue
      }
      if ((s.score?.disruption ?? 0) >= HIGH_DISRUPTION) {
        solos.push({ step: s, audience: a })
        continue
      }
      const week = weekKeyOf(s.events.enforce.at)
      const key = `${a.kind}|${a.label}|${week}`
      const g = groups.get(key) ?? { audience: a, week, steps: [] }
      g.steps.push(s)
      groups.set(key, g)
    }
  }
  const soloBulletins: Bulletin[] = solos.map(({ step, audience }) => {
    const e = step.events!
    const bs = [bulletinStep(step, e.enforce)]
    const week = weekKeyOf(e.enforce.at)
    const c = compose('solo', audience, bs, [], ctx, absoluteDate(week + 'T12:00:00.000Z'))
    return { id: `solo-${step.id}`, audience, weekKey: week, kind: 'solo', sendAt: e.announce?.at ?? e.enforce.at, remindAt: e.remind?.at ?? null, steps: bs, references: [], recipients: audience.ids, ...c }
  })
  for (const g of groups.values()) {
    const ordered = [...g.steps].sort((a, b) => a.events!.enforce.at.localeCompare(b.events!.enforce.at))
    const bs = ordered.map((s) => bulletinStep(s, s.events!.enforce))
    const refs = soloBulletins.filter((sb) => sb.weekKey === g.week && sb.audience.kind === g.audience.kind && sb.audience.label === g.audience.label).map((sb) => ({ subject: sb.subject, day: absoluteDate(sb.sendAt) }))
    const sendAt = ordered.map((s) => s.events!.announce?.at ?? s.events!.enforce.at).sort()[0]
    const remindAt = ordered.map((s) => s.events!.remind?.at).filter((x): x is string => !!x).sort()[0] ?? null
    const c = compose('bulletin', g.audience, bs, refs, ctx, absoluteDate(g.week + 'T12:00:00.000Z'))
    out.push({ id: `bulletin-${g.audience.kind}-${g.week}-${g.audience.label.replace(/\W+/g, '-')}`, audience: g.audience, weekKey: g.week, kind: 'bulletin', sendAt, remindAt, steps: bs, references: refs, recipients: g.audience.ids, ...c })
  }
  // Two named audiences that share their first three people and their week
  // used to share an id as well, which surfaced as duplicate rows once two
  // steps could announce on the same day (prompt 46 Part 4). The id stays
  // readable; a second such group gets a suffix.
  const namedIds = new Map<string, number>()
  for (const g of individuals.values()) {
    // The earliest notice period among the steps affecting these people.
    const ordered = [...g.steps].sort((a, b) => a.events!.enforce.at.localeCompare(b.events!.enforce.at))
    const bs = ordered.map((s) => bulletinStep(s, s.events!.enforce))
    const sendAt = ordered.map((s) => s.events!.announce?.at ?? s.events!.enforce.at).sort()[0]
    const week = weekKeyOf(ordered[0].events!.enforce.at)
    const c = compose('individual', g.audience, bs, [], ctx, absoluteDate(week + 'T12:00:00.000Z'))
    const base = `named-${g.audience.ids.slice(0, 3).join('-')}-${week}`
    const nth = (namedIds.get(base) ?? 0) + 1
    namedIds.set(base, nth)
    out.push({ id: nth === 1 ? base : `${base}-${nth}`, audience: g.audience, weekKey: week, kind: 'individual', sendAt, remindAt: ordered[0].events!.remind?.at ?? null, steps: bs, references: [], recipients: g.audience.ids, ...c })
  }
  return [...out, ...soloBulletins].sort((a, b) => a.sendAt.localeCompare(b.sendAt))
}

export type CommsPlanRow = { at: string; kind: 'announce' | 'remind' | 'individual'; audience: string; channels: string; subject: string; steps: string[]; bulletinId: string }

export function commsPlanRows(bulletins: Bulletin[]): CommsPlanRow[] {
  const rows: CommsPlanRow[] = []
  for (const b of bulletins) {
    const channels = b.kind === 'individual' ? BULLETIN.channels.email : [BULLETIN.channels.email, BULLETIN.channels.teams, BULLETIN.channels.helpdesk, BULLETIN.channels.portal].join(', ')
    rows.push({ at: b.sendAt, kind: b.kind === 'individual' ? 'individual' : 'announce', audience: b.audience.label, channels, subject: b.subject, steps: b.steps.map((s) => s.plainTitle), bulletinId: b.id })
    if (b.remindAt) rows.push({ at: b.remindAt, kind: 'remind', audience: b.audience.label, channels: BULLETIN.channels.email, subject: BULLETIN.subjectReminder(b.subject), steps: b.steps.map((s) => s.plainTitle), bulletinId: b.id })
  }
  return rows.sort((a, b) => a.at.localeCompare(b.at))
}

/** More than three messages to one audience in a month: name the change that could move. */
export function monthlyWarnings(bulletins: Bulletin[]): string[] {
  const byKey = new Map<string, Bulletin[]>()
  for (const b of bulletins) {
    if (b.kind === 'individual') continue
    const key = `${b.audience.label}|${b.sendAt.slice(0, 7)}`
    byKey.set(key, [...(byKey.get(key) ?? []), b])
  }
  const out: string[] = []
  for (const [key, list] of byKey) {
    if (list.length <= MONTHLY_WARNING_ABOVE) continue
    const [audience, month] = key.split('|')
    const last = [...list].sort((a, b) => a.sendAt.localeCompare(b.sendAt)).at(-1)!
    const monthName = new Date(`${month}-01T12:00:00.000Z`).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    out.push(COMMS_PLAN.warning(list.length, audience, monthName, last.steps[0]?.plainTitle ?? last.subject))
  }
  return out
}

export function recipientRows(b: Bulletin, ctx: CommsContext): (string | number)[][] {
  return b.recipients.map((id) => [ctx.nameOf(id), ctx.upnOf(id) ?? '', ctx.departmentOf.get(id) ?? ''])
}
