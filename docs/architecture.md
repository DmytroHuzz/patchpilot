# Architecture

This document grows only with implemented milestones. Full verification, rescan, and report generation remain placeholders until their issues begin.

The Milestone 1 slice is: bundled npm fixture → OSV-Scanner subprocess → validated normalized finding → findings UI.

## Implemented M1 components

- `scripts/setup-osv-scanner.sh` pins OSV-Scanner 2.3.8, selects the macOS/Linux architecture, and verifies the official SHA-256 checksum.
- The server adapter invokes the CLI without a shell, with a 30-second timeout and 5 MiB output cap. Exit `1` is accepted only when it contains valid finding JSON.
- Zod validates both the raw fields PatchPilot consumes and the normalized public contract.
- The CLI writes the latest normalized scan artifact to the ignored `runs/m1-scan.json` path.
- The read-only `POST /api/demo/scan` endpoint scans only the bundled fixture; the React screen renders the returned facts.

OSV and command output are deterministic facts. There is no model call or interpretation in M1.

## Implemented M2 advisory boundary

- Live OSV advisory objects normalize into a dedicated Zod contract for identity, aliases, summary, details, severity, affected ranges, fixed versions, affected functions when structured data supplies them, references, and provenance.
- Normalized details exclude proof-of-concept sections before any later model context is built.
- The checked-in golden advisory uses the same contract and is always labeled `cached-demo`; it is never represented as fresh OSV data.
- The resolver prefers valid matching live data and falls back only when live data is absent, malformed, or mismatched.
- Cached paths accept only safe advisory IDs and remain inside the configured cache directory.

## Implemented M2 evidence boundary

- The read-only collector walks a bounded set of JavaScript, TypeScript, and JSON source files while skipping dependencies, Git data, build output, lockfiles, oversized files, and symlinks.
- Advisory text supplies deterministic symbol and configuration search terms; the collector does not invent reachability claims.
- Import, call-site, configuration, and absence evidence use stable IDs, repository-relative paths, exact positive line ranges, compact excerpts, and factual explanations.
- Absence evidence explicitly states that a missed reference is not proof of non-applicability.
- `npm run evidence:demo` writes the validated golden bundle to the ignored `runs/m2-evidence.json` artifact and fails unless the expected call site is present.

## Implemented M2 interpretation boundary

- The model receives exactly four context groups: normalized advisory, package relationship, repository metadata, and bounded evidence. Absolute repository paths, arbitrary source files, scanner output, and proof-of-concept content are excluded.
- The OpenAI integration uses the Responses API, explicit `gpt-5.6` model alias, medium reasoning effort, disabled response storage, and Zod-backed Structured Outputs.
- `AffectednessAssessment` permits only four bounded verdicts and requires rationale, confidence, evidence ID arrays, non-empty unknowns, non-empty limitations, and next checks.
- Post-schema validation rejects invented or duplicate evidence IDs, absence evidence used to support affectedness, unsupported not-affected prose, and no-usage verdicts that contradict a deterministic call site.
- If `OPENAI_API_KEY` is absent, the investigator loads an explicitly labeled `cached-demo` contract fixture and applies the same validators. It is never presented as a live model response.
- `POST /api/demo/investigate` performs scan → advisory → evidence → assessment without repository writes. The UI separates deterministic facts, evidence, interpretation, uncertainty, and provenance.

## Implemented M3 approval boundary

- The remediation planner receives only the validated finding, affectedness assessment, package metadata, evidence-backed excerpts, test structure, and explicit file/command allowlists.
- GPT‑5.6 returns a strict `RemediationPlan`; the cached fallback uses the same schema and is visibly labeled. Post-schema validation restricts the target to supplied fixed versions and every file/command to the input allowlist.
- Every plan requires human approval and includes target version, strategy, explanation, expected files, compatibility risks, proposed commands, and verification intent.
- A plan ID is the SHA-256 digest of the exact validated plan. Approval records bind a decision and timestamp to that ID; tampered, missing, awaiting, or cancelled proposals fail the reusable write gate.
- Approval state is intentionally in-memory for the single demo session. Restarting the server clears it.
- `POST /api/demo/remediation-plan` is read-only. `POST /api/demo/remediation-decision` records `approved` or `cancelled`; neither endpoint creates a worktree or modifies the target repository.

## Implemented M3 isolation boundary

