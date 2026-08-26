import { test } from "node:test";
import assert from "node:assert/strict";
import { loadBaseline, nameKey, precedenceFor, intentKey } from "./index.ts";
import type { BaselineFile } from "./types.ts";

const BREAKGLASS = "b63c3682-06c6-45f0-9692-ee76b604b4f9";
const SVCACCTS = "e663a7ce-daec-4062-88b8-5970bfec8019";
const PILOT = "1178bb5d-4f19-4b69-b33b-44eb7f5b39c9";
const TRUSTED_LOC = "0403d368-f07f-4e4c-b75d-aa169d5b6683";

/** Graph PowerShell SDK style: PascalCase, every property present, nulls expanded. */
function sdkPolicy(name: string, id: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    Conditions: {
      Applications: { ApplicationFilter: { Mode: null, Rule: null }, ExcludeApplications: [], IncludeApplications: ["All"], IncludeUserActions: [] },
      ClientAppTypes: ["all"],
      Locations: { ExcludeLocations: null, IncludeLocations: null },
      Platforms: { ExcludePlatforms: null, IncludePlatforms: null },
      Users: { ExcludeGroups: [BREAKGLASS, SVCACCTS], ExcludeUsers: [], IncludeGroups: [], IncludeRoles: [], IncludeUsers: ["All"], ExcludeRoles: [] },
      SignInRiskLevels: [], UserRiskLevels: [],
    },
    DisplayName: name,
    GrantControls: {
      AuthenticationStrength: { AllowedCombinations: null, Id: null, DisplayName: null },
      BuiltInControls: ["mfa"], Operator: "OR", TermsOfUse: [], CustomAuthenticationFactors: [],
    },
    Id: id,
    ModifiedDateTime: "2026-05-06T18:37:20Z",
    SessionControls: { SignInFrequency: { IsEnabled: null, Value: null }, PersistentBrowser: { IsEnabled: null, Mode: null } },
    State: "enabledForReportingButNotEnforced",
    TemplateId: null,
    AdditionalProperties: { "@odata.context": "x" },
    ...extra,
  });
}

/** Portal / REST style: camelCase, sparse. */
function restPolicy(p: Record<string, unknown>) {
  return JSON.stringify({ "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#policies", ...p });
}

