# Security model

PatchPilot will operate only inside a validated repository or isolated worktree, use allowlisted commands with timeouts and bounded output, redact likely secrets from logs, and require human approval before patch writes. It will never automatically merge or claim that static evidence proves security or exploitability.

## Implemented approval controls

- The complete remediation plan is displayed before approval, including files, commands, tests, and compatibility risks.
- Model-proposed versions, paths, and commands are validated against deterministic allowlists before display.
- The approval record references the digest of the exact plan. Any content change invalidates the gate.
- Cancelled plans remain blocked and cannot be changed to approved.
- The planning and decision endpoints record decisions only; they expose no patch action.

## Implemented isolation controls

- Isolation revalidates the exact approval before its first possible write.
- The complete source Git worktree, including untracked files, must be clean. Rejection happens before run storage or a branch is created.
- Existing repository paths are canonicalized to defeat symlink escapes. New worktree and audit paths are resolved inside configured boundaries and checked again after directory creation.
- Git commands use argument arrays rather than a shell and have a 10-second timeout and 1 MiB output cap.
- A unique local `patchpilot/run-*` branch is created at the recorded baseline in a separate worktree. The source checkout remains on its original branch and commit.
- Audit artifacts live in ignored run storage. No automatic push, merge, dependency update, or source edit occurs in Issue #8.

## Implemented dependency-mutation controls

- The exact plan approval, isolation run ID, branch, baseline, and clean state are revalidated before npm executes.
- The command is constructed from the fixed npm executable, fixed `install`/`--save-exact` arguments, literal json5 package, and approved target version. No shell or model-provided free-form command is used.
- Manifest and lockfile JSON are size-bounded and parsed before and after the command. All non-json5 dependency content must remain structurally unchanged.
- Git must report exactly the two approved dependency files. Source changes, extra files, unrelated dependency movement, mismatched versions, empty/oversized diffs, or a changed source checkout fail closed.
- Command output and the complete review diff are bounded and retained in ignored run storage. No automatic commit, push, merge, compatibility edit, test, or security claim occurs in Issue #9.

## Implemented compatibility-repair controls

- The exact approval, isolation identity, dependency result, branch, baseline, canonical paths, source-clean state, and recorded dependency diff are revalidated before a source write.
- Model context contains only the bounded approved facts, dependency facts, exact `parseUserTheme` function, constraints, and—on attempt two—filtered syntax diagnostics. Absolute paths and unrelated command output are excluded; likely tokens are redacted.
- Structured output and semantic validation restrict writes to one exact function replacement in `src/theme.js`. Imports, package changes, shell commands, dynamic execution, broad parsed-object spreads, stale source text, and edits outside the approved function fail closed.
- The only repair probe is a direct, bounded `node --check src/theme.js` invocation. At most two attempts are allowed; after two failures or a later exception, the original source is restored and only the dependency update remains.
- A passing syntax probe is a narrow syntax fact, not a test, build, vulnerability, exploitability, or security result. No automatic commit, push, merge, test generation, rescan, or security claim occurs in Issue #10.
