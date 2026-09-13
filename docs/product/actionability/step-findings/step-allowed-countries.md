# Step findings: Create or Correct Allowed Countries Location

**Step ID:** `s-prereq-allowed-countries`
**Archetype:** Foundation object with owner input (country selector + travel question)
**Current state:** Ready · Create
**Channels:** Entra, PowerShell, AI Info

## Step-specific fixes

### S-AC-1: Remove PowerShell channel
Per U15.

### S-AC-2: What to do section present — remove
Contains: "Make the object this step names." + country list (showing "United States") + travel question ("No sign-ins from outside United States since Aug 13, 2026. Does anyone travel or work abroad?" with options Nobody / Occasionally / Regularly + Save). The country selector and travel question move to the action column (U2).

### S-AC-3: Travel question is a conditional input
The travel question ("Does anyone travel or work abroad?") owns the `travel-exceptions-allowed` condition from the dependency graph. Per U28, the admin must explicitly save an answer before the geo-restriction step can proceed to enforcement. Currently the question is embedded in What-to-do without a clear completion gate.

### S-AC-4: No Learn link in Why
Why: "The countries policy blocks sign-ins from everywhere except this list, so the list has to be right before the policy exists." Add inline Learn link.

### S-AC-5: Milestone sub-text filler
"Make the object this step names." Remove per U3.

### S-AC-6: Impact "Configuration only"
Replace per U13 with "Named locations" or "Country restrictions".

### S-AC-7: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Set the date to the date the Implementation content was last verified against current Microsoft documentation. If authoring new content, use the current date. Format: `"YYYY-MM-DD"`. The renderer (added in A4) already shows this field when present.

### S-AC-8: Done-when good
"A countries named location with exactly United States exists in the tenant." Specific. Keep.

## Universal items: U1, U2, U3, U13, U15, U25, U26, U28.
