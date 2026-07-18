# Known limitations

- Hackathon-only, single golden npm repository path.
- The UI and API do not accept another local repository; `demo/vulnerable-node-app` is hard-wired and its mutation contracts are advisory/file/function/test specific.
- No proof of exploitability or security guarantee.
- No production repository support commitment.
- No automatic push, merge, background scan, multi-repository flow, or non-npm ecosystem.
- A live affectedness assessment requires `OPENAI_API_KEY`; otherwise the demo clearly labels and validates the checked-in GPT‑5.6 contract fixture.
- Affectedness is bounded static interpretation, not proof of runtime reachability or exploitability.
- Remediation-plan approvals are in-memory and single-session; restarting the server clears the record.
- Isolation state is in-memory for the active server, while its branch, worktree, and ignored JSON audit artifact remain local until a later patch run or explicit cleanup.
- The dependency step currently supports only the golden direct dependency `json5` and the exact approved version command.
- Compatibility repair is limited to the golden `parseUserTheme` function and a syntax-only probe. It cannot diagnose arbitrary upgrade breakage and stops after two failed attempts.
- Test generation is limited to one benign allowlist regression in the bundled test file. It does not generate exploit payloads or general test suites.
- Verification is limited to the bundled npm baseline, one approved isolated worktree, fixed install/test/build commands, and a lockfile-scoped OSV rescan of the selected advisory.
- The current flow creates a local commit and draft-PR copy only inside the isolated demo branch. The bundled repository has no publication remote; push and draft-PR creation require separate explicit approval and target configuration. Automatic push, deployment, and merge are excluded.
- Orchestration state and approvals are in memory without authentication or multi-user isolation; ignored worktrees/audit artifacts may remain after interruption.
- Scanner setup and live OSV queries require network access. Live GPT‑5.6 requires `OPENAI_API_KEY`; cached model fixtures improve demo reliability but do not demonstrate a fresh model response.
- macOS and Linux are supported by the scanner setup script; Windows is not.
