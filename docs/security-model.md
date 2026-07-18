# Security model

PatchPilot will operate only inside a validated repository or isolated worktree, use allowlisted commands with timeouts and bounded output, redact likely secrets from logs, and require human approval before patch writes. It will never automatically merge or claim that static evidence proves security or exploitability.

