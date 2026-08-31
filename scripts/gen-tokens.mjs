// Writes src/ui/tokens.css from src/ui/tokens.ts (prompt 47 Part 1). Run after
// any change to the tokens; tokens.test.ts fails while the two disagree.
import { writeFileSync } from 'node:fs'
import { renderTokensCss } from '../src/ui/tokens.ts'

writeFileSync('src/ui/tokens.css', renderTokensCss())
console.log('tokens: wrote src/ui/tokens.css')
