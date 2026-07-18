# Build journal

## 2026-07-18 — Project control and specification pass

- Read the complete 1,560-line technical specification before implementation.
- Established the narrow promise and enforced the M1 gate: no AI affectedness work before deterministic scan acceptance.
- Verified Node.js 22.23.1, npm 10.9.8, and an empty Git repository on `main`.
- Found `osv-scanner` and `gh` unavailable locally; scanner bootstrapping is part of M1, while remote GitHub setup is non-blocking.
- Preserved the main Codex task/session ID: `019f7422-123d-7242-a0cf-c7f6f237594b`.
- Created the workspace skeleton, local GitHub issue plan, milestone checklist, documentation placeholders, and Notion fallback structure.
- Initial workspace check exposed Vitest's expected no-tests failure; added a contract smoke test and limited `--passWithNoTests` to feature workspaces that have not received tests yet.
- Scope expansions: none.

## 2026-07-18 — Issue 2: golden demo fixture

- Acceptance target: deterministic reset, installable direct vulnerability, relevant safe API use, fast passing baseline tests, fewer than 15 source files.
- Compared live OSV records for several npm candidates. Selected `json5@1.0.1` because it currently yields exactly one advisory (`GHSA-9c47-m6qq-7p4h`) and has clear fixed versions.
- Designed a tiny CLI that passes user-provided theme configuration to `JSON5.parse`; no exploit payload is stored or executed.
- The later meaningful source change will validate and copy a narrow theme schema at the input boundary alongside the dependency update. This satisfies the existing golden-demo requirement and is not a scope expansion.
- Scope expansions: none.
