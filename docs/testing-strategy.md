# Testing strategy

PatchPilot separates network-independent correctness checks, live golden-fixture smoke checks, and browser acceptance. A passing unit suite does not substitute for the real scanner/rescan path; a passing golden path does not claim general security effectiveness.

## Commands

```bash
npm run check              # documentation contract, typecheck, 62 tests, production builds
./scripts/verify-demo.sh   # reset + fixture install/tests/build + real OSV scan
./demo/run-demo.sh         # reset and launch the complete interactive path
```

`npm run check` is the required CI check and does not require network after `npm ci`. `verify-demo.sh` downloads or queries OSV data and is the separate Demo smoke job.

## Current verification matrix

| Layer | What it proves | Network |
| --- | --- | --- |
| Documentation contract | All 20 required README sections exist, local Markdown links resolve, screenshots exist, and public files contain no internal-planning reference | No |
| Contracts/unit tests | Raw/normalized schemas, citation rules, model semantics, approval invariants, scanner exit behavior | No |
| Real temporary-Git integration | Dirty-tree stops, canonical containment, exact diffs, restoration, command order, commit parent/file boundaries | No |
| Production builds | Server TypeScript and React/Vite bundles compile | No |
| Demo smoke | Clean fixture reset, baseline fixture tests/build, real OSV-Scanner finding | Yes |
| Manual browser acceptance | Complete visible workflow, terminal facts, downloads/copy controls, clean browser logs | OSV; OpenAI optional |

The clean-clone acceptance for Issue #15 runs root install/check and live demo verification from a separate clone, not from the development working tree.

## Implemented coverage by milestone

Tests progressed from schema/normalizer and scanner coverage in M1; through evidence and AI contracts in M2; into worktree, patch, verification, rescan, and report integration in M3; and critical UI/handoff acceptance in M4.

M1 currently includes contract validation tests, golden normalizer tests, malformed-output rejection, a clean-reset live scanner smoke script, fixture tests/build checks, and a manual browser click-path verification. The live smoke requires network access to OSV; unit tests do not.

M2 advisory tests compare every live/cached semantic field, assert explicit provenance, exercise malformed-live fallback and cache path rejection, and remain network-independent.

M2 evidence tests verify exact import/call-site lines and excerpts, absence safety language, repository-relative paths, positive line ranges, and truncation limits. The demo evidence command adds a live scanner-to-evidence integration check.

M2 assessment tests reject invalid verdicts, missing uncertainty, invented citations, absence-as-support, unsupported not-affected prose, and interpretation that contradicts a deterministic call site. A fake OpenAI client verifies the exact model, Responses API options, and four permitted context groups without network or model cost. The checked-in fallback is validated independently. `npm run investigate:demo` exercises the live scanner through the complete investigation pipeline and selects live GPT‑5.6 only when credentials are present.

The browser acceptance path clicks scan and investigate against the production build, verifies all three evidence items and all uncertainty sections, and checks for console errors.

M3 approval tests validate the remediation schema and GPT‑5.6 request contract, reject unsupplied versions, path traversal, invented files, and non-allowlisted commands, and require an evidence-backed source file for the combined strategy. Gate tests prove that awaiting and cancelled plans fail closed, an exact approval opens the gate, tampering invalidates approval, decisions cannot be overwritten, and cancellation leaves all four planned demo files unchanged.

Browser acceptance covers both terminal decisions. The full plan is visible before either action; cancel renders repository-unchanged confirmation, approval renders the recorded timestamp and explicitly states that no patch has started, and both paths have clean browser logs.

M3 isolation tests create real temporary Git repositories. They prove that approval is required before filesystem mutation, dirty tracked or untracked input is rejected before run storage exists, path traversal and out-of-bound run roots fail, and a successful branch/worktree preserves the source branch, commit, and clean status. The success test also writes an isolated-only file and proves it is absent from the source checkout, validates the ordered JSON audit, then safely removes its exact temporary worktree and branch.

Browser acceptance extends the golden click path through **Create isolated workspace**. It verifies the clean-source badge, baseline, source and isolated branches, contained run paths, six audit events, explicit no-patch state, and clean browser logs.

