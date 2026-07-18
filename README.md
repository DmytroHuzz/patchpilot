# PatchPilot

PatchPilot investigates a known npm dependency vulnerability, proposes the smallest reviewable remediation, and proves the result with tests and a rescan.

> Hackathon build in progress. The current implementation boundary is Milestone 1: a deterministic scan of the bundled demo repository.

## Golden workflow

Detect → investigate → approve → patch → test → rescan → report.

## Current scope

- Node.js 20 or newer, npm, and local Git repositories
- One bundled vulnerable demo project
- OSV-Scanner as the deterministic vulnerability source
- Human approval before patch writes
- Markdown and JSON evidence at the end of the complete flow

See [the hackathon plan](docs/hackathon.md), [milestones](docs/milestones.md), and [known limitations](docs/limitations.md).

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Milestone-specific setup and demo commands will be documented once their acceptance criteria pass.

## Safety

PatchPilot is an evidence and remediation aid. It does not prove that a project is secure or that a vulnerability is exploitable. Deterministic tool results, model-supported interpretation, and unresolved unknowns are shown separately.

## License

MIT. OSV-Scanner is a separate Apache-2.0-licensed project and is not bundled in this repository.

