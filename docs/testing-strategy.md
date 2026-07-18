# Testing strategy

Tests will progress with the milestones: schema/normalizer unit tests and a live/cached scanner integration test in M1; evidence and AI contract tests in M2; worktree, patch, verification, rescan, and report tests in M3; critical UI smoke coverage in M4.

M1 currently includes contract validation tests, golden normalizer tests, malformed-output rejection, a clean-reset live scanner smoke script, fixture tests/build checks, and a manual browser click-path verification. The live smoke requires network access to OSV; unit tests do not.

M2 advisory tests compare every live/cached semantic field, assert explicit provenance, exercise malformed-live fallback and cache path rejection, and remain network-independent.

M2 evidence tests verify exact import/call-site lines and excerpts, absence safety language, repository-relative paths, positive line ranges, and truncation limits. The demo evidence command adds a live scanner-to-evidence integration check.

M2 assessment tests reject invalid verdicts, missing uncertainty, invented citations, absence-as-support, unsupported not-affected prose, and interpretation that contradicts a deterministic call site. A fake OpenAI client verifies the exact model, Responses API options, and four permitted context groups without network or model cost. The checked-in fallback is validated independently. `npm run investigate:demo` exercises the live scanner through the complete investigation pipeline and selects live GPT‑5.6 only when credentials are present.

The browser acceptance path clicks scan and investigate against the production build, verifies all three evidence items and all uncertainty sections, and checks for console errors.

M3 approval tests validate the remediation schema and GPT‑5.6 request contract, reject unsupplied versions, path traversal, invented files, and non-allowlisted commands, and require an evidence-backed source file for the combined strategy. Gate tests prove that awaiting and cancelled plans fail closed, an exact approval opens the gate, tampering invalidates approval, decisions cannot be overwritten, and cancellation leaves all four planned demo files unchanged.

Browser acceptance covers both terminal decisions. The full plan is visible before either action; cancel renders repository-unchanged confirmation, approval renders the recorded timestamp and explicitly states that no patch has started, and both paths have clean browser logs.

M3 isolation tests create real temporary Git repositories. They prove that approval is required before filesystem mutation, dirty tracked or untracked input is rejected before run storage exists, path traversal and out-of-bound run roots fail, and a successful branch/worktree preserves the source branch, commit, and clean status. The success test also writes an isolated-only file and proves it is absent from the source checkout, validates the ordered JSON audit, then safely removes its exact temporary worktree and branch.

Browser acceptance extends the golden click path through **Create isolated workspace**. It verifies the clean-source badge, baseline, source and isolated branches, contained run paths, six audit events, explicit no-patch state, and clean browser logs.