M3 dependency-update tests run against real temporary Git repositories and isolated worktrees with an injected deterministic npm runner. They prove the exact command/cwd, manifest and lockfile target versions, complete two-file diff, source-checkout preservation, approval failure before command execution, unrelated lockfile rejection, and source-file rejection. A separate live acceptance uses the real npm registry command against the golden isolated worktree and verifies json5 1.0.2 in both files while minimist remains 1.2.8.

Browser acceptance extends the click path through **Apply approved dependency update** and checks the exact command result, 1.0.1 → 1.0.2 version proof, two changed files, zero unrelated changes, visible diff, clean source checkout, and absence of browser errors.

M3 compatibility-repair tests validate the strict GPT‑5.6 request and output boundary, explicit cached provenance, exact function matching, required narrow field handling, and rejection of stale text or broad object spread. Real temporary Git repositories exercise both terminal paths: a first-attempt syntax pass retains exactly the approved three-file diff, while two injected syntax failures pass only bounded/redacted relevant lines to the retry and then restore the original source.

A separate live-worktree acceptance starts from the real approved json5 update, applies the checked-in validated golden repair, runs the actual `node --check src/theme.js` probe, verifies one passing attempt and the exact three-file diff, and proves the source checkout remains clean. Browser acceptance extends the click path through **Repair source compatibility** and checks model provenance, attempt audit, passing syntax fact, source diff, clean-source badge, explicit remaining unknowns, and the no-full-verification boundary.

M3 targeted-test tests verify the six-group GPT‑5.6 request, explicit cached provenance, one-test/file/insertion constraints, and rejection of imports, prototype operations, weaponized input, and multiple tests. Real temporary Git tests prove that a passing injected targeted command retains the exact four-file diff, while a failing command restores the original test and returns to the repaired three-file checkpoint. Suite-close regression coverage accepts the bundled file's trailing blank lines without widening the insertion location.

Live-worktree acceptance runs the actual `node --test test/theme.test.js` command against the approved repaired worktree. It requires exit 0, one ten-line benign `previewLabel` test, no prototype-related keys, exactly four changed files, a retained audit/diff, and a clean source checkout. Browser acceptance extends the full click path through **Add targeted regression test** and checks provenance, generated test, safety rationale, targeted command facts, diff, uncertainty, clean-source state, and the explicit full-verification boundary.

M3 verification tests use real temporary Git repositories with an approved four-file checkpoint. The success path retains eight ordered command records and a clean selected-advisory rescan; failure paths prove a baseline-test failure stops before patched commands and a completed rescan that still contains the selected advisory fails closed with a distinct classification. Contract tests reject inconsistent scanner exit semantics and terminal failures without classifications.

Live acceptance runs real baseline and patched `npm ci --ignore-scripts`, targeted/full tests, and builds, then invokes OSV-Scanner against the patched lockfile. It requires eight bounded command facts, all expected passes, zero selected-advisory findings, the exact four-file diff, and a clean source checkout. Browser acceptance extends the click path through **Run full verification** and checks baseline/post-patch facts, command audit, rescan proof, failure classification, and the report-only next-step boundary.

M3 report tests compose a complete accepted chain and require byte-equivalent JSON/Markdown artifacts, every required trust-labeled section, repository-relative paths, and a fail-closed result when a cited source excerpt is changed. Live browser acceptance extends the complete click path through **Generate evidence report**, requires three valid evidence references, eight command facts, a verified final status, selected-advisory absence, visible uncertainty, working Markdown/JSON attachment downloads, and clean browser logs. The generated artifacts are also checked for all required headings and the absence of absolute local paths.

M4 handoff tests use real temporary Git repositories and worktrees. The success path commits exactly the verified four files, requires the verified baseline as its direct parent, leaves source and isolated checkouts clean, persists an audit artifact, and checks PR copy for verification, model/Codex provenance, limitations, repository-relative artifacts, and an explicit no-publication state. A fail-closed path proves an unexpected fifth file prevents any commit. Live browser acceptance extends the path through **Create local commit + PR copy** and verifies the local SHA/message/files, copy control, publication lock, and clean browser logs; no remote is configured or contacted.
