import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { emergencyAccountPowerShell } from './emergencyImplementation.ts'

const PWSH = process.platform === 'win32' ? 'pwsh.exe' : 'pwsh'
const work = mkdtempSync(join(tmpdir(), 'iamai-emergency-powershell-'))
const scriptPath = join(work, 'emergency-account.ps1')
const parserPath = join(work, 'parse.ps1')
const harnessPath = join(work, 'mock.ps1')
writeFileSync(scriptPath, emergencyAccountPowerShell('tenant.onmicrosoft.com'))
writeFileSync(parserPath, `param([string]$Path)
$tokens = $null
$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$tokens, [ref]$errors) | Out-Null
if ($errors.Count) { $errors | ForEach-Object { Write-Error $_.Message }; exit 1 }
`)
writeFileSync(harnessPath, `param([string]$Scenario,[string]$ScriptPath,[string]$Mode)
$global:MockWrites = 0
$global:MockAfterWrite = $false
$userId = '11111111-1111-1111-1111-111111111111'
$roleId = '62e90394-69f5-4237-9190-012177145e10'

function Page([object[]]$Rows,[string]$Next = '') {
  $page = [ordered]@{ value = $Rows }
  if ($Next) { $page['@odata.nextLink'] = $Next }
  return [pscustomobject]$page
}
function ActiveRow { [pscustomobject]@{ principalId = $userId; roleDefinitionId = $roleId; directoryScopeId = '/' } }
function PermanentRow { [pscustomobject]@{ principalId = $userId; roleDefinitionId = $roleId; directoryScopeId = '/'; assignmentType = 'Assigned'; endDateTime = $null; status = 'Provisioned' } }
function TemporaryRow { [pscustomobject]@{ principalId = $userId; roleDefinitionId = $roleId; directoryScopeId = '/'; assignmentType = 'Activated'; endDateTime = '2026-09-17T18:00:00Z'; status = 'Provisioned' } }
function EligibleRow { [pscustomobject]@{ principalId = $userId; roleDefinitionId = $roleId; directoryScopeId = '/'; assignmentType = 'Eligible' } }

function global:Invoke-MgGraphRequest {
  param([string]$Method,[string]$Uri,[object]$Body,[string]$ContentType,[string]$OutputType)
  if ($Method -eq 'POST') {
    $global:MockWrites += 1
    $global:MockAfterWrite = $true
    return [pscustomobject]@{ id = 'new-assignment' }
  }
  if ($Uri -match '/users/') {
    $upn = if ($Scenario -eq 'wrong-domain') { 'emergency@custom.example.com' } else { 'emergency@tenant.onmicrosoft.com' }
    return [pscustomobject]@{ id = $userId; userPrincipalName = $upn; accountEnabled = $true; onPremisesSyncEnabled = $false }
  }
  if ($Scenario -eq 'failed' -and $Uri -match '/roleAssignments') { throw 'mock read failure' }
  if ($Uri -eq 'mock://malformed-page2') { return [pscustomobject]@{ value = $null } }
  if ($Uri -eq 'mock://assignments-page2') { return Page @((ActiveRow)) }
  if ($Uri -eq 'mock://schedules-page2') { return Page @((PermanentRow)) }
  if ($Uri -match '/roleAssignmentScheduleInstances') {
    if ($global:MockAfterWrite -or $Scenario -eq 'permanent') { return Page @((PermanentRow)) }
    if ($Scenario -eq 'temporary') { return Page @((TemporaryRow)) }
    if ($Scenario -eq 'later-page') { return Page @() 'mock://schedules-page2' }
    return Page @()
  }
  if ($Uri -match '/roleEligibilitySchedules') {
    if ($Scenario -eq 'eligible') { return Page @((EligibleRow)) }
    return Page @()
  }
  if ($Uri -match '/roleAssignments') {
    if ($Scenario -eq 'null-value') { return [pscustomobject]@{ value = $null } }
    if ($Scenario -eq 'missing-value') { return [pscustomobject]@{ other = @() } }
    if ($Scenario -eq 'string-value') { return [pscustomobject]@{ value = 'not-a-collection' } }
    if ($Scenario -eq 'scalar-value') { return [pscustomobject]@{ value = 42 } }
    if ($Scenario -eq 'object-value') { return [pscustomobject]@{ value = (ActiveRow) } }
    if ($Scenario -eq 'malformed-later') { return Page @((ActiveRow)) 'mock://malformed-page2' }
    if ($global:MockAfterWrite -or $Scenario -in @('permanent','temporary')) { return Page @((ActiveRow)) }
    if ($Scenario -eq 'later-page') { return Page @() 'mock://assignments-page2' }
    return Page @()
  }
  throw "Unexpected mock URI: $Uri"
}

try {
  $expectedUpn = if ($Scenario -eq 'wrong-domain') { 'emergency@custom.example.com' } else { 'emergency@tenant.onmicrosoft.com' }
  $result = @(& $ScriptPath -Mode $Mode -UserId $userId -ExpectedUpn $expectedUpn)
  [pscustomobject]@{ success = $true; writes = $global:MockWrites; error = $null; result = $result } | ConvertTo-Json -Depth 8 -Compress
} catch {
  [pscustomobject]@{ success = $false; writes = $global:MockWrites; error = $_.Exception.Message; result = $null } | ConvertTo-Json -Depth 8 -Compress
}
`)
after(() => rmSync(work, { recursive: true, force: true }))

