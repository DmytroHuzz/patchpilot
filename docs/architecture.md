# Architecture

This document grows only with implemented milestones. Model context construction, patch isolation, verification, and report generation remain placeholders until their milestones begin.

The Milestone 1 slice is: bundled npm fixture → OSV-Scanner subprocess → validated normalized finding → findings UI.

## Implemented M1 components

- `scripts/setup-osv-scanner.sh` pins OSV-Scanner 2.3.8, selects the macOS/Linux architecture, and verifies the official SHA-256 checksum.
- The server adapter invokes the CLI without a shell, with a 30-second timeout and 5 MiB output cap. Exit `1` is accepted only when it contains valid finding JSON.
- Zod validates both the raw fields PatchPilot consumes and the normalized public contract.
- The CLI writes the latest normalized scan artifact to the ignored `runs/m1-scan.json` path.
- The read-only `POST /api/demo/scan` endpoint scans only the bundled fixture; the React screen renders the returned facts.

OSV and command output are deterministic facts. There is no model call or interpretation in M1.
