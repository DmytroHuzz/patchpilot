# Build journal

## 2026-07-18 — Project control and specification pass

- Read the complete 1,560-line technical specification before implementation.
- Established the narrow promise and enforced the M1 gate: no AI affectedness work before deterministic scan acceptance.
- Verified Node.js 22.23.1, npm 10.9.8, and an empty Git repository on `main`.
- Found `osv-scanner` and `gh` unavailable locally; scanner bootstrapping is part of M1, while remote GitHub setup is non-blocking.
- Preserved the main Codex task/session ID: `019f7422-123d-7242-a0cf-c7f6f237594b`.
- Created the workspace skeleton, local GitHub issue plan, milestone checklist, and documentation placeholders.
- Initial workspace check exposed Vitest's expected no-tests failure; added a contract smoke test and limited `--passWithNoTests` to feature workspaces that have not received tests yet.
- Scope expansions: none.

## 2026-07-18 — Issue 2: golden demo fixture

- Acceptance target: deterministic reset, installable direct vulnerability, relevant safe API use, fast passing baseline tests, fewer than 15 source files.
- Compared live OSV records for several npm candidates. Selected `json5@1.0.1` because it currently yields exactly one advisory (`GHSA-9c47-m6qq-7p4h`) and has clear fixed versions.
- Designed a tiny CLI that passes user-provided theme configuration to `JSON5.parse`; no exploit payload is stored or executed.
- The later meaningful source change will validate and copy a narrow theme schema at the input boundary alongside the dependency update. This satisfies the existing golden-demo requirement and is not a scope expansion.
- Scope expansions: none.

## 2026-07-18 — Issue 3: OSV adapter, normalization, and findings UI

- Acceptance target: reproducible scanner setup, bounded JSON subprocess, strict normalization, exact live finding, and visible findings screen.
- Pinned official OSV-Scanner 2.3.8 binaries for supported macOS/Linux architectures and verified downloads against the release SHA-256 file.
- Confirmed OSV-Scanner uses exit code 1 when findings exist; the adapter accepts it only with parseable JSON and treats other failures honestly.
- Added Zod contracts, raw-field validation, normalized range/fix/reference extraction, and malformed-output tests.
- Clean reset plus live scan returned exactly `GHSA-9c47-m6qq-7p4h` in direct dependency `json5@1.0.1`.
- Verified the UI through the real browser click path: the expected heading and all deterministic fact fields rendered from the live endpoint.
- Milestone 1 acceptance passed. No OpenAI API call, affectedness prompt, or AI analysis was added.
- Scope expansions: none.

## 2026-07-18 — Project control synchronization

- Published the clean `main` history to the public repository: https://github.com/DmytroHuzz/patchpilot.
- Enabled GitHub Issues and Dependabot vulnerability alerts; both CI and demo-smoke workflows passed on the initial push.
- Created milestones M1–M5, demo/priority labels, and all 17 issue-ready work items with user value, scope, acceptance criteria, dependencies, demo relevance, and explicit non-goals.
- Closed GitHub issues 1–3 with Milestone 1 verification comments. Issue 4 is the next Ready item; no M2 code began during this synchronization.
- GitHub Projects v2 creation remains pending because the authenticated CLI token lacks the separate `project` and `read:project` scopes.
- Scope expansions: none. This work completes the project-control deliverables already required by the specification.

## 2026-07-18 — Public/private planning boundary correction

- Removed internal planning-tool names, links, synchronization details, and mirror artifacts from the public repository.
- Rewrote the affected GitHub issue comment so public project communication covers GitHub state only.
- Kept the internal planning workspace and its data unchanged.
- Scope expansions: none.

## 2026-07-18 — Issue 4: advisory normalization and cached fallback

- Acceptance target: complete normalized OSV facts, deterministic cached parity, explicit fallback provenance, and network-independent contract tests.
- Added a dedicated advisory contract and reused its normalizer from the live OSV finding path.
- Added a checked-in golden advisory labeled `cached-demo`; the resolver uses it only when matching live input is absent or invalid.
- Excluded proof-of-concept sections from normalized details before later model context construction.
- Added tests for live/cached semantic parity, provenance, malformed-live fallback, and unsafe cache IDs.
- No repository evidence collection, model prompt, or affectedness assessment was added.
- Scope expansions: none.

