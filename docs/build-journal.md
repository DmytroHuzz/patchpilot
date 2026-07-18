# Build journal

## 2026-07-18 — Project control and specification pass

- Read the complete 1,560-line technical specification before implementation.
- Established the narrow promise and enforced the M1 gate: no AI affectedness work before deterministic scan acceptance.
- Verified Node.js 22.23.1, npm 10.9.8, and an empty Git repository on `main`.
- Found `osv-scanner` and `gh` unavailable locally; scanner bootstrapping is part of M1, while remote GitHub setup is non-blocking.
- Preserved the main Codex task/session ID: `019f7422-123d-7242-a0cf-c7f6f237594b`.
- Created the workspace skeleton, local GitHub issue plan, milestone checklist, and documentation placeholders.
- Initial workspace check exposed Vitest's expected no-tests failure; added a contract smoke test and limited `--passWithNoTests` to feature workspaces that have not received tests yet.
- Scope expansions: none.

## 2026-07-18 — Issue 2: golden demo fixture

- Acceptance target: deterministic reset, installable direct vulnerability, relevant safe API use, fast passing baseline tests, fewer than 15 source files.
- Compared live OSV records for several npm candidates. Selected `json5@1.0.1` because it currently yields exactly one advisory (`GHSA-9c47-m6qq-7p4h`) and has clear fixed versions.
- Designed a tiny CLI that passes user-provided theme configuration to `JSON5.parse`; no exploit payload is stored or executed.
- The later meaningful source change will validate and copy a narrow theme schema at the input boundary alongside the dependency update. This satisfies the existing golden-demo requirement and is not a scope expansion.
- Scope expansions: none.

## 2026-07-18 — Issue 3: OSV adapter, normalization, and findings UI

- Acceptance target: reproducible scanner setup, bounded JSON subprocess, strict normalization, exact live finding, and visible findings screen.
- Pinned official OSV-Scanner 2.3.8 binaries for supported macOS/Linux architectures and verified downloads against the release SHA-256 file.
- Confirmed OSV-Scanner uses exit code 1 when findings exist; the adapter accepts it only with parseable JSON and treats other failures honestly.
- Added Zod contracts, raw-field validation, normalized range/fix/reference extraction, and malformed-output tests.
- Clean reset plus live scan returned exactly `GHSA-9c47-m6qq-7p4h` in direct dependency `json5@1.0.1`.
- Verified the UI through the real browser click path: the expected heading and all deterministic fact fields rendered from the live endpoint.
- Milestone 1 acceptance passed. No OpenAI API call, affectedness prompt, or AI analysis was added.
- Scope expansions: none.

## 2026-07-18 — Project control synchronization

- Published the clean `main` history to the public repository: https://github.com/DmytroHuzz/patchpilot.
- Enabled GitHub Issues and Dependabot vulnerability alerts; both CI and demo-smoke workflows passed on the initial push.
- Created milestones M1–M5, demo/priority labels, and all 17 issue-ready work items with user value, scope, acceptance criteria, dependencies, demo relevance, and explicit non-goals.
- Closed GitHub issues 1–3 with Milestone 1 verification comments. Issue 4 is the next Ready item; no M2 code began during this synchronization.
- GitHub Projects v2 creation remains pending because the authenticated CLI token lacks the separate `project` and `read:project` scopes.
- Scope expansions: none. This work completes the project-control deliverables already required by the specification.

## 2026-07-18 — Public/private planning boundary correction

- Removed internal planning-tool names, links, synchronization details, and mirror artifacts from the public repository.
- Rewrote the affected GitHub issue comment so public project communication covers GitHub state only.
- Kept the internal planning workspace and its data unchanged.
- Scope expansions: none.

## 2026-07-18 — Issue 4: advisory normalization and cached fallback

