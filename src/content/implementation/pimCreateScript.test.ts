// The PIM create's PowerShell, run as IAMAI renders it, against a mocked Graph
// (nothing leaves the machine): the script's own invocation lines, one after
// another, the way a pasted script runs.
//
// R4-18 review. The create's script prepares authentication context c1 and then
// creates the policy on it. It had never run: under the script's own
// `Set-StrictMode -Version Latest`, Connect-Scopes threw "The property 'Count'
// cannot be found" whenever a Graph session already existed (an `if` statement's
// output unwraps an empty or one-element array, so `$missing` was $null or a
// string), and Create read a variable named `CaBase?` ("$CaBase?`$filter=…"),
// which is not set. And the preparation must create only: a c1 that belongs to
// something else stops both modes before any write.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pinnedPackage } from '../../baseline/pinned.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { asCuratedBaseline, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from '../../ui/surfaces/planBoard.ts'
import { laneReadings } from '../../ui/surfaces/planLanes.ts'
import { stepBodyOf } from '../../ui/surfaces/stepBody.ts'
import { planDates } from '../../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'

const PWSH = process.platform === 'win32' ? 'pwsh.exe' : 'pwsh'
const ID = 's-goal-pim-activation-reauth'

/** The create's PowerShell tab on the pinned mid tenant, as the opened step draws it. */
function createScript(): string {
  setDisplayTimeZone('UTC')
  try {
    const f = withFoundationSettled({ ...structuredClone(fixture('mid')), baseline: asCuratedBaseline(pinnedPackage()) })
    const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
    const step = r.steps.find((s) => s.id === ID)
    assert.ok(step, 'the plan holds no PIM step')
    const readings = laneReadings(r.steps, [])
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot), reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    const reading = readings.get(step.id)
    const lane = reading ? laneViewOf(reading, titleOf) : laneViewFor(step, r.steps, titleOf)
    const body = stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) })
    return body.artifacts.find((a) => a.id === 'ps')?.text() ?? ''
  } finally {
    setDisplayTimeZone(null)
  }
}

const work = mkdtempSync(join(tmpdir(), 'iamai-pim-create-'))
const scriptPath = join(work, 'pim-create.ps1')
const harnessPath = join(work, 'mock.ps1')
const script = createScript()
writeFileSync(scriptPath, script)
// The mock Graph: one authentication context (absent, this step's, or someone
// else's), an empty policy list, and a record of every request. A session that
// already exists is `connected`.
writeFileSync(harnessPath, `param([string]$ScriptPath,[string]$Scenario,[string]$Connected)
$ErrorActionPreference = 'Stop'
$global:Requests = [System.Collections.Generic.List[string]]::new()
$global:Context = switch ($Scenario) {
  'absent' { $null }
  'ours-unpublished' { @{ id = 'c1'; displayName = 'Privileged role activation'; description = 'Fresh strong authentication for privileged role activation.'; isAvailable = $false } }
  'foreign' { @{ id = 'c1'; displayName = 'Sensitive sites'; description = 'Step-up for labelled sites'; isAvailable = $true } }
  'foreign-unpublished' { @{ id = 'c1'; displayName = 'Old context'; description = $null; isAvailable = $false } }
}
function global:Import-Module { }
function global:Connect-MgGraph { }
function global:Get-MgContext { if ($Connected -eq 'yes') { [pscustomobject]@{ Scopes = @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess','AuthenticationContext.Read.All','AuthenticationContext.ReadWrite.All') } } else { $null } }
function global:Invoke-MgGraphRequest {
  param([string]$Method,[string]$Uri,[object]$Body,[string]$ContentType,[string]$OutputType)
  $global:Requests.Add("$Method $Uri")
  if ($Uri -like '*/authenticationContextClassReferences/*') {
    if ($Method -eq 'GET') {
      if ($null -eq $global:Context) { throw 'Response status code does not indicate success: NotFound (Not Found).' }
      return $global:Context.Clone()
    }
    if ($Method -eq 'PATCH') {
      $b = $Body | ConvertFrom-Json
      $global:Context = @{ id = 'c1'; displayName = $b.displayName; description = $b.description; isAvailable = $b.isAvailable }
      return $null
    }
  }
  if ($Method -eq 'GET' -and $Uri -like '*/conditionalAccess/policies?*') { return @{ value = @() } }
  if ($Method -eq 'POST' -and $Uri -like '*/conditionalAccess/policies') { return @{ id = '11111111-2222-3333-4444-555555555555' } }
  throw "Unexpected mock request: $Method $Uri"
}
$lines = (Get-Content -Raw $ScriptPath) -split '\\r?\\n'
. ([scriptblock]::Create((($lines | Where-Object { $_ -notmatch '^Invoke-IAMAIStep ' }) -join [Environment]::NewLine)))
$runs = @()
foreach ($call in @($lines | Where-Object { $_ -match '^Invoke-IAMAIStep ' })) {
  $mode = ([regex]::Match($call, "-Mode '(\\w+)'")).Groups[1].Value
  try { & ([scriptblock]::Create($call)) 6>$null | Out-Null; $runs += [pscustomobject]@{ mode = $mode; ok = $true; error = $null } }
  catch { $runs += [pscustomobject]@{ mode = $mode; ok = $false; error = $_.Exception.Message } }
}
[pscustomobject]@{ runs = $runs; requests = @($global:Requests) } | ConvertTo-Json -Depth 6 -Compress
`)
after(() => rmSync(work, { recursive: true, force: true }))

