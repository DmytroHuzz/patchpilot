# Three-minute demo script

This is the recording runbook for the PatchPilot golden path. It is deliberately one continuous local UI story, timed to finish at **2:55** with five seconds of upload-safe margin.

## Acceptance contract

- Cover `Detect → investigate → approve → patch → test → rescan → report`, then show the local review handoff.
- Explain that Codex built and operated the workflow, while GPT‑5.6 supplies bounded interpretation and proposals.
- Keep OSV-Scanner, Git, npm, tests, build, and rescan visibly authoritative.
- Complete three consecutive reset-to-handoff rehearsals without manual repair.
- Keep every rehearsal and the final recorded edit below three minutes.

## Recording preflight

1. Use a 1280×720 browser viewport and record only the browser plus narration.
2. Close unrelated tabs and notifications. Keep the repository terminal off-screen.
3. Stop any existing PatchPilot server so `127.0.0.1:4173` is free.
4. From the repository root, launch the deterministic fixture path:

   ```bash
   env -u OPENAI_API_KEY ./demo/run-demo.sh
   ```

5. Open `http://127.0.0.1:4173` and confirm the first button says **Run deterministic scan**.
6. Start the timer and recording immediately before the first narration line.

Removing `OPENAI_API_KEY` selects the checked-in, visibly labeled `cached-demo` GPT‑5.6 fixtures. It does not cache scanner, test, build, Git, or rescan results; those remain real local commands.

## Timed storyboard

| Time | Click or framing | Expected screen state | Narration |
| --- | --- | --- | --- |
| 0:00–0:12 | Frame the PatchPilot header; click **Run deterministic scan**. | The local npm repository card is visible, followed by the selected OSV finding. | “A dependency scanner can flag a package, but maintainers still have to prove repository impact, choose a safe fix, and verify it. PatchPilot closes that evidence gap.” |
| 0:12–0:30 | Point to `json5@1.0.1`, `GHSA-9c47-m6qq-7p4h`, and **Direct dependency**; click **Investigate affectedness**. | Scanner version and live scan time are labeled as deterministic facts. | “Here OSV-Scanner finds one real high-severity advisory in the bundled repository. The ID, installed version, affected range, and fix version come from the scanner—not the model.” |
| 0:30–0:50 | Point to `src/theme.js:1`, `src/theme.js:8–10`, the `likely affected` card, and uncertainty; click **Review remediation plan**. | Three repository evidence references appear beside a separately labeled cached GPT‑5.6 interpretation. | “PatchPilot finds the actual import and parse call, then asks GPT‑5.6 to interpret only that bounded evidence. The conclusion is explicitly interpretation, with citations, confidence, unknowns, and next checks.” |
| 0:50–1:08 | Scan the version, four files, commands, test, risks, and approval boundary; click **Approve this exact plan**. | The immutable plan becomes approved; the UI still says no patch has started. | “Before any write, it shows the complete four-file plan: exact version, source repair, benign regression test, commands, risks, and rollback. One human approval is bound to this exact plan.” |
| 1:08–1:33 | Click **Create isolated workspace**, **Apply approved dependency update**, **Repair source compatibility**, then **Add targeted regression test** as each action appears. | Clean source badge; isolated `patchpilot/run-*` branch; two-, three-, then four-file checkpoints; one passing targeted test. | “Writes happen only in an isolated Git worktree. The approved npm update changes the manifest and lockfile, GPT‑5.6 proposes one constrained function replacement, and one safe allowlist regression test passes. Exact diff checkpoints stop unrelated changes.” |
| 1:33–2:00 | Click **Run full verification**; point to baseline, patched, and rescan result groups. | Eight exit-zero command facts appear; baseline and patched tests/build pass; normalized findings are zero and the selected advisory is absent. | “Verification compares the vulnerable baseline with the patch: clean installs, existing and targeted tests, full tests, builds, then a lockfile-scoped OSV rescan. These are real command facts. The selected advisory is gone, but PatchPilot does not claim the repository is universally secure.” |
| 2:00–2:22 | Click **Generate evidence report**; frame the trust labels and downloads. | Final status is verified; three evidence references and eight command facts are preserved; Markdown and JSON downloads are visible. | “The evidence report preserves the finding, repository citations, model interpretation, human approval, exact diffs, command results, clean rescan, remaining uncertainty, and next checks in reviewable Markdown and JSON.” |
| 2:22–2:42 | Click **Create local commit + PR copy**; point to SHA, four exact files, and `LOCKED · NOT REQUESTED`. | A clean local commit and PR-ready title/body are shown; remote publication remains locked. | “The handoff commits exactly four approved files and prepares accurate pull-request copy. It never pushes, opens, or merges remotely without a separate approval and configured target.” |
| 2:42–2:55 | Hold on the final handoff and publication lock. | The complete proof remains visible. | “Codex built, tested, and operated this repository workflow. GPT‑5.6 performs bounded interpretation and proposals; deterministic tools remain authoritative. PatchPilot turns one alert into a human-reviewed, evidence-backed fix.” |

