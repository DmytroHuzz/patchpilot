# Milestone checklist

## M0 — Project control

- [x] Local repository initialized on `main`.
- [x] Workspace and documentation skeleton created.
- [x] Local issue plan and definition of done visible.
- [x] Build journal and main Codex task ID recorded.
- [x] CI and demo-smoke workflows pass on GitHub.
- [x] Public GitHub repository, milestones, labels, and 17 issues created.
- [ ] GitHub Projects v2 board created (token needs `project` and `read:project` scopes; non-blocking).
- [x] Internal planning workspace synchronized separately from the public repository.

## M1 — Deterministic scan

- [x] Safe real vulnerability selected and documented.
- [x] Bundled demo repository and safe reset script created.
- [x] OSV-Scanner setup and subprocess adapter implemented.
- [x] Scanner output normalized and schema validated.
- [x] Expected finding displayed in the web UI.
- [x] Clean-reset acceptance test passes.

**Gate passed 2026-07-18:** M2 may begin only as a separate issue after this M1 result is committed.

## M2 — Investigation

- [x] Advisory facts normalize with an explicitly labeled cached fallback.
- [x] Exact file/line evidence appears.
- [x] Structured assessment validates.
- [x] Uncertainty is visible.

**Acceptance passed 2026-07-18:** strict assessment and citation validation, deterministic fallback, live-model integration path, CLI pipeline, and browser investigation view all pass. M3 remains gated behind its own issue and explicit human approval flow.

## M3 — Patch and verification

- [x] Complete remediation plan and exact-plan approval/cancel gate work.
- [x] Isolated Git branch/worktree flow works.
- [x] Approved dependency update changes only the manifest and lockfile.
- [x] Meaningful non-lockfile compatibility change occurs.
- [x] One safe targeted regression test is generated and passes.
- [x] Baseline and post-patch full tests and build pass.
- [x] Selected finding disappears on rescan.
- [x] Markdown and JSON evidence reports preserve the complete accepted chain.

## M4 — Demo quality

- [x] Final report screen and download/copy handoff controls complete.
- [x] Verified local patch commit and accurate draft-PR copy complete; remote publication remains approval-locked.
- [x] Judge-ready README, architecture/security/testing docs, real UI screenshots, and clean-clone instructions complete.
- [x] Three-minute demo script, rehearsal evidence, and fallback plan complete.
- [x] Full demo succeeds three consecutive times without manual repair.

**M4 passed 2026-07-18:** the 2:55 storyboard covers the complete golden path and AI contribution; three independent reset-to-handoff browser runs passed in 12.87s, 13.58s, and 13.43s with clean logs and no manual repair.

## M5 — Submission

- [x] Sub-three-minute review MP4 rendered, technically verified, and uploaded to YouTube as an unlisted review link; public visibility remains approval-gated.
- [ ] Accessible repository, video, Devpost copy, built-with list, `/feedback` reference, and testing instructions complete.
- [ ] Submission completed before 2026-07-21 20:00 Europe/Vienna internal freeze.
