# GitHub issue plan

GitHub CLI is unavailable in the initial environment. These issue-ready definitions are the local source until they can be created remotely.

## 1. Bootstrap monorepo and CI

- **User value:** contributors can install, test, and build predictably.
- **Scope:** npm workspaces, TypeScript, React/Vite, Vitest, CI, docs skeleton.
- **Acceptance:** clean install, typecheck, unit tests, and build pass; definition of done is visible.
- **Dependencies:** none.
- **Demo relevance:** makes the judged workflow reproducible.
- **Non-goals:** product features and deployment.

## 2. Add bundled vulnerable demo repository

- **User value:** judges get a predictable, safe project.
- **Scope:** small npm app, direct vulnerable dependency, tests, reset state.
- **Acceptance:** clean reset and baseline tests are deterministic; dependency is installable and has a fixed release.
- **Dependencies:** #1.
- **Demo relevance:** required foundation for every golden-path scene.
- **Non-goals:** multiple fixtures or exploit payloads.

## 3. Wrap OSV-Scanner and normalize output

- **User value:** a real scanner finding becomes stable application data.
- **Scope:** bounded subprocess, JSON capture, Zod schema, expected-finding selection.
- **Acceptance:** clean reset reliably returns the expected normalized finding and malformed output fails clearly.
- **Dependencies:** #2.
- **Demo relevance:** first visible product success.
- **Non-goals:** other scanners, ecosystems, or remediation.

## 4. Normalize advisory data and add cached fallback

- **User value:** demo facts remain available if enrichment is unavailable.
- **Scope:** normalized OSV fields and checked-in cached advisory.
- **Acceptance:** summary, ranges, fixes, references, and conditions load identically from live and cached inputs.
- **Dependencies:** #3.
- **Demo relevance:** makes investigation reliable.
- **Non-goals:** custom vulnerability database or broad enrichment.

## 5. Collect repository evidence with file and line references

- **User value:** developers see where the advisory condition meets their code.
- **Scope:** bounded import/symbol/config search and evidence excerpts.
- **Acceptance:** exact expected demo call site and valid lines are returned.
- **Dependencies:** #4.
- **Demo relevance:** central differentiator.
- **Non-goals:** taint analysis or proof of exploitability.

## 6. Implement structured affectedness assessment

- **User value:** evidence is summarized with visible uncertainty.
- **Scope:** GPT-5.6 structured output, validation, deterministic fixture tests.
- **Acceptance:** schema-valid verdict cites evidence and never equates absence with not affected.
- **Dependencies:** #5 and M1 gate.
- **Demo relevance:** meaningful model use.
- **Non-goals:** vulnerability fact generation or general chat.

## 7. Build remediation approval UI

- **User value:** humans retain control before writes.
- **Scope:** target, files, risks, commands, tests, approve/cancel.
- **Acceptance:** no patch action can start without explicit recorded approval.
- **Dependencies:** #6.
- **Demo relevance:** visible safety boundary.
- **Non-goals:** policy engines or unattended approval.

## 8. Implement isolated Git branch/worktree flow

- **User value:** remediation does not disturb the source checkout.
- **Scope:** clean-tree validation, short-lived branch/worktree, audit log.
- **Acceptance:** dirty input is rejected and successful runs are isolated.
- **Dependencies:** #7.
- **Demo relevance:** trustworthy execution.
- **Non-goals:** multi-repository orchestration.

## 9. Apply npm dependency update

- **User value:** selected finding receives the minimal fixed dependency.
- **Scope:** approved package/version update inside isolation.
- **Acceptance:** manifest/lockfile reach the planned version and unrelated dependencies stay unchanged.
- **Dependencies:** #8.
- **Demo relevance:** visible remediation.
- **Non-goals:** generic package-manager abstraction.

## 10. Add compatibility repair loop

- **User value:** small upgrade breaks can be repaired safely.
- **Scope:** classify relevant failures, maximum two minimal repair attempts.
- **Acceptance:** demo compatibility change succeeds; the loop stops honestly after two failures.
- **Dependencies:** #9.
- **Demo relevance:** differentiates from version-bump bots.
- **Non-goals:** unbounded autonomy or unrelated refactors.

## 11. Add targeted regression test generation

- **User value:** the repaired behavior gains focused evidence.
- **Scope:** propose/add one safe demo regression test.
- **Acceptance:** test fails for the unsafe condition or validates mitigation and passes after patch.
- **Dependencies:** #10.
- **Demo relevance:** proves effectiveness beyond scanning.
- **Non-goals:** broad test generation.

## 12. Run baseline and post-patch verification

- **User value:** before/after command facts are reviewable.
- **Scope:** install, target test, full test, build, optional lint, rescan with timeouts/log bounds.
- **Acceptance:** exit codes/durations/summaries persist and the selected advisory disappears.
- **Dependencies:** #11.
- **Demo relevance:** closes the proof loop.
- **Non-goals:** production deployment.

## 13. Generate Markdown/JSON evidence report

- **User value:** reviewers receive a durable audit artifact.
- **Scope:** facts, interpretation, approval, diff, commands, rescan, unknowns.
- **Acceptance:** both formats contain all required sections and valid evidence references.
- **Dependencies:** #12.
- **Demo relevance:** final golden-path scene.
- **Non-goals:** compliance certification.

## 14. Add optional GitHub draft PR creation

- **User value:** verified work can be handed to maintainers.
- **Scope:** local commit and PR-ready title/body; draft creation only with approval.
- **Acceptance:** local commit and accurate PR copy exist; push is never automatic.
- **Dependencies:** #13 and authenticated `gh`.
- **Demo relevance:** optional polish and first cut if behind.
- **Non-goals:** auto-merge or custom GitHub App.

## 15. Write README and architecture docs

- **User value:** judges can understand and reproduce the project.
- **Scope:** all required README, architecture, security, testing, and limitations sections.
- **Acceptance:** instructions pass from a clean clone and diagrams match behavior.
- **Dependencies:** #13.
- **Demo relevance:** submission requirement.
- **Non-goals:** production operations manual.

## 16. Create three-minute demo script

- **User value:** the value chain is clear under the time limit.
- **Scope:** exact clicks, narration, expected states, reset, fallback assets.
- **Acceptance:** three consecutive sub-three-minute rehearsals succeed without repair.
- **Dependencies:** #13 and #15.
- **Demo relevance:** submission-critical.
- **Non-goals:** long-form tutorial.

## 17. Record submission assets and finalize Devpost entry

- **User value:** judges receive a complete, honest submission.
- **Scope:** video, screenshots, copy, links, built-with, `/feedback`, acknowledgements.
- **Acceptance:** final checklist is complete before the internal freeze.
- **Dependencies:** #16.
- **Demo relevance:** ships the project.
- **Non-goals:** new product features.

