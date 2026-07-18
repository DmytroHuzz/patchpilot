# Milestone checklist

## M0 — Project control

- [x] Local repository initialized on `main`.
- [x] Workspace and documentation skeleton created.
- [x] Local issue plan and definition of done visible.
- [x] Build journal and main Codex task ID recorded.
- [ ] CI passes.
- [ ] GitHub repository/issues/project created (`gh` unavailable; non-blocking).
- [ ] Notion structure synchronized (connector unavailable; Markdown mirror created).

## M1 — Deterministic scan

- [x] Safe real vulnerability selected and documented.
- [x] Bundled demo repository and safe reset script created.
- [x] OSV-Scanner setup and subprocess adapter implemented.
- [x] Scanner output normalized and schema validated.
- [x] Expected finding displayed in the web UI.
- [x] Clean-reset acceptance test passes.

**Gate passed 2026-07-18:** M2 may begin only as a separate issue after this M1 result is committed.

## M2 — Investigation

- [ ] Exact file/line evidence appears.
- [ ] Structured assessment validates.
- [ ] Uncertainty is visible.

## M3 — Patch and verification

- [ ] Explicit approval and isolated Git flow work.
- [ ] Dependency and meaningful non-lockfile changes occur.
- [ ] Targeted/full tests and build pass.
- [ ] Selected finding disappears on rescan.

## M4 — Demo quality

- [ ] Report, polished UI, README, screenshots, and fallback plan complete.
- [ ] Full demo succeeds three consecutive times without manual repair.

## M5 — Submission

- [ ] Accessible repository, video, Devpost copy, built-with list, `/feedback` reference, and testing instructions complete.
- [ ] Submission completed before 2026-07-21 20:00 Europe/Vienna internal freeze.
