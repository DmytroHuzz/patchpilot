# PatchPilot

PatchPilot investigates a known npm dependency vulnerability, proposes the smallest reviewable remediation, and proves the result with tests and a rescan.

[GitHub repository](https://github.com/DmytroHuzz/patchpilot)

> Milestone 3 in progress: detection and investigation are complete, and the full remediation plan now requires an explicit recorded human decision before any future repository write.

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

## Run the current demo

Install the pinned OSV-Scanner 2.3.8 binary for macOS/Linux, verify the clean-reset scan, then launch the local UI:

```bash
./scripts/setup-osv-scanner.sh
./scripts/verify-demo.sh
npm run demo
```

Alternatively, `./demo/run-demo.sh` performs the fixture reset, install, baseline checks, scanner setup, and UI launch in one command.

Open `http://127.0.0.1:4173`, choose **Run deterministic scan**, **Investigate affectedness**, and **Review remediation plan**. The expected result is `GHSA-9c47-m6qq-7p4h` in direct dependency `json5@1.0.1`, with evidence at `src/theme.js:1` and `src/theme.js:8–10`, a `likely affected` interpretation, and a locked plan targeting `json5@1.0.2`.

Without `OPENAI_API_KEY`, the demo uses an explicitly labeled, checked-in GPT‑5.6 contract fixture. With the key set, the same endpoint calls `gpt-5.6` through the OpenAI Responses API and validates its Structured Output. To inspect the complete JSON result directly:

```bash
npm run investigate:demo
```

To generate and validate the read-only remediation proposal without opening the UI:

```bash
npm run plan:demo
```

The proposal remains `awaiting_approval`. Approval and cancellation are recorded only in server memory for the current demo run; neither action applies a patch in Issue #7.

The setup script verifies the official release checksum. Set `OSV_SCANNER_PATH` to use an existing compatible scanner binary instead.

## Safety

PatchPilot is an evidence and remediation aid. It does not prove that a project is secure or that a vulnerability is exploitable. Deterministic tool results, model-supported interpretation, and unresolved unknowns are shown separately.

## License

MIT. OSV-Scanner is a separate Apache-2.0-licensed project and is not bundled in this repository.
