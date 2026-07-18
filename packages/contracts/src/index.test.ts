import { describe, expect, it } from "vitest";
import { NormalizedScanResultSchema, productName } from "./index.js";

describe("contracts package", () => {
  it("exports the product identity", () => {
    expect(productName).toBe("PatchPilot");
  });

  it("rejects incomplete normalized scan results", () => {
    expect(() => NormalizedScanResultSchema.parse({ scanner: "osv-scanner" })).toThrow();
  });
});

