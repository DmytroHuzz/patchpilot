# Security model

PatchPilot is a hackathon evidence and remediation aid for one bundled repository. Its safety model is defense in depth around a narrow deterministic workflow; it is not a sandbox, production security control, exploitability oracle, or guarantee that a repository is secure.

## Security goals

- Keep all product repository writes inside a separately created local worktree.
- Require a human decision on the complete exact remediation plan before patch writes.
- Prevent model output from selecting arbitrary files, versions, commands, or evidence.
- Make deterministic command facts visually and structurally distinct from model interpretation.
- Stop honestly on invalid state, changed evidence, failed commands, or a continued advisory.
- Retain only bounded, redacted, owner-local command and report artifacts.
- Perform no automatic push, pull request, merge, deployment, or production action.

## Non-goals

- Proving exploitability, non-exploitability, compliance, or overall security.
- Containing a malicious repository as a hardened OS-level sandbox.
- Detecting every secret format or every dangerous package lifecycle behavior.
- Supporting arbitrary repositories, commands, advisories, ecosystems, or production credentials.
- Protecting ignored local `runs/` artifacts from a user or process that already controls the machine.

## Commands that may execute

Commands are constructed as executable/argument arrays and invoked without a shell. Model strings are never executed directly.

| Stage | Executable command family | Purpose and constraint |
| --- | --- | --- |
| Scan | `osv-scanner --version`; `osv-scanner scan source ...` | Fixed JSON scan arguments, timeout and output cap |
| Isolation/checkpoints | Read-only `git status`, `rev-parse`, `branch`, `diff`, `diff-tree`, `worktree list` | Validate source/worktree state and retained diffs |
| Isolation | `git worktree add -b patchpilot/run-* ...` | Creates one boundary-contained local branch/worktree after approval |
| Dependency | `npm install json5@1.0.2 --save-exact` | Exact package/version/arguments inside isolated repository only |
| Repair probe | `node --check src/theme.js` | Syntax check for the one allowed source replacement |
| Targeted test | `node --test test/theme.test.js` | Runs the one approved benign test file |
| Verification | `npm ci --ignore-scripts`, `npm test`, `npm run build` | Fixed baseline/post-patch commands; install lifecycle scripts disabled |
| Handoff | `git add` for four exact files; `git commit` with fixed message | Local commit only; hooks/signing disabled for deterministic demo behavior |

The UI remediation plan displays proposed commands before approval. Later executors independently require the fixed expected commands; display is not treated as authorization for arbitrary text.

## Repository and path restrictions

- The server target is fixed to `demo/vulnerable-node-app`; arbitrary local paths are not accepted by the UI or API.
- Existing project, Git root, worktree, and repository paths are canonicalized with `realpath` to expose symlink aliases.
- New worktree and audit paths are resolved inside the configured project boundary before creation and checked against canonical parents after creation.
- Repository-relative file validation rejects absolute paths and traversal outside the selected repository.
- The evidence collector skips symlinks, dependency directories, Git data, build output, lockfiles, oversized files, and unsupported file types.
- The complete source Git worktree, including untracked files, must be clean before isolation. Dirty state fails before branch or run-storage creation.
- Every mutation stage requires the source checkout to remain clean and the isolated branch/baseline to match the recorded run.

These checks reduce accidental or model-driven scope escape. They do not turn arbitrary untrusted code execution into a secure sandbox; the bundled fixture is the only supported target.

## Human approval boundary

The remediation planner may only select supplied fixed versions, allowlisted files, and allowlisted displayed commands. After validation, PatchPilot hashes the canonical plan into `plan-<sha256>`.

The user sees target version, strategy, files, compatibility risks, commands, and verification intent before choosing:

- **Approve:** binds a timestamped decision to that exact plan ID.
- **Cancel:** records a terminal cancellation; it cannot later become approval.

Isolation revalidates the exact approved object before its first possible write. Missing, awaiting, cancelled, tampered, mismatched, or expired in-memory proposals fail closed. A server restart clears approval state.

The later local commit is within the already approved four-file patch. Remote publication would require a separate explicit approval and configured target, but this build exposes no remote-publication endpoint.

