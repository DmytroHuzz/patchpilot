# Testing strategy

Tests will progress with the milestones: schema/normalizer unit tests and a live/cached scanner integration test in M1; evidence and AI contract tests in M2; worktree, patch, verification, rescan, and report tests in M3; critical UI smoke coverage in M4.

M1 currently includes contract validation tests, golden normalizer tests, malformed-output rejection, a clean-reset live scanner smoke script, fixture tests/build checks, and a manual browser click-path verification. The live smoke requires network access to OSV; unit tests do not.

M2 advisory tests compare every live/cached semantic field, assert explicit provenance, exercise malformed-live fallback and cache path rejection, and remain network-independent.

M2 evidence tests verify exact import/call-site lines and excerpts, absence safety language, repository-relative paths, positive line ranges, and truncation limits. The demo evidence command adds a live scanner-to-evidence integration check.