## Exact click order

1. **Run deterministic scan**
2. **Investigate affectedness**
3. **Review remediation plan**
4. **Approve this exact plan**
5. **Create isolated workspace**
6. **Apply approved dependency update**
7. **Repair source compatibility**
8. **Add targeted regression test**
9. **Run full verification**
10. **Generate evidence report**
11. **Create local commit + PR copy**

Do not click the cancel path, report downloads, copy control, or external links during the recorded take. Describe them while the relevant state is on-screen.

## Reset between takes

1. Stop the running server with `Ctrl-C`.
2. Run `./demo/reset-demo.sh` from the repository root.
3. Confirm the nested fixture is on `main`, clean, and at its `vulnerable` tag:

   ```bash
   git -C demo/vulnerable-node-app status --short --branch
   git -C demo/vulnerable-node-app describe --tags --exact-match
   ```

4. Relaunch with `env -u OPENAI_API_KEY ./demo/run-demo.sh`.
5. Reload `http://127.0.0.1:4173` and start only when **Run deterministic scan** is visible.

The reset deliberately removes ignored fixture dependencies and returns tracked files to the vulnerable tag. The next launch reinstalls dependencies and restarts the in-memory workflow.

## Fallback plan

Never manually repair a failed take. Stop recording, preserve the error long enough to diagnose it, then reset and begin a new rehearsal.

| Failure | Recording response | Recovery before another take |
| --- | --- | --- |
| Port 4173 already in use | Do not record against an unknown or stale server. | Stop the existing PatchPilot process, then perform the complete reset and relaunch. |
| OSV download or live scan unavailable | Stop; do not describe cached advisory data as a live scan. | Restore network access or a previously checksum-verified `tools/bin/osv-scanner`, then run `./scripts/verify-demo.sh`. |
| Model API slow or unavailable | Stop if a live key was accidentally enabled. | Relaunch with `env -u OPENAI_API_KEY` so the explicit `cached-demo` fixtures use the same schemas and semantic validators. |
| Test, build, rescan, or Git step fails | Keep the failure visible; do not skip or claim success. | Save logs if useful, stop the server, run the reset procedure, and require `npm run check` plus `./scripts/verify-demo.sh` before retrying. |
| Browser or recorder interruption | Discard the take. | Restart recording from the initial repository card after a full reset. |
| Recording cannot be completed before the deadline | Use a voice-over edit built only from the verified fallback screenshots below and clearly label it as a prerecorded golden run. | Keep the public repository instructions as the judge-reproducible source of truth. |

## Fallback assets

| Asset | What it proves | Use in an emergency edit |
| --- | --- | --- |
| [Investigation screenshot](assets/patchpilot-investigation.jpg) | Deterministic advisory facts, exact repository citations, visibly separate GPT‑5.6 interpretation, and uncertainty | Covers detect and investigate while narrating the first 50 seconds. |
| [Verified handoff screenshot](assets/patchpilot-handoff.jpg) | Local commit, four exact files, PR-ready copy, and locked remote publication | Covers verification, report, and handoff while narrating the final 55 seconds. |
| [README architecture diagram](../README.md#architecture) | Scanner/model/executor/report boundaries | Optional five-second bridge while explaining Codex and GPT‑5.6 roles. |

Fallback assets are recording aids, not substitute product evidence. The repository remains the reproducible demo.

## Rehearsal evidence

Acceptance ran on 2026-07-18 with `OPENAI_API_KEY` removed. Before every row, the server stopped, the fixture reset to clean `main` at the `vulnerable` tag, baseline tests/build passed during relaunch, and the browser reloaded to **Run deterministic scan**. Elapsed time starts at the first click and ends when **Review-ready local handoff complete** appears; recording preflight is intentionally off-camera.

| Run | First click to handoff | All actions | Selected advisory absent | Exact four-file local commit | Remote locked | Browser errors | Manual repair |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| 1 | 12.87 seconds | 11/11 | Yes | `d869050df851` · four files | `not_requested` | 0 | No |
| 2 | 13.58 seconds | 11/11 | Yes | `a344e91787e8` · four files | `not_requested` | 0 | No |
| 3 | 13.43 seconds | 11/11 | Yes | `3fe2dab24443` · four files | `not_requested` | 0 | No |

All three terminal screens also showed `✓ VERIFIED`, `3 VALID` evidence references, eight command facts, `✓ ABSENT`, `4 EXACT`, and `LOCKED · NOT REQUESTED`. The 270-word narration is allocated 175 seconds, so the storyboard itself—not only the fast automated UI execution—fits the three-minute limit with five seconds of margin.

## Local review cut

Issue #17 renders the approved narration and actual UI captures into an ignored local MP4 using native macOS tooling. The current review cut is 2:22.67 at 1280×720 with H.264 video and AAC narration. See [submission video assets](../submission/README.md) to reproduce it. It is not a public video until a human reviews and explicitly approves upload.
