// What the picker's list shows for a query (ui/components/Picker.tsx), pure so
// it is testable without a browser (F-114).
//
// A search shows at most eight rows. The count under them is how many matched,
// not how many fit: with more than eight it says so and asks for more letters.
// A query that matches only accounts already picked says that, not No matches:
// the picked ones leave the list because they are already chips above it.
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'

const T = app.picker

/** The most rows a search shows; a listAll picker shows every one. */
export const PICKER_ROWS = 8

export type PickerListInput<O extends { id: string }> = {
  empty: boolean
  listAll: boolean
  options: O[]
  suggestions: O[]
  selectedIds: ReadonlySet<string>
}

export function pickerList<O extends { id: string }>({ empty, listAll, options, suggestions, selectedIds }: PickerListInput<O>): {
  list: O[]
  /** The line under a search's rows: how many matched, or that more did than show. Null with no query. */
  count: string | null
  /** The line where no row is: Already picked when every match is a chip, else No matches. Null with no query or with rows. */
  none: string | null
} {
  const source = empty ? (listAll ? options : suggestions) : options
  const shown = source.filter((o) => !selectedIds.has(o.id))
  const list = listAll ? shown : shown.slice(0, PICKER_ROWS)
  const count = empty ? null : shown.length > list.length ? fillText(T.showingOf, { shown: list.length, n: shown.length }) : fillText(T.results, { n: shown.length })
  const none = empty || list.length > 0 ? null : source.length > 0 ? T.alreadyPicked : T.noMatches
  return { list, count, none }
}
