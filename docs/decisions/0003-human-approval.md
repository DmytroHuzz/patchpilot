# ADR 0003: Human approval before writes

Status: accepted.

PatchPilot may scan and investigate read-only, but it must present the remediation plan and receive explicit approval before modifying a target repository. It never merges automatically.

The implemented gate binds approval to a SHA-256 ID of the complete validated plan. A missing, cancelled, already-decided, or content-mismatched proposal cannot authorize a write. Cancellation is terminal for that proposal. Approval records are ephemeral in the hackathon demo and are cleared when the server restarts.
