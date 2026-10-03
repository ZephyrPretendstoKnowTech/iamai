// The build's channel (docs/plans/v1.1/plan.md P0-5). `VITE_CHANNEL=preview`
// builds a preview of the next release that cannot be mistaken for the live
// tool: the tab title says Preview, a banner says so above the app, search
// engines are asked not to index it, and the site root carries no CNAME, so a
// preview published elsewhere never claims the live domain.
//
// Unset, nothing changes: `withChannel(html, null)` returns the page it was
// given, no source module reads the variable, and the build is byte-identical
// to one made before the flag existed (src/channel.test.ts).
export const CHANNELS = ['preview'] as const
export type Channel = (typeof CHANNELS)[number]

// The channel's words live here, not in content.json. content.json is bundled
// whole into the planner, so a key there would change every build, flag or no
// flag, and the unset build would no longer be byte-identical. These words are
// the build's wrapper, written only into a preview's pages.
const WORDS: Record<Channel, { label: string; banner: string }> = {
  preview: {
    label: 'Preview',
    banner: 'Preview of the next IAMAI Planner. It can change without notice: plan real work in the live tool at getiamai.com.',
  },
}

/** The channel a build was asked for, null when none; an unknown name stops the build rather than shipping unmarked. */
export function channelOf(value: string | undefined): Channel | null {
  if (value === undefined || value === '') return null
  if ((CHANNELS as readonly string[]).includes(value)) return value as Channel
  throw new Error(`VITE_CHANNEL: unknown channel "${value}" (known: ${CHANNELS.join(', ')})`)
}

const escape = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

/** The page marked for its channel: the page itself, untouched, when there is none. */
export function withChannel(html: string, channel: Channel | null): string {
  if (channel === null) return html
  const words = WORDS[channel]
  const title = /<title>([\s\S]*?)<\/title>/i
  if (!title.test(html)) throw new Error('withChannel: the page has no <title> to mark')
  if (!/<body[^>]*>/i.test(html)) throw new Error('withChannel: the page has no <body> to carry the banner')
  const banner = `<div role="note" data-channel="${channel}" style="padding:6px 16px;text-align:center;font:600 14px/1.4 system-ui,sans-serif;background:#7a4a00;color:#fff">${escape(words.banner)}</div>`
  return html
    .replace(title, (_m, t: string) => `<title>${t} (${escape(words.label)})</title>`)
    .replace(/<\/head>/i, `  <meta name="robots" content="noindex, nofollow" />\n  </head>`)
    .replace(/<body[^>]*>/i, (m) => `${m}\n    ${banner}`)
}