const files: BaselineFile[] = [
  { path: "Updated/Policies/IAC - GLOBAL - GRANT - MFA - AllUsers.json", text: sdkPolicy("IAC - GLOBAL - GRANT - MFA - AllUsers", "a66e8427-e5e7-4072-bfd1-7e99db7a7dc4") },
  // Same policy, older generation, different casing → superseded.
  { path: "Policies/ACME_-_GLOBAL_-_GRANT_-_MFA_-_AllUsers (1).json", text: restPolicy({ id: "a66e8427-e5e7-4072-bfd1-7e99db7a7dc4", displayName: "IAC - GLOBAL – GRANT – MFA - AllUsers", state: "enabled", conditions: { users: { includeUsers: ["All"], excludeGroups: [BREAKGLASS] }, applications: { includeApplications: ["All"] } }, grantControls: { operator: "OR", builtInControls: ["mfa"] } }) },
  // Documentation copy → superseded by Updated/Policies.
  { path: "Updated/Documentation/IAC - GLOBAL - GRANT - MFA - AllUsers/policy.json", text: sdkPolicy("IAC - GLOBAL - GRANT - MFA - AllUsers", "a66e8427-e5e7-4072-bfd1-7e99db7a7dc4") },
  { path: "Updated/Documentation/IAC - GLOBAL - GRANT - MFA - AllUsers/README.md", text: "# IAC - GLOBAL - GRANT - MFA - AllUsers\n\n**State:** Report-only\n\n## Intent\n\nBaseline MFA for all users. Enable last in Phase 1.\n\n## Policy Configuration\n\n| a | b |\n" },
  // Block legacy auth, camelCase.
  { path: "Updated/Policies/IAC - GLOBAL - BLOCK - Legacy Authentication.json", text: restPolicy({ id: "11111111-1111-4111-8111-111111111111", displayName: "IAC - GLOBAL - BLOCK - Legacy Authentication", state: "enabled", conditions: { users: { includeUsers: ["All"], excludeGroups: [BREAKGLASS, SVCACCTS] }, applications: { includeApplications: ["All"] }, clientAppTypes: ["exchangeActiveSync", "other"] }, grantControls: { operator: "OR", builtInControls: ["block"] } }) },
  // Two geo-block variants: same intent, different location scoping.
  { path: "Updated/Policies/IAC - GLOBAL - BLOCK - Countries not Allowed.json", text: restPolicy({ id: "22222222-2222-4222-8222-222222222222", displayName: "IAC - GLOBAL - BLOCK - Countries not Allowed", state: "enabled", conditions: { users: { includeUsers: ["All"], excludeGroups: [BREAKGLASS] }, applications: { includeApplications: ["All"] }, locations: { includeLocations: ["All"], excludeLocations: [TRUSTED_LOC] } }, grantControls: { operator: "OR", builtInControls: ["block"] } }) },
  { path: "Updated/Policies/IAC - GLOBAL - BLOCK - Countries not Allowed - NoExclusions.json", text: restPolicy({ id: "33333333-3333-4333-8333-333333333333", displayName: "IAC - GLOBAL - BLOCK - Countries not Allowed - NoExclusions", state: "enabled", conditions: { users: { includeUsers: ["All"], excludeGroups: [BREAKGLASS] }, applications: { includeApplications: ["All"] }, locations: { includeLocations: ["0de51b52-e831-4248-a053-a51aa56f28f1"] } }, grantControls: { operator: "OR", builtInControls: ["block"] } }) },
  // Passkey registration pilot, custom auth strength.
  { path: "Updated/Policies/IAC - GLOBAL - GRANT - MFA-Passkey - UserRegistration.json", text: restPolicy({ id: "44444444-4444-4444-8444-444444444444", displayName: "IAC - GLOBAL - GRANT - MFA-Passkey - UserRegistration", state: "enabledForReportingButNotEnforced", conditions: { users: { includeGroups: [PILOT], excludeGroups: [BREAKGLASS] }, applications: { includeUserActions: ["urn:user:registersecurityinfo"] } }, grantControls: { operator: "OR", builtInControls: [], authenticationStrength: { id: "42de22a7-5339-4a58-b560-28565d53b14d" } } }) },
  // Admin MFA with role template ids and the built-in phishing-resistant strength.
  { path: "Updated/Policies/IAC - GLOBAL - GRANT - MFA - AllAdmins.json", text: restPolicy({ id: "55555555-5555-4555-8555-555555555555", displayName: "IAC - GLOBAL - GRANT - MFA - AllAdmins", state: "enabled", conditions: { users: { includeRoles: ["62e90394-69f5-4237-9190-012177145e10"], excludeGroups: [BREAKGLASS] }, applications: { includeApplications: ["All"] } }, grantControls: { operator: "OR", builtInControls: [], authenticationStrength: { id: "00000000-0000-0000-0000-000000000004" } } }) },
  // Older generation, different ids: one superseded by family name, one only present here (fallback keeps it).
  { path: "Policies/ACME_-_GLOBAL_-_BLOCK_-_Device_Code_Auth_Flow (1).json", text: restPolicy({ id: "77777777-7777-4777-8777-777777777777", displayName: "ACME - GLOBAL - BLOCK - Device Code Auth Flow", state: "enabled", conditions: { users: { includeUsers: ["All"], excludeGroups: [BREAKGLASS] }, applications: { includeApplications: ["All"] }, authenticationFlows: { transferMethods: "deviceCodeFlow" } }, grantControls: { operator: "OR", builtInControls: ["block"] } }) },
  { path: "Updated/Policies/IAC - GLOBAL - BLOCK - Device Code Auth Flow.json", text: restPolicy({ id: "88888888-8888-4888-8888-888888888888", displayName: "IAC - GLOBAL - BLOCK - Device Code Auth Flow", state: "enabled", conditions: { users: { includeUsers: ["All"], excludeGroups: [BREAKGLASS] }, applications: { includeApplications: ["All"] }, authenticationFlows: { transferMethods: "deviceCodeFlow" } }, grantControls: { operator: "OR", builtInControls: ["block"] } }) },
  { path: "Policies/ACME_-_APP_-_BLOCK_-_Copilot (1).json", text: restPolicy({ id: "99999999-9999-4999-8999-999999999999", displayName: "ACME - APP - BLOCK - Copilot", state: "enabled", conditions: { users: { includeUsers: ["All"], excludeGroups: [BREAKGLASS, "CA-Copilot-Users-GroupId-ReplaceMe"] }, applications: { includeApplications: ["fb8d773d-7ef8-4ec0-a117-179f88add510"] } }, grantControls: { operator: "OR", builtInControls: ["block"] } }) },
  // Agent policy exported by an SDK that dropped the agent conditions: targets nobody.
  { path: "Updated/Policies/IAC - AGENT - BLOCK - HighRiskAgent.json", text: sdkPolicy("IAC - AGENT - BLOCK - HighRiskAgent", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { Conditions: { Applications: { IncludeApplications: ["All"] }, ClientAppTypes: ["all"], Users: { IncludeUsers: ["None"], ExcludeGroups: [] } }, GrantControls: { BuiltInControls: ["block"], Operator: "OR" } }) },
  // Noise: a test-folder file, a broken file, and a non-policy JSON.
  { path: "Updated/Policies/Test/IAC - O365 - BLOCK - NonWorkingHours.json", text: restPolicy({ id: "66666666-6666-4666-8666-666666666666", displayName: "Test policy", conditions: {} }) },
  { path: "Policies/Broken.json", text: '{"displayName": "Broken", "conditions": {' },
  { path: "Updated/index.json", text: '{"files": []}' },
];

