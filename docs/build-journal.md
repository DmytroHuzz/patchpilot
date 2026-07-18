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