## 2026-07-18 — Issue 5: bounded repository evidence

- Acceptance target: exact JSON5 import/call evidence, repository-relative file/line excerpts, bounded collection, and safe absence language.
- Added strict evidence item/bundle contracts and a read-only collector with file-count, file-size, total-byte, evidence-count, and excerpt-context limits.
- The first focused test exposed backticked advisory syntax around `parse`; expanded the deterministic parser to recognize that exact form and retained the test as a regression guard.
- Golden evidence identifies `src/theme.js:1` and `src/theme.js:8–10`, including the `JSON5.parse(rawTheme)` call.
- Added explicit absence evidence for `__proto__` that states absence is not proof of non-applicability.
- Added a demo integration command that writes a validated evidence artifact and fails when the expected call site is missing.
- No model call or affectedness verdict was added.
- Scope expansions: none.

## 2026-07-18 — Issue 6: structured affectedness assessment

- Acceptance target: strict GPT‑5.6 Structured Output, citations limited to collected evidence IDs, visible unknowns/limitations, safe absence semantics, and a clear facts/evidence/interpretation UI boundary.
- Added the current OpenAI JavaScript SDK and verified the Responses API `parse` contract with Zod-backed text formatting against the installed type definitions.
- The live path targets explicit model alias `gpt-5.6`, uses medium reasoning effort, disables response storage, and sends only normalized advisory, package relationship, repository metadata, and bounded evidence.
- Added post-schema guards for invented or duplicate evidence IDs, absence used as supporting evidence, unsupported not-affected prose, and verdicts that contradict deterministic call-site evidence.
- No `OPENAI_API_KEY` was available during acceptance. Added an explicitly labeled checked-in contract fixture; it runs through the same schema and citation validators and the UI never labels it live.
- `npm run check` passed 20 tests and all production builds. `npm run investigate:demo` passed from live OSV detection through the validated cached assessment.
- Browser verification passed the scan → investigate click path. The three evidence items, likely-affected/medium interpretation, citations, unknowns, limitations, recommended checks, and fallback provenance rendered with no console errors.
- No repository write occurs in the investigation path. No patch, approval, rescan-after-change, or report work began.
- Scope expansions: none.

## 2026-07-18 — Issue 7: remediation approval gate

- Acceptance target: display the full target/files/risks/commands/tests plan before a decision, require explicit approval for the exact plan before future writes, and prove cancel leaves the repository unchanged.
- Added a strict GPT‑5.6 `RemediationPlan` contract and a bounded context containing only the finding, assessment, package metadata, evidence-backed excerpts, test structure, allowed files, and allowed commands.
- Added validation that rejects unsupplied target versions, unsafe or invented paths, non-allowlisted commands, and a combined strategy without an evidence-backed source file.
- No `OPENAI_API_KEY` was available. The explicitly labeled cached plan targets `json5@1.0.2`, names four allowed files, includes a source-level input-boundary hardening step, lists compatibility risks, and proposes only four allowlisted commands.
- Bound approval to a SHA-256 ID of the exact plan. Missing, awaiting, cancelled, tampered, and already-decided proposals fail closed; cancellation is terminal.
- The first full check caught a duplicate variable name in the web request helper. Renamed the response value and retained the full typecheck as the regression check.
- `npm run check` passed 29 tests and all builds. `npm run plan:demo` passed from live OSV detection through an `awaiting_approval` proposal.
- Browser verification passed both decisions: cancel left the demo repository unchanged; approval recorded the exact plan and timestamp while explicitly stating no patch began. Browser logs were clean.
- No worktree, dependency update, source edit, test generation, or other patch action was implemented.
- Scope expansions: none.

## 2026-07-18 — Issue 8: isolated Git branch/worktree flow