test("dedupes across generations and casings, preferring Updated/Policies", () => {
  const pkg = loadBaseline(files);
  const names = pkg.policies.map((p) => p.displayName);
  assert.equal(names.filter((n) => nameKey(n) === nameKey("IAC - GLOBAL - GRANT - MFA - AllUsers")).length, 1);
  assert.equal(pkg.origins["IAC - GLOBAL - GRANT - MFA - AllUsers"], "Updated/Policies/IAC - GLOBAL - GRANT - MFA - AllUsers.json");
  assert.equal(pkg.report.duplicates.length, 3);
  assert.equal(pkg.policies.length, 9);
});

test("older generation only fills gaps in the newest generation", () => {
  const pkg = loadBaseline(files);
  const names = pkg.policies.map((p) => p.displayName);
  assert.ok(names.includes("IAC - GLOBAL - BLOCK - Device Code Auth Flow"));
  assert.ok(!names.includes("ACME - GLOBAL - BLOCK - Device Code Auth Flow"));
  assert.ok(names.includes("ACME - APP - BLOCK - Copilot")); // fallback keeps what Updated lacks
  assert.ok(pkg.report.duplicates.some((d) => d.reason.startsWith("older generation of")));
});

test("named placeholder tokens become tenant-specific references", () => {
  const pkg = loadBaseline(files);
  const ph = pkg.references.find((r) => r.placeholder);
  assert.ok(ph);
  assert.equal(ph!.kind, "group");
  assert.equal(ph!.id, "ca-copilot-users-groupid-replaceme");
  assert.equal(ph!.portability, "tenantSpecific");
});

test("warns about policies that target nothing", () => {
  const pkg = loadBaseline(files);
  assert.equal(pkg.report.warnings.length, 1);
  assert.equal(pkg.report.warnings[0].policyName, "IAC - AGENT - BLOCK - HighRiskAgent");
});

