# Hackathon control document

## Product promise

Investigate one known npm dependency vulnerability against the actual repository, create the smallest human-approved patch, and prove the result with tests and a rescan.

## Judging alignment

- **Technological implementation:** deterministic OSV integration, structured GPT-5.6 reasoning after M1, controlled edits, real test and rescan evidence.
- **Design:** one coherent finding-to-report workflow.
- **Potential impact:** reduces the evidence and repair gap after a scanner alert.
- **Idea quality:** repository-specific evidence, adaptive repair, targeted tests, and visible uncertainty—not another scanner or blind version bot.

## Scope and cut list

The MVP is Node.js 20+, npm, local Git, one bundled direct vulnerability, OSV-Scanner, bounded GPT‑5.6 interpretation/proposals, explicit approval, an isolated four-file patch, verification, report, and local Git handoff.

The following are cut from the submission path: arbitrary repository onboarding, remote GitHub PR creation, hosted deployment, chat, multi-advisory support, Dependabot ingestion, other ecosystems, monitoring, SBOMs, runtime exploitability, and dashboards. They may appear only as roadmap ideas.

## Deadlines

- Internal freeze: 2026-07-21 20:00 Europe/Vienna.
- Submission: 2026-07-22 02:00 Europe/Vienna.

## Codex implementation record

- Main task/session ID: `019f7422-123d-7242-a0cf-c7f6f237594b`
- Before submission, invoke `/feedback` from this main task and record the resulting reference in the Devpost draft.
- Public repository: https://github.com/DmytroHuzz/patchpilot
- GitHub issues: https://github.com/DmytroHuzz/patchpilot/issues
- GitHub Projects v2 board: pending a one-time `project` and `read:project` CLI scope grant.

## Definition of done

A judge can follow the README to reset the demo, detect the real vulnerability, inspect cited repository evidence and uncertainty, approve a dependency plus source/configuration patch, observe targeted and full tests, see a clean rescan, and inspect a final report explaining Codex and GPT-5.6 contributions.

## Demo plan

The recorded path is one continuous local UI story:

1. reset and launch the bundled repository;
2. detect `GHSA-9c47-m6qq-7p4h` in `json5@1.0.1`;
3. show exact import/call-site evidence, GPT‑5.6 interpretation, and uncertainty;
4. review and approve the exact four-file remediation plan;
5. show isolation, dependency update, bounded source repair, and one benign test;
6. show baseline/post-patch command facts and selected-advisory absence;
7. generate the evidence report and finish on the review-ready local commit/PR copy with remote publication locked.

Issue #16 owns the sub-three-minute narration, three consecutive rehearsals, and fallback screenshots. The demo uses checked-in model fixtures by default so OpenAI availability is not a recording dependency; scanner/test/build/Git actions remain real.

## Submission requirements

- Public judge-accessible repository with MIT license and verified clean-clone instructions.
- Public YouTube video under three minutes with audio explaining Codex and GPT‑5.6.
- Devpost Developer Tools entry with product description, repository and video links, built-with list, acknowledgements, and limitations.
- Main Codex task `/feedback` reference and retained task ID.
- Green CI, repeatable reset, three successful rehearsals, and final pre-deadline checklist.

## Submission checklist

See `docs/milestones.md` for the active checklist. Repository access, clean-clone instructions, license, repeatable reset, three rehearsals, green CI, public sub-three-minute video, Devpost copy, repository/video links, `/feedback` reference, built-with list, acknowledgements, limitations, and pre-deadline submission are mandatory.