## Model trust boundary

GPT‑5.6 receives stage-specific bounded context, not raw repository access. Context builders omit absolute paths, arbitrary scanner output, full logs, unrelated files, and proof-of-concept advisory sections.

All model responses use strict Structured Outputs plus semantic validation:

- assessments cite known evidence IDs and cannot use absence as positive affectedness evidence;
- plans use supplied versions/files/commands and always require approval;
- repairs replace one exact function and cannot add imports, dependencies, commands, dynamic execution, or broad object spreads;
- tests add one benign block and reject prototype-related keys, exploit payloads, process/network access, and multiple tests.

Model output is always interpretation or a proposal. OSV, Git, npm, Node, test, and build output remain deterministic authority.

## Exact mutation checkpoints

PatchPilot revalidates the accumulated state between stages:

1. dependency stage: exactly `package.json` and `package-lock.json`, with only json5 changed structurally;
2. repair stage: those two files plus `src/theme.js`, whose retained diff must match the recorded replacement;
3. test stage: those three files plus `test/theme.test.js`, containing exactly one allowed new test;
4. verification: the exact four-file diff must match before and after all commands;
5. handoff: the local commit must have the verified baseline as direct parent and contain exactly those four files.

Unexpected files, mismatched bytes, moved HEAD/branch, dirty source state, invalid model output, or failed commands stop the workflow. Failed repair/test mutation paths restore the current source/test file where designed. Repair attempts are capped at two.

## Timeouts and output bounds

Each subprocess has a stage-appropriate timeout and buffer cap. Retained outputs are smaller than process buffers and include a truncation indicator when capped. The scanner adapter, Git helpers, npm runner, syntax probe, targeted test, and full verification all avoid shell interpolation.

Timeouts prevent a demo command from hanging indefinitely; they are not resource-isolation controls for hostile code.

## Log redaction

Before command output or relevant failure lines are retained, PatchPilot redacts likely:

- bearer/authorization values;
- GitHub, npm, OpenAI, and common token-shaped values;
- credential-bearing registry or HTTPS URLs;
- absolute source/worktree paths in the model-facing repair context.

Outputs are then length-bounded. Redaction is best effort and pattern-based; it cannot guarantee detection of every secret. The bundled demo contains no secrets, and production repositories are explicitly unsupported.

## Verification claims

Green verification means only that, for the accepted golden run:

- baseline install/tests/build passed;
- patched install, targeted test, full tests, and build passed;
- the selected advisory was absent from the normalized lockfile rescan;
- the exact approved four-file diff remained intact;
- the source checkout stayed clean.

It does **not** prove that input is attacker-controlled, that the vulnerability was exploitable, that all deployments behave the same way, that every vulnerability is absent, or that the patch is production-ready.

## Remote and supply-chain boundary

- `setup-osv-scanner.sh` downloads only the pinned official OSV-Scanner `2.3.8` asset selected for the platform and verifies it against the upstream SHA-256 manifest.
- npm and OSV live operations require network access and therefore inherit upstream registry/service availability and trust.
- Live GPT‑5.6 calls occur only when `OPENAI_API_KEY` is present and use `store: false`; otherwise explicit checked-in fixtures are used.
- The nested demo repository has no remote. Handoff state is fixed to `not_requested` and no push/PR/merge path exists.
- Dependency installation in verification uses `--ignore-scripts`; the approved dependency mutation uses `npm install ... --save-exact` against the known bundled fixture.

## Residual risks

- A compromised local executable named by an override such as `OSV_SCANNER_PATH` runs with the current user’s permissions.
- `npm test` and `npm run build` execute code from the bundled repository and its dependencies.
- In-memory state is not durable, authenticated, or multi-user.
- Ignored worktrees and reports may persist after a crash or interrupted demo.
- Pattern-based redaction and bounded static evidence are incomplete by design.
- Hard-coded golden contracts do not safely generalize to another repository.

See [Architecture](architecture.md), [Testing strategy](testing-strategy.md), and [Known limitations](limitations.md).