test("reports bad and irrelevant files instead of throwing", () => {
  const pkg = loadBaseline(files);
  assert.ok(pkg.report.errors.some((e) => e.path === "Policies/Broken.json"));
  assert.ok(pkg.report.skipped.some((s) => s.path.includes("/Test/") && s.reason === "test folder"));
  assert.ok(pkg.report.skipped.some((s) => s.path === "Updated/index.json"));
});

test("normalizes SDK PascalCase into Graph camelCase and prunes null noise", () => {
  const pkg = loadBaseline(files);
  const p = pkg.policies.find((x) => x.displayName === "IAC - GLOBAL - GRANT - MFA - AllUsers")!;
  assert.deepEqual(p.conditions.users?.excludeGroups, [BREAKGLASS, SVCACCTS]);
  assert.deepEqual(p.grantControls?.builtInControls, ["mfa"]);
  assert.equal(p.grantControls?.authenticationStrength, undefined);
  assert.equal(p.sessionControls, undefined);
  assert.equal((p as unknown as Record<string, unknown>).additionalProperties, undefined);
  assert.equal(p.state, "enabledForReportingButNotEnforced");
});

test("classifies references by portability", () => {
  const pkg = loadBaseline(files);
  const byId = Object.fromEntries(pkg.references.map((r) => [r.id, r]));
  assert.equal(byId[BREAKGLASS].kind, "group");
  assert.equal(byId[BREAKGLASS].portability, "tenantSpecific");
  assert.equal(byId["62e90394-69f5-4237-9190-012177145e10"].portability, "stable"); // Global Administrator template id
  assert.equal(byId["00000000-0000-0000-0000-000000000004"].portability, "stable"); // built-in phishing-resistant
  assert.equal(byId["42de22a7-5339-4a58-b560-28565d53b14d"].portability, "tenantSpecific"); // custom strength
  assert.equal(byId[TRUSTED_LOC].kind, "namedLocation");
  assert.ok(!("all" in byId));
});

test("infers group roles from usage signatures", () => {
  const pkg = loadBaseline(files);
  const sig = Object.fromEntries(pkg.groupSignatures.map((s) => [s.id, s]));
  assert.equal(sig[BREAKGLASS].inferredRole, "globalExclusion");
  assert.equal(sig[BREAKGLASS].excludedFrom.length, 8);
  assert.equal(sig[SVCACCTS].inferredRole, "serviceAccounts");
  assert.equal(sig[PILOT].inferredRole, "passkeyPilot");
});

test("detects same-intent variants and leaves distinct policies alone", () => {
  const pkg = loadBaseline(files);
  assert.equal(pkg.variantSets.length, 1);
  assert.equal(pkg.variantSets[0].relation, "variant");
  assert.deepEqual(pkg.variantSets[0].policyNames, [
    "IAC - GLOBAL - BLOCK - Countries not Allowed",
    "IAC - GLOBAL - BLOCK - Countries not Allowed - NoExclusions",
  ]);
  const mfa = pkg.policies.find((p) => p.displayName.endsWith("AllUsers"))!;
  const legacy = pkg.policies.find((p) => p.displayName.includes("Legacy"))!;
  assert.notEqual(intentKey(mfa), intentKey(legacy));
});

test("extracts author intent from README and matches it to a policy", () => {
  const pkg = loadBaseline(files);
  assert.equal(pkg.docs.length, 1);
  assert.equal(pkg.docs[0].intent, "Baseline MFA for all users. Enable last in Phase 1.");
});

test("precedence mirrors Updated + fallback", () => {
  assert.ok(precedenceFor("Updated/Policies/x.json") > precedenceFor("Updated/Documentation/x/policy.json"));
  assert.ok(precedenceFor("Updated/Documentation/x/policy.json") > precedenceFor("Policies/x.json"));
  assert.equal(precedenceFor("x.json"), precedenceFor("CA/x.json"));
});
