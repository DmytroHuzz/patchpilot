import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeOsvAdvisory } from "./normalizeAdvisory.js";
import { loadCachedAdvisory, resolveAdvisory } from "./resolveAdvisory.js";

const id = "GHSA-9c47-m6qq-7p4h";
const cacheDirectory = path.resolve(import.meta.dirname, "../../../../demo/cached-advisories");
const details = `The \`parse\` method of the JSON5 library before and including version \`2.2.1\` does not restrict parsing of keys named \`__proto__\`, allowing specially crafted strings to pollute the prototype of the resulting object.

This vulnerability pollutes the prototype of the object returned by \`JSON5.parse\` and not the global Object prototype, which is the commonly understood definition of Prototype Pollution. However, polluting the prototype of a single object can have significant security impact for an application if the object is later used in trusted operations.

## Impact
This vulnerability could allow an attacker to set arbitrary and unexpected keys on the object returned from \`JSON5.parse\`. The actual impact will depend on how applications utilize the returned object and how they filter unwanted keys, but could include denial of service, cross-site scripting, elevation of privilege, and in extreme cases, remote code execution.

## Mitigation
This vulnerability is patched in json5 v2.2.2 and later. A patch has also been backported for json5 v1 in versions v1.0.2 and later.

## Details
Executable proof-of-concept content is intentionally excluded from PatchPilot's normalized context.`;

const rawAdvisory = {
  id,
  aliases: ["CVE-2022-46175"],
  summary: "Prototype Pollution in JSON5 via Parse Method",
  details,
  database_specific: { severity: "HIGH" },
  affected: [{
    package: { name: "json5", ecosystem: "npm" },
    ranges: [{ type: "SEMVER", events: [{ introduced: "2.0.0" }, { fixed: "2.2.2" }] }],
  }, {
    package: { name: "json5", ecosystem: "npm" },
    ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "1.0.2" }] }],
  }],
  references: [
    { url: "https://github.com/json5/json5/security/advisories/GHSA-9c47-m6qq-7p4h" },
    { url: "https://nvd.nist.gov/vuln/detail/CVE-2022-46175" },
    { url: "https://github.com/json5/json5/commit/62a65408408d40aeea14c7869ed327acead12972" },
    { url: "https://github.com/json5/json5/commit/7774c1097993bc3ce9f0ac4b722a32bf7d6871c8" },
  ],
};

describe("advisory normalization and fallback", () => {
  it("keeps live and cached semantic fields identical", async () => {
    const live = normalizeOsvAdvisory(rawAdvisory);
    const cached = await loadCachedAdvisory(id, cacheDirectory);

    expect(cached).toEqual({ ...live, source: "cached-demo" });
  });

  it("labels a valid live advisory as OSV", async () => {
    await expect(resolveAdvisory({ id, liveAdvisory: rawAdvisory, cacheDirectory }))
      .resolves.toMatchObject({ id, source: "osv" });
  });

  it("falls back to explicitly labeled cached data", async () => {
    await expect(resolveAdvisory({ id, liveAdvisory: { malformed: true }, cacheDirectory }))
      .resolves.toMatchObject({ id, source: "cached-demo" });
  });

  it("rejects unsafe cache identifiers", async () => {
    await expect(loadCachedAdvisory("../secrets", cacheDirectory)).rejects.toThrow("Invalid advisory ID");
  });
});