- `POST /api/demo/isolate` accepts only a known plan ID whose exact validated content has an `approved` record. Awaiting, cancelled, tampered, missing, and expired plans fail before filesystem mutation.
- The executor resolves the selected repository and Git root canonically inside the configured project boundary. Worktree, isolated-repository, and audit paths must also remain inside explicitly configured run roots.
- A full porcelain Git status rejects tracked or untracked source changes with an actionable message before run directories, branches, or worktrees are created.
- The baseline commit and source branch are captured before `git worktree add -b` creates a unique `patchpilot/run-*` branch and separate worktree. Git is invoked directly without a shell, with timeout and output bounds.
- The selected demo subdirectory is mapped to the same repository-relative location inside the new worktree. Baseline commit and branch are verified from the worktree before it is marked ready.
- A validated JSON audit record stores approval, clean-state fact, baseline, paths, branch, and six ordered lifecycle events under ignored `runs/audit/`. No dependency or source change occurs in Issue #8.

## Implemented M3 dependency-update boundary

- `POST /api/demo/dependency-update` requires the same approved plan and a ready in-memory isolation run. The plan must contain the exact `npm install json5@1.0.2 --save-exact` command.
- Before execution, the service rechecks the isolated branch, baseline commit, clean worktree, canonical paths, and unchanged source checkout.
- npm runs directly without a shell inside the isolated repository, with a 60-second timeout and 512 KiB process-output cap. Returned stdout/stderr are bounded to 32 KiB each.
- The executor snapshots `package.json` and `package-lock.json`, then requires json5 to reach the planned version in the manifest, lockfile root, and locked package entry.
- Parsed manifest and lockfile copies with only json5 removed must remain structurally identical. Git must report exactly `package.json` and `package-lock.json` as changed.
- The complete dependency diff, bounded command result, version proof, and clean-source fact are validated and written to a separate ignored JSON artifact. Compatibility repair, tests, build, rescan, and branch commit do not run in Issue #9.

## Implemented M3 compatibility-repair boundary

- `POST /api/demo/compatibility-repair` requires the same approved plan, ready isolation run, and recorded successful dependency update from the active server session. Run and plan IDs must agree.
- Before a source write, the executor rechecks canonical paths, isolated branch and baseline, clean source checkout, the exact two-file dependency checkpoint, and byte-for-byte equality with the recorded dependency diff.
- GPT‑5.6 receives exactly six bounded context groups: attempt number, approved plan facts, dependency-update facts, the extracted `parseUserTheme` function, an optional relevant previous syntax failure, and fixed constraints. The checked-in fallback is explicitly labeled and passes the same schema and semantic validator.
- Validation permits only one exact replacement of `parseUserTheme` in `src/theme.js`. It requires the existing signature, `JSON5.parse(rawTheme)`, explicit `accent` and `density` handling with defaults, and rejects imports, dependency changes, commands, broad object spreads, and other unsafe constructs.
- Each applied attempt runs only `node --check src/theme.js` without a shell. A retry receives only bounded, redacted source-path/caret/`SyntaxError` lines. The loop stops after two failures and restores the original source; an exception after mutation also restores it.
- A successful run retains exactly `package-lock.json`, `package.json`, and `src/theme.js`, plus the source diff and attempt/probe audit in ignored run storage. No test generation, full suite/build, rescan, commit, or push runs in Issue #10.

## Implemented M3 targeted-test boundary

- `POST /api/demo/targeted-test` requires the same approved plan, ready isolation run, dependency result, and passing compatibility-repair result from the active server session. All plan/run identities must agree.
- Before a test-file write, the executor rechecks canonical paths, branch, baseline, source cleanliness, the exact repaired three-file checkpoint, and byte-for-byte equality with the recorded dependency and source diffs.
- GPT‑5.6 receives exactly six bounded groups: approved test intent, dependency facts, repair status, the repaired `parseUserTheme` function, the existing test file, and fixed constraints. The explicit cached fixture passes the same strict schema and semantic validator.
- Validation permits exactly one `it(...)` block in `test/theme.test.js` before the final suite close. It requires a benign `previewLabel: ignored` input, supported `accent`/`density` assertions, and absence proof via `Object.hasOwn`; prototype-related keys, exploit payloads, imports, commands, processes, and multiple tests fail closed.
- The executor runs only `node --test test/theme.test.js` without a shell under timeout/output limits. Exit 0 retains the four-file diff; any failed command restores the original test file and records the failure honestly.
- The result artifact retains model provenance, safety rationale, uncertainty, exact test diff, bounded command facts, and source-clean state. No full suite, build, rescan, commit, push, or report runs in Issue #11.