type Result = { runs: { mode: string; ok: boolean; error: string | null }[]; requests: string[] }
function run(scenario: string, connected: boolean): Result {
  const r = spawnSync(PWSH, ['-NoProfile', '-NonInteractive', '-File', harnessPath, scriptPath, scenario, connected ? 'yes' : 'no'], { encoding: 'utf8', timeout: 60_000 })
  assert.equal(r.status, 0, r.stderr || r.stdout)
  const parsed = JSON.parse(r.stdout.trim()) as Result
  return { runs: [parsed.runs].flat(), requests: [parsed.requests].flat() }
}
const writes = (r: Result): string[] => r.requests.filter((q) => !q.startsWith('GET '))

test('the premise: the create script runs PrepareContext, then Create', () => {
  assert.deepEqual([...script.matchAll(/^Invoke-IAMAIStep -Mode '(\w+)'/gm)].map((m) => m[1]), ['PrepareContext', 'Create'])
})

test('the create script prepares an absent context and creates the policy on it, signed in or not', () => {
  for (const connected of [false, true]) {
    const r = run('absent', connected)
    assert.deepEqual(r.runs.map((x) => [x.mode, x.ok, x.error]), [['PrepareContext', true, null], ['Create', true, null]], `connected ${connected}`)
    assert.deepEqual(writes(r).map((w) => w.replace(/^(\w+) https:\/\/graph\.microsoft\.com\/v1\.0/, '$1 ')), ['PATCH /identity/conditionalAccess/authenticationContextClassReferences/c1', 'POST /identity/conditionalAccess/policies'])
    // The duplicate-name check reads the policy list it means to read.
    assert.ok(r.requests.some((q) => /^GET https:\/\/graph\.microsoft\.com\/v1\.0\/identity\/conditionalAccess\/policies\?\$filter=displayName%20eq%20/.test(q)), r.requests.join('\n'))
  }
  // A context this step prepared earlier and left unpublished is published, and used.
  const ours = run('ours-unpublished', true)
  assert.ok(ours.runs.every((x) => x.ok), JSON.stringify(ours.runs))
})

test('a context the step did not create stops the create script before any write', () => {
  for (const scenario of ['foreign', 'foreign-unpublished']) {
    const r = run(scenario, true)
    assert.equal(r.runs[0].ok, false, scenario)
    assert.match(r.runs[0].error ?? '', /Authentication context c1 already exists as '(?:Sensitive sites|Old context)'\. This step does not rename, republish or reuse a context it did not create\./)
    // Pasted, the next line runs anyway: Create refuses the context itself.
    assert.equal(r.runs[1].ok, false, `${scenario}: Create went on to create the policy`)
    assert.deepEqual(writes(r), [], `${scenario}: a write reached Graph`)
  }
})
