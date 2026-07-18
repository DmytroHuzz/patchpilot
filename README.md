# PatchPilot

PatchPilot investigates a known npm dependency vulnerability, proposes the smallest reviewable remediation, and proves the result with tests and a rescan.

[GitHub repository](https://github.com/DmytroHuzz/patchpilot)

> Milestone 3 complete: exact-plan approval gates an isolated four-file patch, baseline and post-patch tests/build pass, a normalized OSV rescan proves the selected advisory is absent, and Markdown/JSON reports preserve the evidence chain.

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

Open `http://127.0.0.1:4173`, choose **Run deterministic scan**, **Investigate affectedness**, and **Review remediation plan**. Approve the exact plan, choose **Create isolated workspace**, **Apply approved dependency update**, **Repair source compatibility**, **Add targeted regression test**, **Run full verification**, then **Generate evidence report**. The expected result is `GHSA-9c47-m6qq-7p4h` in direct dependency `json5@1.0.1`, evidence at `src/theme.js:1` and `src/theme.js:8–10`, a `likely affected` interpretation, and an isolated four-file diff. Baseline and post-patch install/tests/build pass, the benign `previewLabel` regression passes, and the normalized OSV rescan contains zero instances of the selected advisory. The final screen separates deterministic facts, model interpretation, human approval, and uncertainty, with downloadable Markdown and JSON. The source checkout remains unchanged.

Without `OPENAI_API_KEY`, the demo uses an explicitly labeled, checked-in GPT‑5.6 contract fixture. With the key set, the same endpoint calls `gpt-5.6` through the OpenAI Responses API and validates its Structured Output. To inspect the complete JSON result directly:

```bash
npm run investigate:demo
```

To generate and validate the read-only remediation proposal without opening the UI:

```bash
npm run plan:demo
```

The proposal remains `awaiting_approval`. Approval and cancellation are recorded only in server memory for the current demo run. After approval, isolation records baseline, branch, worktree, and validated paths. The dependency, repair, and targeted-test steps remain constrained to their displayed files and commands. Verification then runs seven ordered install/test/build commands across the clean vulnerable baseline and approved patched worktree, followed by one lockfile-scoped OSV rescan. Exit codes, durations, bounded/redacted output, normalized findings, and honest failure classifications are preserved under ignored `runs/`. Report generation validates every cited file/line excerpt against the unchanged vulnerable source, writes `runs/audit/run-*-report.md` and `runs/audit/run-*-report.json`, and exposes attachment downloads for the active demo session.

The setup script verifies the official release checksum. Set `OSV_SCANNER_PATH` to use an existing compatible scanner binary instead.

## Safety

PatchPilot is an evidence and remediation aid. It does not prove that a project is secure or that a vulnerability is exploitable. Deterministic tool results, model-supported interpretation, and unresolved unknowns are shown separately.

## License

MIT. OSV-Scanner is a separate Apache-2.0-licensed project and is not bundled in this repository.
