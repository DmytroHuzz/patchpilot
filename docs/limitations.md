# Known limitations

- Hackathon-only, single golden npm repository path.
- No proof of exploitability or security guarantee.
- No production repository support commitment.
- No automatic push, merge, background scan, multi-repository flow, or non-npm ecosystem.
- A live affectedness assessment requires `OPENAI_API_KEY`; otherwise the demo clearly labels and validates the checked-in GPT‑5.6 contract fixture.
- Affectedness is bounded static interpretation, not proof of runtime reachability or exploitability.
- Remediation-plan approvals are in-memory and single-session; restarting the server clears the record.
- Isolation state is in-memory for the active server, while its branch, worktree, and ignored JSON audit artifact remain local until a later patch run or explicit cleanup.
- The current isolation screen performs no dependency update or source patch. Automatic push and merge remain disabled.