- Acceptance target: reject dirty input clearly, create a dedicated branch/worktree only after exact approval, keep source/worktree/audit paths within validated boundaries, and leave the source checkout unchanged.
- Added a strict isolation-run contract containing approval, clean-state fact, baseline commit, source and isolated branches, canonical paths, and six ordered audit events.
- The executor checks approval before filesystem mutation, canonicalizes existing paths, validates new run roots, invokes Git without a shell under timeout/output limits, and verifies the created worktree's branch and baseline before returning ready.
- Real temporary-Git tests prove awaiting approval fails before run storage exists, dirty untracked input creates no branch or directories, traversal and out-of-bound storage fail, and isolated writes do not appear in the source checkout.
- The first focused test command used a repository-relative filter from the workspace package and matched no tests; reran it with the package-relative path. The real test then exposed macOS's `/var` to `/private/var` canonical alias. Updated boundary comparison to canonicalize both existing paths and retained the regression coverage.
- Added the approved-plan isolation API and a fourth demo stage showing clean-source status, baseline, local branch, bounded paths, ordered audit events, and an explicit no-patch state.
- `npm run check` passed 34 tests across server and contracts plus all production builds. The clean-reset baseline tests/build and live OSV scan also passed.
- Browser acceptance passed the full detect → investigate → approve → isolate click path. The final view showed the clean source, exact baseline, unique branch, bounded paths, all six audit events, and explicit no-patch state with no browser log errors.
- The accepted run left its ignored audit artifact and separate worktree ready for the next patch issue; the bundled source checkout remained clean on `main` at its original commit.
- No dependency update, source edit, automatic push, merge, multi-repository flow, or new AI work was added.
- Scope expansions: none.

## 2026-07-18 — Issue 9: approved npm dependency update

- Acceptance target: move json5 to the exact planned version in both manifest and lockfile, keep unrelated dependencies unchanged, preserve the dependency diff, and leave the source checkout untouched.
- Added a strict dependency-update result contract with run/plan identity, exact command result, before/after version proof, two-file boundary, unrelated-change fact, complete bounded diff, source-clean fact, and ignored result artifact.
- The executor revalidates approval, isolation ID, branch, baseline, canonical paths, clean worktree, clean source checkout, and the exact displayed npm command before execution.
- Before/after parsed JSON comparison removes only the json5 entries and requires every other manifest/lockfile value to remain structurally identical. Git must report exactly `package.json` and `package-lock.json`.
- Git and npm run without a shell under timeout/output limits. Likely npm/GitHub/OpenAI tokens and credentialed registry URLs are redacted before bounded command output or failure text is retained.
- Real temporary-Git tests prove exact command/cwd execution, source preservation, approval failure before command invocation, unrelated lockfile rejection, source-file rejection, version proof, and persisted diff.
- A live registry run in the Issue #8 worktree changed json5 1.0.1 → 1.0.2 in both files, retained minimist 1.2.8, changed exactly two files, wrote the result artifact, and left the source checkout clean.
- `npm run check` passed 39 tests across server and contracts plus all production builds. Clean-reset baseline tests/build and the live vulnerable OSV scan also passed.
- Browser acceptance passed detect → investigate → approve → isolate → update. It displayed the exact command with exit 0, version proof, two changed files, zero unrelated changes, complete diff, clean-source badge, and next-step boundary with no browser log errors.
- No compatibility source repair, regression test generation, post-patch test/build, rescan, branch commit, push, merge, other ecosystem, or new AI work was added.
- Scope expansions: none.

## 2026-07-18 — Issue 10: bounded compatibility repair loop

