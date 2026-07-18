# PatchPilot

PatchPilot investigates a known npm dependency vulnerability, proposes the smallest reviewable remediation, and proves the result with tests and a rescan.

[GitHub repository](https://github.com/DmytroHuzz/patchpilot)

> Milestone 3 in progress: exact-plan approval gates an isolated worktree, the approved dependency/source repair is applied there, and one generated non-weaponized regression test now produces a passing four-file review diff.

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

Open `http://127.0.0.1:4173`, choose **Run deterministic scan**, **Investigate affectedness**, and **Review remediation plan**. Approve the exact plan, choose **Create isolated workspace**, **Apply approved dependency update**, **Repair source compatibility**, then **Add targeted regression test**. The expected result is `GHSA-9c47-m6qq-7p4h` in direct dependency `json5@1.0.1`, evidence at `src/theme.js:1` and `src/theme.js:8–10`, a `likely affected` interpretation, and an isolated four-file diff. The manifest and lockfile move to `json5@1.0.2`; `parseUserTheme` copies only `accent` and `density`; and one benign `previewLabel` test passes with `node --test test/theme.test.js`. The source checkout remains unchanged.

Without `OPENAI_API_KEY`, the demo uses an explicitly labeled, checked-in GPT‑5.6 contract fixture. With the key set, the same endpoint calls `gpt-5.6` through the OpenAI Responses API and validates its Structured Output. To inspect the complete JSON result directly:

```bash
npm run investigate:demo
```

To generate and validate the read-only remediation proposal without opening the UI:

```bash
npm run plan:demo
```

The proposal remains `awaiting_approval`. Approval and cancellation are recorded only in server memory for the current demo run. After approval, isolation records baseline, branch, worktree, and validated paths. The dependency step executes only the displayed npm command. The repair step can replace only the exact `parseUserTheme` function and runs a syntax probe. The test step can insert only one `it(...)` block using the benign `previewLabel` field; it rejects prototype-related keys and restores the test file unless the targeted command passes. Every step preserves a validated audit artifact under ignored `runs/`. The full suite/build, rescan, and report remain later checkpoints.

The setup script verifies the official release checksum. Set `OSV_SCANNER_PATH` to use an existing compatible scanner binary instead.

## Safety

PatchPilot is an evidence and remediation aid. It does not prove that a project is secure or that a vulnerability is exploitable. Deterministic tool results, model-supported interpretation, and unresolved unknowns are shown separately.

## License

MIT. OSV-Scanner is a separate Apache-2.0-licensed project and is not bundled in this repository.
