# PatchPilot contributor guidance

- Optimize for the deterministic golden path: detect, investigate, approve, patch, test, rescan, report.
- Work one issue at a time. Restate acceptance criteria, implement the smallest sufficient change, test it, update docs, and commit it.
- Do not begin AI affectedness work until Milestone 1 passes from a clean demo reset.
- Do not add package ecosystems, autonomous merging, monitoring, SBOMs, dashboards, or other stop-rule features during the golden-path build.
- Treat OSV/test/build output as deterministic facts; label model output as interpretation and retain uncertainty.
- Require explicit human approval before repository writes in the product workflow.
- Record meaningful work, failures, decisions, and scope changes in `docs/build-journal.md`.