- Acceptance target: apply the golden source/configuration change inside the approved isolated branch, send only relevant bounded evidence to a repair attempt, and stop honestly after at most two failures.
- Added strict repair proposal, attempt, syntax-probe, request, and result contracts. Successful results require the exact three-file diff; stopped or exhausted results require a restored source and the dependency-only diff.
- GPT‑5.6 receives six bounded groups: attempt, approved plan facts, dependency-update facts, the exact extracted `parseUserTheme` function, an optional filtered previous syntax failure, and fixed constraints. The explicit cached fixture uses the same schema and semantic validator.
- The validator allows only one exact `src/theme.js` function replacement, preserves the signature and JSON5 parse, requires narrow `accent`/`density` copying with defaults, and rejects stale text, broad object spreads, imports, commands, dependency changes, and dynamic execution.
- The executor revalidates approval/run identity, branch, baseline, canonical boundaries, source cleanliness, the exact dependency-only checkpoint, and the recorded dependency diff. It runs only `node --check src/theme.js`, permits two attempts, supplies only bounded/redacted relevant syntax lines on retry, and restores the original source after exhaustion or mutation-time exceptions.
- Real temporary-Git tests cover a one-attempt passing repair and two failing attempts with source restoration. A strict contract regression test rejects an exhausted result that claims a retained source-file change.
- The first live acceptance command used top-level `await` with `tsx -e`, whose CommonJS eval mode rejected it before any write. Wrapping the same runner in an async function succeeded.
- Live acceptance on `run-895a4677-425f-4081-b517-0661aae85aae` applied the cached golden repair in one attempt, passed the real syntax probe, retained exactly `package-lock.json`, `package.json`, and `src/theme.js`, wrote the ignored result artifact, and left the bundled source checkout clean on `main`.
- Final review tightened action/classification pairing, rejected replacement text with appended code, validated cached-result plan identity, and made the stopped UI distinguish honest evidence stops from two-attempt exhaustion. A dedicated stop-path test proves no syntax probe or source write occurs for an unrelated failure classification.
- `npm run check` passed 47 tests across server and contracts plus all production builds. Clean-reset baseline tests/build and the live vulnerable OSV scan also passed; public repository files contain no internal-planning references.
- Browser acceptance passed detect → investigate → approve → isolate → update → repair. The final panel visibly showed cached-contract provenance, attempt 1/2, passing syntax, clean source checkout, exact source diff, compatibility risk, remaining unknown, and the no-full-verification boundary with no browser warnings or errors.
- The accepted browser run `run-3372aa96-f05a-4f1b-9d2d-21644a7fb5b3` remains in its isolated three-file state for Issue #11. Targeted test generation, full patched-repository verification, rescan, branch commit/push, merge, and reporting did not run.
- Scope expansions: none.

## 2026-07-18 — Issue 11: targeted regression-test generation

- Acceptance target: add exactly one focused security regression test, use no weaponized behavior, pass it after the approved patch, retain the four-file review diff, and leave the source checkout clean.
- Added strict proposal, command-result, request, and terminal-result contracts. Passing results require the retained four-file diff; failed commands require test restoration and the prior three-file checkpoint; stopped generation cannot write or execute.
- GPT‑5.6 receives six bounded groups: approved verification intent, dependency facts, repair status, the exact repaired function, the existing test file, and fixed constraints. The explicit cached fixture uses the same schema and validator.
- The validator permits one `it(...)` block in `test/theme.test.js`, requires benign `previewLabel: ignored` input plus supported-field and absence assertions, and rejects prototype-related keys, weaponized behavior, imports, commands, process/network access, and multiple tests.
- The executor revalidates the exact approval/run chain, branch, baseline, canonical boundaries, source cleanliness, three-file checkpoint, and recorded dependency/source diffs. It runs only `node --test test/theme.test.js`, retains the test on exit 0, and restores it after failure or a mutation-time exception.
- Real temporary-Git tests cover a retained passing test and failed-command restoration. The first focused model test expected a less-specific validation message; the stricter exactly-one-test guard fired first, so the assertion was corrected.
- The first two live attempts stopped before writes because the bundled test file ends with two trailing newlines, while the insertion helper initially accepted one or none. The helper now preserves any trailing newlines, with regression coverage for zero, one, and two.
- Live acceptance on `run-3372aa96-f05a-4f1b-9d2d-21644a7fb5b3` passed the real targeted command with exit 0, added only the ten-line benign test, retained exactly four changed files, wrote the ignored result artifact, and left the source checkout clean.
- `npm run check` passed 53 tests across server and contracts plus all production builds. Clean-reset baseline tests/build and the live vulnerable OSV scan also passed; public repository files contain no internal-planning references.
- Browser acceptance passed detect → investigate → approve → isolate → update → repair → test on the preserved accepted run `run-6098eda8-bc2e-440b-98ca-09689f64a806`. The final panel visibly showed exactly one benign test, its passing targeted command and complete output, the retained test diff, clean source checkout, safety rationale, remaining unknown, and the explicit full-verification boundary with no product error state.
- No full patched-repository suite/build, rescan, report, branch commit/push, merge, other ecosystem, or general test generation was added.
- Scope expansions: none.

## 2026-07-18 — Issue 12: baseline and post-patch verification

