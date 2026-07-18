# Roadmap

The roadmap is a parking lot for post-hackathon exploration, not a claim of implemented support.

## Before the submission freeze

Only submission reliability work is active:

1. verify documentation from a clean clone;
2. rehearse the complete demo three times without manual repair;
3. record a public sub-three-minute video;
4. finish Devpost copy, built-with list, `/feedback` reference, links, and final checklist.

No new product feature enters this phase.

## First productization questions

- Safe arbitrary-local-npm onboarding with explicit repository selection, Git/npm validation, script discovery, and advisory-independent contracts.
- Durable, resumable run state with an explicit cleanup command for local worktrees and artifacts.
- A configurable policy model that preserves the current approval, path, file, command, timeout, output, and report guarantees.
- Optional draft-PR publication only after a second explicit approval, configured remote/base, authentication checks, and publication audit.
- Stronger OS-level execution isolation for repositories that are not bundled fixtures.

## Later possibilities

- Multiple findings and triage prioritization.
- Dependabot alert ingestion and other scanner adapters.
- Python, Maven/Gradle, NuGet, Cargo, and Go module ecosystems.
- Runtime or test-derived reachability evidence.
- Team review workflows, policy controls, and organization reporting.
- Scheduled monitoring, SBOM input/output, and enterprise integrations.

These ideas remain outside the hackathon build: no production support, timelines, compatibility, or security guarantees are implied.
