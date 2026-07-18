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
- [ ] Meaningful non-lockfile compatibility change occurs.
- [ ] Targeted/full tests and build pass.
- [ ] Selected finding disappears on rescan.

## M4 — Demo quality

- [ ] Report, polished UI, README, screenshots, and fallback plan complete.
- [ ] Full demo succeeds three consecutive times without manual repair.

## M5 — Submission

- [ ] Accessible repository, video, Devpost copy, built-with list, `/feedback` reference, and testing instructions complete.
- [ ] Submission completed before 2026-07-21 20:00 Europe/Vienna internal freeze.
