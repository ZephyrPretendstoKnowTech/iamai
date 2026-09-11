# Decide How Devices Are Managed

## Goal
Record the owner's phone and computer management choices so IAMAI's downstream device policies require only postures the business actually intends to operate.

## Why this exists
A Conditional Access device policy cannot safely invent an Intune, app-protection, hybrid-join, or no-mobile-data strategy. The decision has to exist before the policy body can be generated.

## Applies when
IAMAI has observed device usage/posture but the owner has not saved both the phone and computer management choices.

## Do not show implementation when
This is a decision step. It never exposes Entra, JSON, or PowerShell mutation. Do not convert observed posture into an owner decision.

## Prerequisites
IAMAI may show the device evidence it already has, the tenant's Intune/compliance availability, and downstream steps affected by the choice.

## Owner decisions
Phones — choose one:
1. Enrol phones in Intune.
2. Protect the apps only.
3. No company data on phones.

Computers — choose one:
1. Enrol in Intune.
2. Microsoft Entra hybrid joined is enough.
3. Not managed.

If the product presents a stricter "block phones that are not enrolled" choice, that is also an explicit owner choice, never an inferred default.

## Current-state inputs
Observed phone/computer use, joined/enrolled/compliant evidence, Intune availability, and the downstream policy dependencies already known by IAMAI.

## Target state
A saved owner decision record that downstream steps consume deterministically. No tenant configuration is created by this step.

## Security-significant fields
Phone strategy, computer strategy, any strict block-unenrolled-phone choice, and the evidence snapshot shown when the owner decides.

## Preserve
Preserve the owner's exact saved decision until they explicitly change it. A later scan updates evidence, not the decision.

## Do not do
- Do not infer "enrol" because Intune is licensed.
- Do not infer "not managed" because no enrollment was observed.
- Do not claim MAM protects every app or platform; downstream implementation must use supported app-protection capabilities.
- Do not generate a compliant-device policy before the decision and prerequisite compliance posture exist.

## State variants
Needs decision; Decided; Blocked.

## Verification
After save, the next plan build must show the exact saved choice beside downstream device-policy scope and must not silently broaden supported platforms.

## Rollback / safe recovery
Changing the decision reopens/recomputes dependent device-policy work. Do not silently rewrite already-deployed policy scope without the normal IAMAI correction lifecycle.

## Limitations / unknowns
This package does not design Intune enrollment, compliance, or app-protection policy details. Those are implementation consequences of the saved decision, not part of this decision artifact.

## Source verification
Microsoft Intune enrollment, MAM-without-enrollment, and Conditional Access device guidance rechecked September 10, 2026.
