// Strings inside the shared components (src/ui/components).
import { count } from './statements.ts'

export const COMPONENTS = {
  backToTop: 'Back to top',
  picker: {
    placeholder: 'Search…',
    remove: 'Remove',
    searching: 'Searching…',
    noMatches: 'No matches',
    typeToSearch: 'Type to search',
    suggestions: 'Suggestions',
    results: (n: number) => count(n, 'result'),
    done: 'Done',
  },
  table: {
    empty: 'Nothing to show yet.',
    rows: (n: number) => count(n, 'entry', 'entries'),
    page: (current: number, pages: number) => `page ${current} of ${pages}`,
    previous: 'Previous',
    next: 'Next',
    exportCsv: 'Export CSV',
  },
  infoTip: { about: (title: string) => `About ${title}` },
}
