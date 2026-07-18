# ADR 0001: OSV-Scanner is the deterministic source

Status: accepted by specification; installation/version decision pending M1 validation.

PatchPilot will invoke the official OSV-Scanner CLI and treat its output—not model memory—as the authoritative detection fact. A cached checked-in result may preserve demo reliability but must be visibly labeled and tested against live normalization.