type RunResult = { success: boolean; writes: number; error: string | null; result: Record<string, unknown>[] | null }
function run(scenario: string, mode = 'VerifyIdentityAndRole'): RunResult {
  const result = spawnSync(PWSH, ['-NoProfile', '-File', harnessPath, scenario, scriptPath, mode], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return JSON.parse(result.stdout.trim()) as RunResult
}

test('generated emergency-account PowerShell parses with the installed parser', () => {
  const result = spawnSync(PWSH, ['-NoProfile', '-File', parserPath, scriptPath], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})

test('PowerShell verifies only permanent active tenant-wide assignment and follows later pages', () => {
  for (const scenario of ['permanent', 'later-page']) {
    const result = run(scenario)
    assert.equal(result.success, true, `${scenario}: ${result.error}`)
    assert.equal(result.writes, 0)
    assert.equal(result.result?.[0]?.PermanentActiveGlobalAdministrator, true)
    assert.equal(result.result?.[0]?.InitialDomain, 'tenant.onmicrosoft.com')
  }
})

test('PowerShell keeps temporary, eligible-only and absent assignments distinct and read-only in Verify mode', () => {
  const expected = new Map([
    ['temporary', /active temporarily|expiration/i],
    ['eligible', /eligible, not permanently active/i],
    ['absent', /No tenant-wide Global Administrator assignment/i],
  ])
  for (const [scenario, message] of expected) {
    const result = run(scenario)
    assert.equal(result.success, false)
    assert.equal(result.writes, 0)
    assert.match(result.error ?? '', message)
  }
})

test('failed reads and wrong initial domains cannot verify or write', () => {
  for (const mode of ['VerifyIdentityAndRole', 'EnsureRole']) {
    const failed = run('failed', mode)
    assert.equal(failed.success, false)
    assert.equal(failed.writes, 0)
    assert.match(failed.error ?? '', /Verification incomplete/)
  }
  const wrongDomain = run('wrong-domain')
  assert.equal(wrongDomain.success, false)
  assert.equal(wrongDomain.writes, 0)
  assert.match(wrongDomain.error ?? '', /observed initial tenant domain tenant\.onmicrosoft\.com/)
})

test('malformed role collection pages are incomplete and authorize zero writes', () => {
  const scenarios = ['null-value', 'missing-value', 'string-value', 'scalar-value', 'object-value', 'malformed-later']
  for (const scenario of scenarios) {
    for (const mode of ['VerifyIdentityAndRole', 'EnsureRole']) {
      const result = run(scenario, mode)
      assert.equal(result.success, false, `${scenario}/${mode}`)
      assert.equal(result.writes, 0, `${scenario}/${mode}`)
      assert.equal(result.result, null, `${scenario}/${mode}`)
      assert.match(result.error ?? '', /Verification incomplete.*unreadable response/i, `${scenario}/${mode}`)
    }
  }
})

test('Ensure mode writes only after a complete absent result and re-reads permanence', () => {
  const result = run('absent', 'EnsureRole')
  assert.equal(result.success, true, result.error ?? '')
  assert.equal(result.writes, 1)
  assert.equal(result.result?.[0]?.PermanentActiveGlobalAdministrator, true)
})
