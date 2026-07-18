# ADR 0001: OSV-Scanner is the deterministic source

Status: accepted; scanner installation/version decision pending M1 validation.

PatchPilot will invoke the official OSV-Scanner CLI and treat its output—not model memory—as the authoritative detection fact. A cached checked-in result may preserve demo reliability but must be visibly labeled and tested against live normalization.

The golden finding is `GHSA-9c47-m6qq-7p4h` in the direct dependency `json5@1.0.1`. A live OSV API query on 2026-07-18 returned exactly this one advisory, described as prototype pollution through the parse method, with fixed versions in the 1.x and 2.x lines. The fixture calls `JSON5.parse` on user-provided theme configuration but includes no exploit payload.
