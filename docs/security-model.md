# Security model

PatchPilot will operate only inside a validated repository or isolated worktree, use allowlisted commands with timeouts and bounded output, redact likely secrets from logs, and require human approval before patch writes. It will never automatically merge or claim that static evidence proves security or exploitability.

## Implemented approval controls

- The complete remediation plan is displayed before approval, including files, commands, tests, and compatibility risks.
- Model-proposed versions, paths, and commands are validated against deterministic allowlists before display.
- The approval record references the digest of the exact plan. Any content change invalidates the gate.
- Cancelled plans remain blocked and cannot be changed to approved.
- Issue #7 records decisions only; it exposes no patch action and performs no repository writes.