- Acceptance target: retain exact command exit codes, durations, and bounded summaries; pass baseline and post-patch tests/build; prove the selected advisory disappears; and classify failures honestly.
- Direct environment validation passed baseline install/tests/build and patched install/targeted/full tests/build without changing tracked source or patch files.
- The first rescan probe used a relative Git-worktree directory and the reserved zsh variable `status`; zsh rejected the assignment and OSV-Scanner reported no package sources. Canonical directory scans also failed because OSV-Scanner ignores the Git worktree root. A lockfile-scoped invocation succeeds with zero findings, so the implementation records that narrower actual command.
- Added strict command, failure, rescan, request, and terminal-result contracts. Verified results require all seven install/test/build commands, a selected-advisory-clean rescan, the exact four-file diff, and a clean source checkout.
- The executor revalidates the full approved result chain and patch bytes, runs fixed commands without a shell under timeout/output/redaction limits, stops on the first failure, and distinguishes command, scanner, and continued-advisory failures.
- The first focused typecheck exposed use of `.shape` after a Zod object refinement. Extracted the command enum into a reusable schema; the next typecheck passed.
- Real temporary-Git tests cover the eight-record success path, an early baseline-test stop, and a completed rescan where the selected advisory remains. A root-level focused test filter was forwarded to every workspace and failed in contracts with no matching file; package-scoped server and contract runs passed.
- `npm run check` passed 58 tests across server and contracts plus all production builds. Final review also tightened command-kind/phase matching, required the exact eight-command verified sequence, bound failure classifications to the terminal command fact, and added relative lockfile normalization coverage.
- Live acceptance on `run-6098eda8-bc2e-440b-98ca-09689f64a806` retained eight exit-0 command facts: three baseline commands, four post-patch commands, and the normalized OSV rescan. OSV-Scanner 2.3.8 returned zero findings, the selected advisory was absent, the four-file diff remained exact, and the source checkout stayed clean.
- Browser acceptance passed the full detect → investigate → approve → isolate → update → repair → test → verify path on `run-224b2bb8-1ef2-4e68-9192-464918976514`. The final panel visibly showed baseline/post-patch passes, exact command/exit/duration facts, zero normalized findings, selected-advisory absence, clean source state, and the report-only next boundary with no product error state.
- Scope expansions: none. Verification only; report generation and Git publication remain separate issues.

## 2026-07-18 — Issue 13: Markdown and JSON evidence report

- Acceptance target: preserve every required report section in both formats, validate evidence IDs and file/line references, and make deterministic facts visibly distinct from model interpretation and uncertainty.
- Added strict report, result, and request contracts. The report has separate deterministic-fact, model-interpretation, human-decision, uncertainty, and final-status groups and binds the selected finding, approved plan, exact four-file patch, eight verification commands, and normalized rescan to one plan/run identity.
- Generation fails closed unless every cited evidence ID exists and every positioned repository-relative file/line excerpt still matches the unchanged vulnerable source. Changed-file references must resolve inside the isolated repository.
- The Markdown renderer includes the original finding, evidence excerpts, affectedness assessment, approval, approved plan, dependency/source/test diffs, command table, rescan, remaining unknowns, limitations, next checks, disclaimer, and final status. The JSON artifact preserves the same semantics without absolute local paths.
- Added the session-bound report endpoint, ignored owner-only `.md`/`.json` artifacts, no-store attachment routes, final report screen, explicit trust-label cards, report preview, downloads, and copy control. Reporting performs no new model call or patch/publication write.
- The first focused test command used a root-relative filter from the server workspace and matched no tests; rerunning with the package-relative filter exposed a test-fixture path assumption. Corrected the fixture root, then both artifact-parity and tampered-citation tests passed.
- Browser testing exposed that programmatic Blob downloads did not emit a reliable browser download event. Replaced them with ordinary server-backed attachment links; both Markdown and JSON downloads then passed.
- Final `npm run check` passed 60 tests across server and contracts plus all production builds. Live browser acceptance completed the entire detect → investigate → approve → isolate → update → repair → test → verify → report path on `run-d1c551a1-e02c-4a88-a8c3-d580581369cb` with three valid evidence references, eight command facts, zero selected-advisory findings, both attachment downloads, and no browser warnings or errors.
- Scope expansions: none. Report generation and handoff controls only; Git commit/push/PR creation remain Issue #14.

## 2026-07-18 — Issue 14: optional GitHub draft-PR handoff

