# Architecture

This document grows only with implemented milestones. Patch isolation, verification, and report generation remain placeholders until their milestones begin.

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
