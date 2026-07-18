# PatchPilot Devpost submission

## Core fields

- **Name:** PatchPilot
- **Tagline:** Investigate dependency vulnerabilities, create the smallest safe patch, and prove it with tests.
- **Category:** Developer Tools
- **Repository:** https://github.com/DmytroHuzz/patchpilot
- **Demo video:** https://youtu.be/qxRCA4PA4LA
- **Codex `/feedback` session ID:** `019f7422-123d-7242-a0cf-c7f6f237594b`
- **Built with:** Codex, GPT-5.6, OpenAI Responses API, TypeScript, React, Node.js, OSV-Scanner, Zod, Vitest, Git

## Project description

Dependency scanners are good at telling a maintainer that a vulnerable package is installed. The hard work starts after the alert: Is the dependency actually used? Which code path touches it? What is the smallest compatible fix? What should be tested? What uncertainty remains?

PatchPilot turns one npm vulnerability alert into a human-reviewed, evidence-backed patch. Its deliberately narrow golden path is:

**Detect → investigate → approve → patch → test → rescan → report.**

The demo starts with a real OSV-Scanner finding for `GHSA-9c47-m6qq-7p4h` in direct dependency `json5@1.0.1`. PatchPilot cites the exact import and call site in the bundled repository, keeps scanner facts separate from GPT-5.6 interpretation, and shows the remaining unknowns. It then proposes an exact four-file remediation plan. Nothing is written until a person approves that plan.

After approval, PatchPilot creates an isolated Git worktree, upgrades `json5` to `1.0.2`, applies one bounded compatibility repair, and adds one benign targeted regression test. It compares baseline and post-patch tests and builds, rescans the patched lockfile, and generates Markdown/JSON evidence. The final handoff is a clean local commit with accurate PR-ready copy; remote publication remains locked.

### How Codex was used

Most of PatchPilot was built in one persistent Codex task. Codex helped turn the specification into issue-sized milestones, scaffold the TypeScript workspace, implement and test the scanner/evidence/approval/worktree/patch/verification/report/handoff pipeline, diagnose real Git-worktree and OSV-Scanner behavior on macOS, rehearse the browser path from clean resets, maintain the build journal, and commit each accepted issue.

### How GPT-5.6 was used

GPT-5.6 has four bounded runtime roles: affectedness interpretation from normalized advisory facts and cited repository evidence; minimal remediation planning; one exact source-function compatibility proposal with at most two attempts; and one benign targeted regression-test proposal. Responses use Structured Outputs backed by Zod and semantic validation. OSV, Git, npm, test, build, and rescan output remains deterministic authority. When no API key is configured, visibly labeled cached-demo fixtures exercise the same contracts without claiming a live response.

### Implementation and safety

The React UI talks to a Node/TypeScript orchestrator that invokes OSV-Scanner directly, gathers bounded repository evidence, validates model output, and performs approval-gated Git/npm operations. Paths are canonicalized and boundary-checked; subprocesses use fixed executable/argument arrays, timeouts, output caps, and redaction. Exact changed-file checks run after every mutation stage.

This is a complete hackathon demo, not a production security platform. It supports Node.js 20+, npm, local Git, macOS/Linux, one bundled direct vulnerability, and one validated remediation path. It does not claim runtime reachability, arbitrary repository support, Windows support, other ecosystems, automatic pull requests, merging, deployment, monitoring, SBOMs, or organization dashboards. A clean rescan proves only that the selected advisory is absent from the patched lockfile.

### Verification

The repository includes MIT licensing, clean-clone setup, a deterministic reset, live OSV smoke verification, 62 network-independent tests, production builds, real UI screenshots, and three consecutive end-to-end rehearsals without manual repair. Judges can run the complete local workflow with `./demo/run-demo.sh` or verify the aggregate suite with `npm run check`.

## Judge testing instructions

Supported platforms: macOS or Linux, Node.js 20+, npm, Git with worktree support, and network access for npm plus the first verified OSV-Scanner download.

```bash
git clone https://github.com/DmytroHuzz/patchpilot.git
cd patchpilot
npm ci
./scripts/setup-osv-scanner.sh
npm run check
./scripts/verify-demo.sh
./demo/run-demo.sh
```

Open `http://127.0.0.1:4173` and follow the 11 numbered buttons. No credentials are required for the deterministic demo. An `OPENAI_API_KEY` is optional and enables live GPT-5.6 calls; without it, the UI clearly labels the checked-in contract fixtures as `cached-demo`.

## Final external answers

- **Submitter Type:** Individual
- **Country of Residence:** Austria
