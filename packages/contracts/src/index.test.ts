import { describe, expect, it } from "vitest";
import { productName } from "./index.js";

describe("contracts package", () => {
  it("exports the product identity", () => {
    expect(productName).toBe("PatchPilot");
  });
});

