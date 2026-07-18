# Hackathon control document

## Product promise

Investigate one known npm dependency vulnerability against the actual repository, create the smallest human-approved patch, and prove the result with tests and a rescan.

## Judging alignment

- **Technological implementation:** deterministic OSV integration, structured GPT-5.6 reasoning after M1, controlled edits, real test and rescan evidence.
- **Design:** one coherent finding-to-report workflow.
- **Potential impact:** reduces the evidence and repair gap after a scanner alert.
- **Idea quality:** repository-specific evidence, adaptive repair, targeted tests, and visible uncertainty—not another scanner or blind version bot.

## Scope and cut list

The MVP is Node.js 20+, npm, local Git, one bundled direct vulnerability, OSV-Scanner, explicit approval, verification, and a report. GitHub PR creation, hosted deployment, chat, multi-advisory support, Dependabot ingestion, and advanced dashboards are cut before any golden-path requirement.

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

## Submission checklist

See `docs/milestones.md` for the active checklist. Repository access, clean-clone instructions, license, repeatable reset, three rehearsals, green CI, public sub-three-minute video, Devpost copy, repository/video links, `/feedback` reference, built-with list, acknowledgements, limitations, and pre-deadline submission are mandatory.