- Acceptance target: complete normalized OSV facts, deterministic cached parity, explicit fallback provenance, and network-independent contract tests.
- Added a dedicated advisory contract and reused its normalizer from the live OSV finding path.
- Added a checked-in golden advisory labeled `cached-demo`; the resolver uses it only when matching live input is absent or invalid.
- Excluded proof-of-concept sections from normalized details before later model context construction.
- Added tests for live/cached semantic parity, provenance, malformed-live fallback, and unsafe cache IDs.
- No repository evidence collection, model prompt, or affectedness assessment was added.
- Scope expansions: none.

## 2026-07-18 — Issue 5: bounded repository evidence

- Acceptance target: exact JSON5 import/call evidence, repository-relative file/line excerpts, bounded collection, and safe absence language.
- Added strict evidence item/bundle contracts and a read-only collector with file-count, file-size, total-byte, evidence-count, and excerpt-context limits.
- The first focused test exposed backticked advisory syntax around `parse`; expanded the deterministic parser to recognize that exact form and retained the test as a regression guard.
- Golden evidence identifies `src/theme.js:1` and `src/theme.js:8–10`, including the `JSON5.parse(rawTheme)` call.
- Added explicit absence evidence for `__proto__` that states absence is not proof of non-applicability.
- Added a demo integration command that writes a validated evidence artifact and fails when the expected call site is missing.
- No model call or affectedness verdict was added.
- Scope expansions: none.

## 2026-07-18 — Issue 6: structured affectedness assessment

- Acceptance target: strict GPT‑5.6 Structured Output, citations limited to collected evidence IDs, visible unknowns/limitations, safe absence semantics, and a clear facts/evidence/interpretation UI boundary.
- Added the current OpenAI JavaScript SDK and verified the Responses API `parse` contract with Zod-backed text formatting against the installed type definitions.
- The live path targets explicit model alias `gpt-5.6`, uses medium reasoning effort, disables response storage, and sends only normalized advisory, package relationship, repository metadata, and bounded evidence.
- Added post-schema guards for invented or duplicate evidence IDs, absence used as supporting evidence, unsupported not-affected prose, and verdicts that contradict deterministic call-site evidence.
- No `OPENAI_API_KEY` was available during acceptance. Added an explicitly labeled checked-in contract fixture; it runs through the same schema and citation validators and the UI never labels it live.
- `npm run check` passed 20 tests and all production builds. `npm run investigate:demo` passed from live OSV detection through the validated cached assessment.
- Browser verification passed the scan → investigate click path. The three evidence items, likely-affected/medium interpretation, citations, unknowns, limitations, recommended checks, and fallback provenance rendered with no console errors.
- No repository write occurs in the investigation path. No patch, approval, rescan-after-change, or report work began.
- Scope expansions: none.

## 2026-07-18 — Issue 7: remediation approval gate

- Acceptance target: display the full target/files/risks/commands/tests plan before a decision, require explicit approval for the exact plan before future writes, and prove cancel leaves the repository unchanged.
- Added a strict GPT‑5.6 `RemediationPlan` contract and a bounded context containing only the finding, assessment, package metadata, evidence-backed excerpts, test structure, allowed files, and allowed commands.
- Added validation that rejects unsupplied target versions, unsafe or invented paths, non-allowlisted commands, and a combined strategy without an evidence-backed source file.
- No `OPENAI_API_KEY` was available. The explicitly labeled cached plan targets `json5@1.0.2`, names four allowed files, includes a source-level input-boundary hardening step, lists compatibility risks, and proposes only four allowlisted commands.
- Bound approval to a SHA-256 ID of the exact plan. Missing, awaiting, cancelled, tampered, and already-decided proposals fail closed; cancellation is terminal.
- The first full check caught a duplicate variable name in the web request helper. Renamed the response value and retained the full typecheck as the regression check.
- `npm run check` passed 29 tests and all builds. `npm run plan:demo` passed from live OSV detection through an `awaiting_approval` proposal.
- Browser verification passed both decisions: cancel left the demo repository unchanged; approval recorded the exact plan and timestamp while explicitly stating no patch began. Browser logs were clean.
- No worktree, dependency update, source edit, test generation, or other patch action was implemented.
- Scope expansions: none.
