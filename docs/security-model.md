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