- Acceptance target: create a clearly messaged local patch commit, generate PR copy that accurately reports tests, limitations, model/Codex contribution, and evidence, and run no push or pull-request action without a separate explicit approval.
- The bundled nested demo repository intentionally has no remote. The smallest complete handoff therefore stops at a verified local commit and draft-PR copy, returns remote state `not_requested`, and visibly requires new approval plus target configuration before publication. No fake remote or product-demo PR was added.
- Added strict handoff request/result contracts binding the verified run and plan to one direct-baseline commit, exact `patchpilot/run-*` branch, four approved files, fixed clear message, PR-ready title/body, clean source fact, publication lock, and repository-relative audit path. Absolute local paths are rejected from PR copy.
- The executor revalidates the accepted report, human approval, selected-advisory absence, canonical source/worktree paths, branch, baseline HEAD, clean source checkout, and exact four-file worktree before staging. It stages only approved paths, disables hooks/signing, commits locally, and then verifies parent, branch, committed file set, and both clean worktrees.
- Draft-PR copy deterministically includes the json5 version change, exact files, approval, eight command facts, normalized OSV result, cached/live model provenance, a precise Codex contribution statement, retained limitations, report artifacts, and explicit no-publication language. An owner-only ignored JSON handoff artifact preserves the result.
- Real temporary-Git tests prove the successful commit/audit/copy path and that an unexpected fifth file prevents any commit. The first focused test command used a root-relative filter from the server workspace and matched no tests; rerunning with the package-relative path exposed leading-whitespace loss in porcelain status parsing and the macOS `/var` canonical alias for a not-yet-created result directory. Both were fixed with regression coverage.
- Final `npm run check` passed 62 tests across server and contracts plus all production builds. Clean-reset baseline tests/build and the live vulnerable OSV scan also passed.
- Browser acceptance completed all ten stages on `run-0f784d19-c07a-4d69-98f7-b7d999c3acd9`. The final UI showed local commit `8622bfab0981`, direct parent `d76259ff736e`, the fixed message, four exact files, full PR copy, successful copy-state feedback, and `LOCKED · NOT REQUESTED`; browser logs were clean.
- CLI inspection confirmed the source checkout remained clean on `main`, the isolated branch and worktree were clean, the commit contains exactly four files, the audit matches the UI, and the bundled repository has no remote. No push, pull-request, merge, deployment, or scope expansion occurred.
- Scope expansions: none.

## 2026-07-18 — Issue 15: judge-ready README and architecture documentation

- Acceptance target: verify clean-clone instructions, include every specification-required README section, and make diagrams and safety language match implemented behavior.
- Rewrote the README around the complete golden path with the product problem, two real UI screenshots, architecture, OSV reuse, PatchPilot additions, observed golden-run metrics, supported environment, installation, variables, exact demo clicks, testing, safety, limitations, hackathon context, Codex/GPT-5.6 roles, acknowledgements, and roadmap.
- Documented the implemented component graph, workflow state machine, trust boundaries, scanner adapter, bounded model context, approval/isolation flow, exact mutation checkpoints, verification, reporting, and local Git handoff.
- Expanded the security model with the exact executable/argument families, repository and path restrictions, approval semantics, output bounds/redaction, deterministic verification claims, and residual risks. The docs explicitly state that a clean rescan is not a general security guarantee.
- Added a documentation contract that requires the 20 README requirements, architecture/security sections, both screenshots, and valid local links. It runs first in `npm run check` and CI.
- Captured the actual 1280×720 investigation and local-handoff screens. The capture API produced JPEG bytes despite the initial PNG filenames; the assets and references were corrected to `.jpg` before acceptance.
- Arbitrary local-repository onboarding is honestly documented as unsupported because the server and mutation contracts are intentionally hard-wired to the bundled golden fixture. No product feature was added to disguise that boundary.
- Exact-snapshot clean-clone acceptance passed on candidate commit `c9367b524f08`: `npm ci`, the documentation contract, typechecks, all 62 tests, production builds, verified OSV-Scanner 2.3.8 setup, clean nested-fixture reset, baseline tests/build, and the live expected `GHSA-9c47-m6qq-7p4h` finding all passed.
- Public repository hygiene passed with no internal-planning tool references. The main Codex task ID remains recorded for the submission `/feedback` requirement.
- Scope expansions: none. Production operations, arbitrary repositories, publication, extra ecosystems, dashboards, monitoring, SBOMs, and submission/demo-script work remain out of this issue.
