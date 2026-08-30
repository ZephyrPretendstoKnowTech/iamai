// Item 16: the schema is only worth having if it cannot be worked around.
//
// Three of these tests read the renderer's source rather than its output. That
// is deliberate: the failure they guard against is a future question drawing
// its own confirm button or its own way out, and a component that does so
// looks perfectly well-typed. The source is where the evidence is.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { SETUP_PAGE, SETUP_QUESTIONS } from '../copy/setup.ts'
import { rulesFor } from '../validation/rules.ts'
import { CONFIRM_LABEL_KEY, QUESTION_SCHEMA, copyFor, schemaFor } from './questionSchema.ts'
import { WIZARD_QUESTIONS, activeWizardQuestions, wizardProgress } from './wizard.ts'
import { emptyMappingState } from './types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

/** The two questions that render only when the tenant has something to ask about. */
const CONDITIONAL = new Set(['serviceAccounts', 'trustedLocations'])
/** No named locations, no users, so neither conditional question is asked. */
const EMPTY_TENANT = { users: [], authMethods: {}, signInEvidence: {}, sources: {}, config: { namedLocations: { rows: [] } } } as unknown as TenantSnapshot

const TYPES = new Set(['pick-objects', 'confirm-default', 'multi-select-confirm', 'toggle-grid'])
const OPT_OUTS = new Set(['none', 'doesNotExistYet'])
const MAPPING_PAGE = readFileSync(new URL('../ui/pages/MappingPage.tsx', import.meta.url), 'utf8')

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.tsx?$/.test(entry) && !entry.endsWith('.test.ts')) out.push(full)
  }
  return out
}

test('every question has exactly one schema entry, and every entry a question', () => {
  const asked = WIZARD_QUESTIONS.map((q) => q.id).sort()
  const declared = QUESTION_SCHEMA.map((q) => q.id).sort()
  assert.deepEqual(declared, asked, 'a question was added or removed without its schema entry')
  assert.equal(new Set(declared).size, declared.length, 'a question is declared twice')
})

test('every question declares a known type and at most one opt-out', () => {
  for (const q of QUESTION_SCHEMA) {
    assert.ok(TYPES.has(q.type), `${q.id} declares an affordance outside the schema: ${q.type}`)
    // optOut is one scalar field, so a second opt-out is unrepresentable rather
    // than merely discouraged. This asserts the field keeps that shape.
    assert.equal(typeof q.optOut, 'string', `${q.id} declares more than one opt-out`)
    assert.ok(OPT_OUTS.has(q.optOut), `${q.id} declares an unknown opt-out: ${q.optOut}`)
    const keys = Object.keys(q).sort()
    assert.deepEqual(keys, ['copy', 'id', 'max', 'min', 'optOut', 'type', 'validationSubject'], `${q.id} carries a field outside the schema: ${keys.join(', ')}`)
  }
})

test('questions 1 and 2 have no opt-out', () => {
  assert.equal(schemaFor('breakGlass').optOut, 'none')
  assert.equal(schemaFor('globalExclusion').optOut, 'none')
})

test('selection bounds are coherent', () => {
  for (const q of QUESTION_SCHEMA) {
    assert.ok(Number.isInteger(q.min) && q.min >= 0, `${q.id} has a nonsense minimum`)
    if (q.max !== null) assert.ok(q.max >= q.min, `${q.id} allows fewer than its own minimum`)
  }
})

test('every declared validation subject has rules behind it', () => {
  for (const q of QUESTION_SCHEMA) {
    if (q.validationSubject === null) continue
    assert.ok(rulesFor(q.validationSubject).length > 0, `${q.id} points at ${q.validationSubject}, which has no rules`)
  }
})

test('every question reads its wording from its declared copy keys', () => {
  for (const q of QUESTION_SCHEMA) {
    const c = copyFor(q.id)
    for (const [field, value] of Object.entries(c)) {
      assert.ok(typeof value === 'string' && value.trim().length > 0, `${q.id} has empty ${field} copy`)
    }
    assert.equal(c.title, SETUP_QUESTIONS[q.id].question, `${q.id} does not read its title from the copy module`)
  }
})

test('there is exactly one confirm label, and only the shared component says it', () => {
  assert.ok(typeof SETUP_PAGE[CONFIRM_LABEL_KEY] === 'string', 'the shared confirm label is missing')
  // The three it replaced must not come back under any name.
  for (const retired of ['countriesLooksRight', 'timeZoneCorrect', 'detectionsRight']) {
    assert.ok(!(retired in SETUP_PAGE), `${retired} is back; there is one confirm label`)
  }
  const SRC = fileURLToPath(new URL('..', import.meta.url))
  const readers = sourceFiles(SRC)
    .filter((f) => readFileSync(f, 'utf8').includes(CONFIRM_LABEL_KEY))
    .map((f) => relative(SRC, f).split(sep).join('/'))
    .sort()
  assert.deepEqual(readers, ['copy/setup.ts', 'mapping/questionSchema.ts', 'ui/components/Confirm.tsx'], 'something other than the shared confirm affordance prints the confirm label')
})

test('no question draws its own confirm affordance or its own way out', () => {
  // One opt-out call site in the whole renderer, and it asks the schema first.
  const optOutSites = MAPPING_PAGE.match(/<NotApplicable\b/g) ?? []
  assert.equal(optOutSites.length, 1, 'a question renders its own opt-out')
  assert.ok(MAPPING_PAGE.includes("schemaFor(def.id).optOut !== 'none' && <NotApplicable"), 'the opt-out is drawn without asking the schema')
  // Confirming is done by the shared component, never by a hand-rolled button.
  for (const id of QUESTION_SCHEMA.filter((q) => q.type === 'confirm-default').map((q) => q.id)) {
    // Some ids are also answered from a picker's onChange, so look forward from
    // each shared-confirm call site rather than back from the first mention.
    const call = `answered('` + id + `')`
    const used = MAPPING_PAGE.split('<Confirm').slice(1).some((after) => after.slice(0, 240).includes(call))
    assert.ok(used, id + ' is a confirm-default question that does not use the shared confirm affordance')
  }
})

test('a tenant that is never asked a question can still finish Setup', () => {
  // The question count is one number with one source (prompt 37 §1, T3): the
  // questions this tenant is actually asked. Measuring completeness against all
  // nine meant a tenant with no named locations and no detected service
  // accounts could never finish — Setup read "attention" forever, the stepper
  // called Findings and Roadmap provisional, and coverage never treated the
  // exclusions as confirmed. Three surfaces, one wrong default.
  const bare = {
    ...emptyMappingState('t'),
    // Answer every question this tenant is asked, and none of the others.
    wizardAnswered: Object.fromEntries(WIZARD_QUESTIONS.filter((q) => !CONDITIONAL.has(q.id)).map((q) => [q.id, true])),
  }
  const asked = activeWizardQuestions(null, { snapshot: EMPTY_TENANT, state: bare })
  assert.deepEqual(
    asked.map((q) => q.id).filter((id) => CONDITIONAL.has(id)),
    [],
    'a tenant with no named locations and no service-account candidates should not be asked those questions',
  )
  const progress = wizardProgress(bare, asked)
  assert.equal(progress.requiredMissing, 0, 'answering every question asked did not finish Setup')
  assert.equal(progress.complete, true)
  assert.equal(progress.total, asked.length, 'progress counts a different set from the one Setup renders')
})
